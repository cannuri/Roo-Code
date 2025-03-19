/**
 * Error thrown when a lock acquisition times out
 */
export class LockTimeoutError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "LockTimeoutError"
	}
}

/**
 * Options for lock acquisition
 */
export interface LockOptions {
	/** Maximum time to wait for lock acquisition in milliseconds */
	timeoutMs?: number
}

/**
 * Queue item for waiting lock requests
 */
interface QueueItem {
	resolve: (value: void) => void
	reject: (reason: Error) => void
	timeoutId?: NodeJS.Timeout
}

/**
 * An asynchronous lock implementation
 *
 * This class provides a lightweight alternative to the Mutex implementation
 * with added features like timeout support and a cleaner API.
 */
export class Lock {
	private locked = false
	private waitQueue: QueueItem[] = []

	/**
	 * Checks if the lock is currently held
	 */
	public isLocked(): boolean {
		return this.locked
	}

	/**
	 * Acquires the lock
	 *
	 * @param options Lock acquisition options
	 * @returns Promise that resolves when lock is acquired or rejects on timeout
	 */
	public async acquire(options: LockOptions = {}): Promise<void> {
		// If lock is free, acquire it immediately
		if (!this.locked) {
			this.locked = true
			return
		}

		// Otherwise, wait in the queue
		return new Promise<void>((resolve, reject) => {
			const queueItem: QueueItem = { resolve, reject }

			// Set up timeout if specified
			if (options.timeoutMs) {
				const timeoutId = setTimeout(() => {
					// Remove this item from the queue
					const index = this.waitQueue.indexOf(queueItem)
					if (index !== -1) {
						this.waitQueue.splice(index, 1)
					}

					reject(new LockTimeoutError(`Lock acquisition timed out after ${options.timeoutMs}ms`))
				}, options.timeoutMs)

				// Store the timeout ID so we can clear it if lock is acquired
				queueItem.timeoutId = timeoutId
			}

			this.waitQueue.push(queueItem)
		})
	}

	/**
	 * Releases the lock
	 *
	 * If there are waiters in the queue, the lock will be passed to the next waiter.
	 * Otherwise, the lock will be released.
	 */
	public release(): void {
		if (this.waitQueue.length > 0) {
			// Pass the lock to the next waiter
			const next = this.waitQueue.shift()!

			// Clear any timeout
			if (next.timeoutId) {
				clearTimeout(next.timeoutId)
			}

			// Resolve the waiter's promise
			next.resolve()
		} else {
			// No waiters, release the lock
			this.locked = false
		}
	}

	/**
	 * Executes a function with lock protection
	 *
	 * The lock is automatically acquired before executing the function and
	 * released after the function completes, even if it throws an error.
	 *
	 * @param fn Function to execute with lock protection
	 * @param options Lock acquisition options
	 * @returns Promise that resolves with the function result
	 */
	public async withLock<T>(fn: () => Promise<T> | T, options: LockOptions = {}): Promise<T> {
		await this.acquire(options)

		try {
			return await fn()
		} finally {
			this.release()
		}
	}
}

/**
 * Creates a function that executes with lock protection
 *
 * @param fn Function to protect with a lock
 * @param options Lock acquisition options
 * @returns Protected function that acquires the lock before execution
 */
export function withLock<T extends (...args: any[]) => Promise<any> | any>(
	fn: T,
	options: LockOptions = {},
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
	const lock = new Lock()

	return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
		return lock.withLock(() => fn(...args), options)
	}
}

/**
 * Method decorator that ensures the method executes with lock protection
 *
 * @param options Lock acquisition options
 * @returns Method decorator
 */
export function synchronized(options: LockOptions = {}) {
	return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value
		const lock = new Lock()

		descriptor.value = async function (...args: any[]) {
			return lock.withLock(() => originalMethod.apply(this, args), options)
		}

		return descriptor
	}
}
