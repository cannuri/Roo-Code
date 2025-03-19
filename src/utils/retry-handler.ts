/**
 * Configuration options for RetryHandler
 */
export interface RetryConfig {
	/** Maximum number of retry attempts */
	maxRetries: number
	/** Initial delay between retries in milliseconds */
	initialDelayMs: number
	/** Factor by which the delay increases with each retry attempt */
	backoffFactor: number
	/** Whether to add random jitter to delay times to prevent thundering herd problem */
	useJitter?: boolean
	/** Optional timeout for each attempt in milliseconds */
	timeoutMs?: number
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
	/** The successful result if the operation succeeded */
	result?: T
	/** The error if all retry attempts failed */
	error?: Error
	/** Number of attempts made before success or giving up */
	attempts: number
	/** Whether the operation was successful */
	successful: boolean
}

/**
 * Error thrown when all retry attempts fail
 */
export class RetryError extends Error {
	constructor(
		message: string,
		public readonly attempts: number,
		public readonly lastError: Error,
	) {
		super(message)
		this.name = "RetryError"
	}
}

/**
 * A retry handler with exponential backoff
 *
 * This class provides essential retry functionality without the complexity
 * of a full circuit breaker pattern. It implements exponential backoff with
 * optional jitter for retry attempts.
 */
export class RetryHandler {
	private config: RetryConfig

	/**
	 * Creates a new RetryHandler
	 *
	 * @param config Configuration options for retry behavior
	 */
	constructor(config: RetryConfig) {
		// Set default values
		const defaultConfig: RetryConfig = {
			maxRetries: 3,
			initialDelayMs: 1000,
			backoffFactor: 2,
			useJitter: true,
			timeoutMs: undefined,
		}

		// Merge with provided config
		this.config = { ...defaultConfig, ...config }
	}

	/**
	 * Executes an operation with retry logic
	 *
	 * @param operation The async operation to execute with retry logic
	 * @returns A promise that resolves with the operation result or rejects with RetryError
	 */
	public async execute<T>(operation: () => Promise<T>): Promise<T> {
		let attempts = 0
		let lastError: Error | undefined

		while (attempts <= this.config.maxRetries) {
			try {
				// If this isn't the first attempt, wait before retrying
				if (attempts > 0) {
					await this.delay(attempts)
				}

				// Execute the operation, potentially with timeout
				const result = await this.executeWithTimeout(operation)
				return result
			} catch (error) {
				attempts++
				lastError = error instanceof Error ? error : new Error(String(error))

				// If we've reached max retries, break out of the loop
				if (attempts > this.config.maxRetries) {
					break
				}
			}
		}

		// If we get here, all retry attempts failed
		throw new RetryError(`Operation failed after ${attempts} attempts`, attempts, lastError as Error)
	}

	/**
	 * Executes an operation with retry logic and returns detailed result
	 *
	 * @param operation The async operation to execute with retry logic
	 * @returns A promise that resolves with RetryResult containing success/failure details
	 */
	public async executeWithResult<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
		let attempts = 0
		let lastError: Error | undefined

		while (attempts <= this.config.maxRetries) {
			try {
				// If this isn't the first attempt, wait before retrying
				if (attempts > 0) {
					await this.delay(attempts)
				}

				// Execute the operation, potentially with timeout
				const result = await this.executeWithTimeout(operation)
				return {
					result,
					attempts,
					successful: true,
				}
			} catch (error) {
				attempts++
				lastError = error instanceof Error ? error : new Error(String(error))

				// If we've reached max retries, break out of the loop
				if (attempts > this.config.maxRetries) {
					break
				}
			}
		}

		// If we get here, all retry attempts failed
		return {
			error: lastError,
			attempts,
			successful: false,
		}
	}

	/**
	 * Calculates and waits for the appropriate delay time based on the attempt number
	 *
	 * @param attempt The current attempt number (1-based)
	 * @returns A promise that resolves after the delay
	 */
	private async delay(attempt: number): Promise<void> {
		const baseDelay = this.config.initialDelayMs * Math.pow(this.config.backoffFactor, attempt - 1)
		let delayMs = baseDelay

		// Add jitter if enabled (±25% of base delay)
		if (this.config.useJitter) {
			const jitterRange = baseDelay * 0.25
			delayMs = baseDelay + Math.random() * jitterRange * 2 - jitterRange
		}

		// Use setTimeout wrapped in a Promise
		return new Promise<void>((resolve) => {
			setTimeout(resolve, delayMs)
		})
	}

	/**
	 * Executes an operation with an optional timeout
	 *
	 * @param operation The async operation to execute
	 * @returns A promise that resolves with the operation result or rejects on timeout
	 */
	private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
		if (!this.config.timeoutMs) {
			return operation()
		}

		return Promise.race([
			operation(),
			new Promise<never>((_, reject) => {
				setTimeout(() => {
					reject(new Error(`Operation timed out after ${this.config.timeoutMs}ms`))
				}, this.config.timeoutMs)
			}),
		])
	}
}
