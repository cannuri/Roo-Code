import { ApiConfiguration, ModelInfo } from "./api"
import { Capability, CapabilityStrength, ModelCapabilities } from "./model-capabilities"
import { ModelCapabilityManager } from "./model-capability-manager"
import { CacheManager } from "../utils/cache-manager"
import { RetryHandler } from "../utils/retry-handler"
import { Lock } from "../utils/lock"
import { logger } from "../utils/logging"
import { telemetryService } from "../services/telemetry/TelemetryService"
import { CapabilityError, InvalidModelError, ValidationError, RateLimitError, TimeoutError } from "./errors"

/**
 * Service configuration options
 */
export interface CapabilityServiceConfig {
	/** Operation timeout in milliseconds */
	timeout?: number
	/** Maximum retry attempts */
	maxRetries?: number
	/** Base delay for exponential backoff (ms) */
	baseRetryDelay?: number
	/** Maximum size for capability data (bytes) */
	maxDataSize?: number
	/** Cache lifetime in milliseconds */
	cacheLifetime?: number
	/** Maximum cache size in entries */
	maxCacheSize?: number
	/** Maximum length for model IDs */
	maxModelIdLength?: number
	/** Maximum requests per time window */
	maxRequestsPerWindow?: number
	/** Time window for rate limiting in milliseconds */
	rateLimitWindow?: number
	/** Maximum depth for object validation */
	maxValidationDepth?: number
	/** Performance sampling rate (0-1) */
	performanceSamplingRate?: number
}

/**
 * Service state information
 */
export interface ServiceState {
	/** Cache statistics */
	cache: {
		size: number
		hitRate: number
	}
	/** Rate limiting statistics */
	rateLimit: {
		currentCount: number
		windowResetTime: number
	}
	/** Performance metrics */
	performance: {
		avgResponseTime: number
	}
}

/**
 * Capability determination parameters
 */
export interface CapabilityParams {
	/** Model info from API if available */
	apiModel?: ModelInfo
	/** API configuration for model ID fallback */
	apiConfiguration: ApiConfiguration
	/** Browser tool enabled setting */
	browserToolEnabled?: boolean
	/** Operation timeout override */
	timeout?: number
}

/**
 * Token bucket for rate limiting
 */
class TokenBucket {
	private tokens: number
	private lastRefill: number

	constructor(
		private readonly capacity: number,
		private readonly refillWindow: number,
	) {
		this.tokens = capacity
		this.lastRefill = Date.now()
	}

	refill(): void {
		const now = Date.now()
		const timePassed = now - this.lastRefill
		const refillAmount = Math.floor((timePassed / this.refillWindow) * this.capacity)
		this.tokens = Math.min(this.capacity, this.tokens + refillAmount)
		this.lastRefill = now
	}

	consume(): boolean {
		this.refill()
		if (this.tokens > 0) {
			this.tokens--
			return true
		}
		return false
	}

	getTokens(): number {
		return this.tokens
	}

	getLastRefill(): number {
		return this.lastRefill
	}
}

/**
 * Simplified service for managing model capabilities with proper error handling,
 * resource management, and security controls.
 */
export class CapabilityService {
	private static instance: CapabilityService | null = null
	private static initializationLock = new Lock()

	private readonly manager: ModelCapabilityManager
	private readonly cacheManager: CacheManager
	private readonly lock: Lock
	private readonly retryHandler: RetryHandler
	private readonly tokenBucket: TokenBucket
	private readonly performanceMetrics: number[] = []
	private disposed = false
	private initializationError: Error | null = null
	private requestCount = 0
	private hitCount = 0

	private readonly config: Required<CapabilityServiceConfig> = {
		timeout: 5000,
		maxRetries: 3,
		baseRetryDelay: 100,
		maxDataSize: 1024 * 1024, // 1MB
		cacheLifetime: 60 * 60 * 1000, // 1 hour
		maxCacheSize: 1000,
		maxModelIdLength: 100,
		maxRequestsPerWindow: 1000,
		rateLimitWindow: 5 * 60 * 1000, // 5 minutes
		maxValidationDepth: 5,
		performanceSamplingRate: 0.1,
	}

	private constructor(config?: CapabilityServiceConfig) {
		try {
			// Apply configuration
			if (config) {
				this.config = { ...this.config, ...config }
			}

			// Initialize core dependencies
			this.lock = new Lock()
			this.cacheManager = CacheManager.getInstance({
				maxCacheSize: this.config.maxDataSize,
				reductionRatio: 70,
				reductionThreshold: 90,
			})
			this.manager = ModelCapabilityManager.getInstance({
				maxCacheSize: this.config.maxCacheSize,
				cacheLifetime: this.config.cacheLifetime,
			})

			// Initialize retry handler
			this.retryHandler = new RetryHandler({
				maxRetries: this.config.maxRetries,
				initialDelayMs: this.config.baseRetryDelay,
				backoffFactor: 2,
				useJitter: true,
				timeoutMs: this.config.timeout,
			})

			// Initialize rate limiter
			this.tokenBucket = new TokenBucket(this.config.maxRequestsPerWindow, this.config.rateLimitWindow)

			// Validate initialization
			this.validateInitialization()
		} catch (error) {
			this.initializationError = error as Error
			logger.error("Failed to initialize CapabilityService", {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			})
			throw error
		}
	}

	/**
	 * Get singleton instance with configuration
	 */
	public static getInstance(config?: CapabilityServiceConfig): CapabilityService {
		if (!CapabilityService.instance) {
			CapabilityService.instance = new CapabilityService(config)
		}
		return CapabilityService.instance
	}

	/**
	 * Get singleton instance with thread-safe initialization (async)
	 */
	public static async getInstanceAsync(config?: CapabilityServiceConfig): Promise<CapabilityService> {
		if (!CapabilityService.instance) {
			await CapabilityService.initializationLock.withLock(async () => {
				if (!CapabilityService.instance) {
					CapabilityService.instance = new CapabilityService(config)
				}
			})
		}
		return CapabilityService.instance!
	}

	/**
	 * Reset the singleton instance (primarily for testing)
	 */
	public static resetInstance(): void {
		CapabilityService.instance = null
	}

	/**
	 * Validate service initialization
	 */
	private validateInitialization(): void {
		if (!this.manager || !this.cacheManager || !this.lock || !this.retryHandler) {
			throw new Error("Invalid service initialization state")
		}
	}

	/**
	 * Simplified input validation with security checks
	 */
	private validateParams(params: CapabilityParams): void {
		if (!params || !params.apiConfiguration) {
			throw new ValidationError("API configuration is required")
		}

		// Validate and sanitize model ID
		const modelId = params.apiConfiguration.apiModelId || params.apiConfiguration.openRouterModelId
		if (modelId) {
			if (modelId.length > this.config.maxModelIdLength) {
				throw new ValidationError(
					`Model ID length ${modelId.length} exceeds maximum ${this.config.maxModelIdLength}`,
				)
			}

			// Security: Check for injection attempts
			if (/[<>{}()[\]\\\/]/.test(modelId)) {
				throw new ValidationError("Invalid characters in model ID")
			}
		}

		// Simple size validation
		try {
			const size = Buffer.byteLength(JSON.stringify(params), "utf8")
			if (size > this.config.maxDataSize) {
				throw new ValidationError(`Input data size exceeds maximum ${this.config.maxDataSize}`)
			}
		} catch (error) {
			throw new ValidationError("Failed to validate input size")
		}
	}

	/**
	 * Determine model capabilities with simplified error handling and retries
	 */
	public async determineCapabilities(params: CapabilityParams): Promise<ModelCapabilities> {
		// Check initialization and disposal state
		if (this.disposed) {
			throw new Error("Service has been disposed")
		}
		if (this.initializationError) {
			throw this.initializationError
		}

		const startTime = process.hrtime.bigint()
		this.requestCount++

		try {
			// Simplified validation
			this.validateParams(params)

			// Rate limiting check
			if (!this.tokenBucket.consume()) {
				throw new RateLimitError("Rate limit exceeded")
			}

			// Generate cache key
			const cacheKey = this.generateCacheKey(params)

			// Check cache first
			const cachedResult = await this.manager.getFromCache(cacheKey)
			if (cachedResult) {
				this.hitCount++

				// Record performance metric if sampling
				if (Math.random() < this.config.performanceSamplingRate) {
					const duration = Number(process.hrtime.bigint() - startTime) / 1_000_000 // Convert to ms
					this.performanceMetrics.push(duration)
				}

				return cachedResult
			}

			// Execute with retry logic
			const result = await this.retryHandler.execute(async () => {
				// Thread-safe execution with timeout
				return await this.lock.withLock(async () => {
					const timeout = params.timeout || this.config.timeout
					return await Promise.race([
						this.manager.determineCapabilities(params),
						new Promise<never>((_, reject) => {
							setTimeout(() => reject(new TimeoutError("Operation timed out")), timeout)
						}),
					])
				})
			})

			// Cache the result
			await this.manager.addToCache(cacheKey, result)

			// Record performance metric if sampling
			if (Math.random() < this.config.performanceSamplingRate) {
				const duration = Number(process.hrtime.bigint() - startTime) / 1_000_000 // Convert to ms
				this.performanceMetrics.push(duration)
			}

			return result
		} catch (error) {
			// Enhanced error logging with security considerations
			const errorMessage = error instanceof Error ? error.message : String(error)
			const errorCode = error instanceof CapabilityError ? error.code : "UNKNOWN"

			// Sanitize error details for logging
			let sanitizedModelId = "none"
			if (params.apiConfiguration) {
				sanitizedModelId =
					params.apiConfiguration.apiModelId || params.apiConfiguration.openRouterModelId
						? "[REDACTED]"
						: "none"
			}

			logger.error(`Failed to determine capabilities: ${errorMessage}`, {
				code: errorCode,
				modelId: sanitizedModelId,
			})

			// Simplified telemetry
			telemetryService.captureEvent("capability_determination_failed", {
				error_code: errorCode,
				duration_ns: Number(process.hrtime.bigint() - startTime),
			})

			throw error
		}
	}

	/**
	 * Generate a cache key for the given parameters
	 */
	private generateCacheKey(params: CapabilityParams): string {
		const modelId = params.apiConfiguration.apiModelId || params.apiConfiguration.openRouterModelId || "unknown"
		const browserEnabled = params.browserToolEnabled ? "1" : "0"
		return `${modelId}:${browserEnabled}`
	}

	/**
	 * Check if capabilities include specific capability
	 */
	public hasCapability(capabilities: ModelCapabilities, capability: Capability): boolean {
		return capabilities.supportedCapabilities.has(capability)
	}

	/**
	 * Check if model supports computer use
	 * @deprecated Use hasCapability(capabilities, "computerUse") instead
	 */
	public supportsComputerUse(capabilities: ModelCapabilities): boolean {
		return this.hasCapability(capabilities, "computerUse")
	}

	/**
	 * Get capability version if supported
	 */
	public getCapabilityVersion(capabilities: ModelCapabilities, capability: Capability): string | undefined {
		return capabilities.capabilityVersions[capability]
	}

	/**
	 * Get capability strength if supported
	 */
	public getCapabilityStrength(
		capabilities: ModelCapabilities,
		capability: Capability,
	): CapabilityStrength | undefined {
		return capabilities.capabilityStrength[capability]
	}

	/**
	 * Get current service state
	 */
	public getState(): ServiceState {
		const avgResponseTime =
			this.performanceMetrics.length > 0
				? this.performanceMetrics.reduce((a, b) => a + b) / this.performanceMetrics.length
				: 0

		return {
			cache: {
				size: this.manager.getCacheSize(),
				hitRate: this.requestCount > 0 ? (this.hitCount / this.requestCount) * 100 : 0,
			},
			rateLimit: {
				currentCount: this.config.maxRequestsPerWindow - this.tokenBucket.getTokens(),
				windowResetTime: this.tokenBucket.getLastRefill() + this.config.rateLimitWindow,
			},
			performance: {
				avgResponseTime,
			},
		}
	}

	/**
	 * Clear the capability cache
	 */
	public async clearCache(): Promise<void> {
		await this.lock.withLock(async () => {
			await this.manager.clearCache()
		})
	}

	/**
	 * Clean up resources
	 */
	public dispose(): void {
		if (this.disposed) {
			return
		}

		this.disposed = true
		this.manager.dispose()
		this.performanceMetrics.length = 0
	}
}
