/**
 * Configuration options for CacheManager
 */
export interface CacheConfig {
	/** Maximum cache size in bytes */
	maxCacheSize: number
	/** Target cache size after reduction (percentage of max) */
	reductionRatio: number
	/** Threshold percentage at which cache reduction should be triggered */
	reductionThreshold: number
}

/**
 * A cache manager for memory optimization
 *
 * This class provides essential cache management functionality without the complexity
 * of advanced memory pressure monitoring and GC hints. It focuses on tracking cache size
 * and providing recommendations for cache reduction when needed.
 */
export class CacheManager {
	private static instance: CacheManager | null = null
	private totalCacheSize: number = 0

	private config: CacheConfig = {
		maxCacheSize: 100 * 1024 * 1024, // 100MB default
		reductionRatio: 70, // Reduce to 70% of max by default
		reductionThreshold: 90, // Start reduction at 90% of max by default
	}

	/**
	 * Private constructor to enforce singleton pattern
	 * @param config Optional configuration to override defaults
	 */
	private constructor(config?: Partial<CacheConfig>) {
		if (config) {
			this.config = { ...this.config, ...config }
		}
	}

	/**
	 * Get singleton instance
	 * @param config Optional configuration to override defaults (only used on first call)
	 */
	public static getInstance(config?: Partial<CacheConfig>): CacheManager {
		if (!CacheManager.instance) {
			CacheManager.instance = new CacheManager(config)
		}
		return CacheManager.instance
	}

	/**
	 * Reset the singleton instance (primarily for testing)
	 */
	public static resetInstance(): void {
		CacheManager.instance = null
	}

	/**
	 * Update configuration
	 * @param config New configuration options
	 */
	public updateConfig(config: Partial<CacheConfig>): void {
		this.config = { ...this.config, ...config }
	}

	/**
	 * Get current configuration
	 */
	public getConfig(): CacheConfig {
		return { ...this.config }
	}

	/**
	 * Check if an item can be added to cache
	 * @param size Size of item in bytes
	 */
	public canAddToCache(size: number): boolean {
		return this.totalCacheSize + size <= this.config.maxCacheSize
	}

	/**
	 * Add item size to total cache size
	 * @param size Size of item in bytes
	 */
	public addToCacheSize(size: number): void {
		this.totalCacheSize += size
	}

	/**
	 * Remove item size from total cache size
	 * @param size Size of item in bytes
	 */
	public removeFromCacheSize(size: number): void {
		this.totalCacheSize = Math.max(0, this.totalCacheSize - size)
	}

	/**
	 * Get current cache size
	 */
	public getCurrentCacheSize(): number {
		return this.totalCacheSize
	}

	/**
	 * Get maximum cache size
	 */
	public getMaxCacheSize(): number {
		return this.config.maxCacheSize
	}

	/**
	 * Get target cache size after reduction
	 */
	public getTargetCacheSize(): number {
		return (this.config.maxCacheSize * this.config.reductionRatio) / 100
	}

	/**
	 * Check if cache reduction is needed
	 */
	public shouldReduceCache(): boolean {
		const thresholdSize = (this.config.maxCacheSize * this.config.reductionThreshold) / 100
		return this.totalCacheSize > thresholdSize
	}

	/**
	 * Calculate how many bytes should be removed during cache reduction
	 */
	public getReductionAmount(): number {
		if (!this.shouldReduceCache()) {
			return 0
		}

		const targetSize = this.getTargetCacheSize()
		return Math.max(0, this.totalCacheSize - targetSize)
	}

	/**
	 * Calculate item size in bytes
	 * @param item Item to calculate size for
	 */
	public calculateItemSize(item: unknown): number {
		try {
			// Special handling for undefined since JSON.stringify converts it to null
			if (item === undefined) {
				return 9 // Length of the string "undefined"
			}
			return Buffer.byteLength(JSON.stringify(item), "utf8")
		} catch (error) {
			// Handle cases where JSON.stringify might fail (e.g., circular references)
			return 0
		}
	}

	/**
	 * Helper to create a simple LRU tracking object
	 * @param capacity Maximum number of items to track
	 */
	public createLRUTracker<T>(capacity: number = 1000): LRUTracker<T> {
		return new LRUTracker<T>(capacity)
	}
}

/**
 * Simple LRU (Least Recently Used) tracker for cache eviction strategy
 */
export class LRUTracker<T> {
	private items: Map<string, { value: T; timestamp: number }>
	private capacity: number

	/**
	 * Create a new LRU tracker
	 * @param capacity Maximum number of items to track
	 */
	constructor(capacity: number) {
		this.items = new Map()
		this.capacity = capacity
	}

	/**
	 * Add or update an item in the tracker
	 * @param key Item key
	 * @param value Item value
	 */
	public set(key: string, value: T): void {
		// If at capacity and adding new item, remove oldest
		if (this.items.size >= this.capacity && !this.items.has(key)) {
			this.removeOldest()
		}

		this.items.set(key, { value, timestamp: Date.now() })
	}

	/**
	 * Get an item from the tracker
	 * @param key Item key
	 * @returns Item value or undefined if not found
	 */
	public get(key: string): T | undefined {
		const item = this.items.get(key)
		if (item) {
			// Update timestamp on access by recreating the entry
			this.items.set(key, { value: item.value, timestamp: Date.now() })
			return item.value
		}
		return undefined
	}

	/**
	 * Check if an item exists in the tracker
	 * @param key Item key
	 */
	public has(key: string): boolean {
		return this.items.has(key)
	}

	/**
	 * Remove an item from the tracker
	 * @param key Item key
	 */
	public delete(key: string): boolean {
		return this.items.delete(key)
	}

	/**
	 * Get the number of items in the tracker
	 */
	public size(): number {
		return this.items.size
	}

	/**
	 * Clear all items from the tracker
	 */
	public clear(): void {
		this.items.clear()
	}

	/**
	 * Get the oldest items for potential eviction
	 * @param count Number of items to return
	 * @returns Array of [key, value] pairs, oldest first
	 */
	public getOldestItems(count: number = 1): Array<[string, T]> {
		const entries = Array.from(this.items.entries())

		// Sort by timestamp (oldest first)
		entries.sort((a, b) => a[1].timestamp - b[1].timestamp)

		// Return the requested number of oldest items
		return entries.slice(0, count).map(([key, item]) => [key, item.value])
	}

	/**
	 * Remove the oldest item from the tracker
	 * @returns The key of the removed item, or undefined if tracker was empty
	 */
	private removeOldest(): string | undefined {
		const oldest = this.getOldestItems(1)
		if (oldest.length > 0) {
			const [key] = oldest[0]
			this.items.delete(key)
			return key
		}
		return undefined
	}
}
