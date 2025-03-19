import { ApiConfiguration, ModelInfo } from "./api"
import {
	Capability,
	CapabilityStrength,
	MODEL_CAPABILITIES,
	ModelCapabilities,
	determineModelCapabilities,
} from "./model-capabilities"
import { telemetryService } from "../services/telemetry/TelemetryService"
import { logger } from "../utils/logging"
import { Lock } from "../utils/lock"
import { CapabilityError, InvalidModelError, ValidationError } from "./errors"

/**
 * Configuration for the capability manager
 */
export interface ManagerConfig {
	/** Maximum number of entries in the cache */
	maxCacheSize: number
	/** Cache entry lifetime in milliseconds */
	cacheLifetime: number
}

/**
 * Cache entry with expiration
 */
interface CacheEntry {
	capabilities: ModelCapabilities
	timestamp: number
}

/**
 * Simplified manager for model capability detection and caching
 */
export class ModelCapabilityManager {
	private static instance: ModelCapabilityManager | null = null
	private cache = new Map<string, CacheEntry>()
	private lock: Lock
	private cleanupTimer: ReturnType<typeof setInterval> | null = null

	private readonly config: ManagerConfig = {
		maxCacheSize: 1000,
		cacheLifetime: 60 * 60 * 1000, // 1 hour
	}

	/**
	 * Private constructor to enforce singleton pattern
	 * @param config Optional configuration to override defaults
	 */
	private constructor(config?: Partial<ManagerConfig>) {
		if (config) {
			this.config = { ...this.config, ...config }
		}

		this.lock = new Lock()
		this.startCleanupTimer()
	}

	/**
	 * Get singleton instance
	 * @param config Optional configuration to override defaults (only used on first call)
	 */
	public static getInstance(config?: Partial<ManagerConfig>): ModelCapabilityManager {
		if (!ModelCapabilityManager.instance) {
			ModelCapabilityManager.instance = new ModelCapabilityManager(config)
		}
		return ModelCapabilityManager.instance
	}

	/**
	 * Reset the singleton instance (primarily for testing)
	 */
	public static resetInstance(): void {
		ModelCapabilityManager.instance = null
	}

	/**
	 * Start periodic cleanup timer
	 */
	private startCleanupTimer(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer)
		}
		this.cleanupTimer = setInterval(
			() => {
				this.cleanup()
			},
			5 * 60 * 1000,
		) // Run cleanup every 5 minutes
	}

	/**
	 * Clean expired cache entries
	 */
	private cleanup(): void {
		const now = Date.now()
		const expiredKeys: string[] = []

		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.timestamp > this.config.cacheLifetime) {
				expiredKeys.push(key)
			}
		}

		expiredKeys.forEach((key) => this.cache.delete(key))

		// Log cleanup metrics
		if (expiredKeys.length > 0) {
			logger.info("Capability cache cleanup", {
				expired_entries: expiredKeys.length,
				remaining_entries: this.cache.size,
			})
		}
	}

	/**
	 * Get the current cache size
	 */
	public getCacheSize(): number {
		return this.cache.size
	}

	/**
	 * Get a capability result from cache
	 * @param key Cache key
	 * @returns Cached capabilities or undefined if not found
	 */
	public async getFromCache(key: string): Promise<ModelCapabilities | undefined> {
		const entry = this.cache.get(key)
		if (!entry) {
			return undefined
		}

		// Check if entry is expired
		if (Date.now() - entry.timestamp > this.config.cacheLifetime) {
			this.cache.delete(key)
			return undefined
		}

		return entry.capabilities
	}

	/**
	 * Add a capability result to cache
	 * @param key Cache key
	 * @param capabilities Capability result to cache
	 */
	public async addToCache(key: string, capabilities: ModelCapabilities): Promise<void> {
		// Enforce cache size limit with LRU eviction
		if (this.cache.size >= this.config.maxCacheSize) {
			// Find the oldest entry
			let oldestKey: string | null = null
			let oldestTime = Date.now()

			for (const [entryKey, entry] of this.cache.entries()) {
				if (entry.timestamp < oldestTime) {
					oldestTime = entry.timestamp
					oldestKey = entryKey
				}
			}

			// Remove the oldest entry
			if (oldestKey) {
				this.cache.delete(oldestKey)
			}
		}

		// Add new entry
		this.cache.set(key, {
			capabilities,
			timestamp: Date.now(),
		})
	}

	/**
	 * Creates empty capability records for testing and fallback
	 * @returns Empty capability records
	 */
	public createEmptyCapabilityRecords(): ModelCapabilities {
		return {
			supportedCapabilities: new Set(),
			capabilityVersions: {
				computerUse: "",
				imageAnalysis: "",
			},
			capabilityStrength: {
				computerUse: "basic",
				imageAnalysis: "basic",
			},
		}
	}

	/**
	 * Determine model capabilities
	 * @param params Parameters for capability determination
	 * @returns Resolved model capabilities
	 */
	public async determineCapabilities(params: {
		apiModel?: ModelInfo
		apiConfiguration: ApiConfiguration
		browserToolEnabled?: boolean
		timeout?: number
	}): Promise<ModelCapabilities> {
		try {
			// Validate input
			if (!params.apiConfiguration) {
				throw new ValidationError("API configuration is required")
			}

			// Use the built-in determineModelCapabilities function
			const capabilities = determineModelCapabilities({
				apiModel: params.apiModel,
				apiConfiguration: params.apiConfiguration,
				browserToolEnabled: params.browserToolEnabled ?? true,
			})

			// Log capability determination
			const modelId = params.apiConfiguration.apiModelId || params.apiConfiguration.openRouterModelId || "unknown"

			telemetryService.captureEvent("capability_determination_success", {
				model_id: modelId,
				has_computer_use: capabilities.supportedCapabilities.has("computerUse"),
				has_image_analysis: capabilities.supportedCapabilities.has("imageAnalysis"),
			})

			return capabilities
		} catch (error) {
			// Log error and rethrow
			logger.error("Error determining capabilities", {
				error: error instanceof Error ? error.message : String(error),
			})

			if (error instanceof Error) {
				throw error
			} else {
				throw new CapabilityError("Failed to determine capabilities", "UNKNOWN_ERROR")
			}
		}
	}

	/**
	 * Check if model supports computer use
	 * @param capabilities The model's capabilities
	 * @returns True if computer use is supported
	 */
	public supportsComputerUse(capabilities: ModelCapabilities): boolean {
		return capabilities.supportedCapabilities.has("computerUse")
	}

	/**
	 * Clear the capability cache
	 */
	public async clearCache(): Promise<void> {
		await this.lock.withLock(async () => {
			this.cache.clear()
		})
	}

	/**
	 * Clean up resources when shutting down
	 */
	public dispose(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer)
			this.cleanupTimer = null
		}
		this.cache.clear()
	}
}
