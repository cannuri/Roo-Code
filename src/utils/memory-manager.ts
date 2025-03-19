import { getSystemMemoryUsage } from "./system"

/**
 * Memory pressure levels
 */
export enum MemoryPressureLevel {
	NORMAL = "NORMAL",
	ELEVATED = "ELEVATED",
	CRITICAL = "CRITICAL",
}

/**
 * Memory manager configuration
 */
export interface MemoryManagerConfig {
	/** Threshold for elevated memory pressure (percentage) */
	elevatedThreshold: number
	/** Threshold for critical memory pressure (percentage) */
	criticalThreshold: number
	/** Minimum time between GC hints (ms) */
	gcMinInterval: number
	/** Maximum cache size in bytes */
	maxCacheSize: number
	/** Target cache size after cleanup (percentage of max) */
	targetCacheSize: number
}

/**
 * Manages memory usage and provides pressure level information
 */
export class MemoryManager {
	private static instance: MemoryManager | null = null
	private lastGcTime: number = 0
	private pressureLevel: MemoryPressureLevel = MemoryPressureLevel.NORMAL
	private totalCacheSize: number = 0
	private pressureHandlers: Set<(level: MemoryPressureLevel) => void> = new Set()

	private readonly config: MemoryManagerConfig = {
		elevatedThreshold: 75,
		criticalThreshold: 85,
		gcMinInterval: 30000, // 30 seconds
		maxCacheSize: 100 * 1024 * 1024, // 100MB
		targetCacheSize: 80, // 80% of max after cleanup
	}

	private constructor() {
		this.startMonitoring()
	}

	/**
	 * Get singleton instance
	 */
	public static getInstance(): MemoryManager {
		if (!MemoryManager.instance) {
			MemoryManager.instance = new MemoryManager()
		}
		return MemoryManager.instance
	}

	/**
	 * Start memory pressure monitoring
	 */
	private startMonitoring(): void {
		setInterval(() => {
			this.checkMemoryPressure()
		}, 5000) // Check every 5 seconds
	}

	/**
	 * Check current memory pressure level
	 */
	private checkMemoryPressure(): void {
		const memoryUsage = getSystemMemoryUsage()
		const oldLevel = this.pressureLevel

		if (memoryUsage >= this.config.criticalThreshold) {
			this.pressureLevel = MemoryPressureLevel.CRITICAL
		} else if (memoryUsage >= this.config.elevatedThreshold) {
			this.pressureLevel = MemoryPressureLevel.ELEVATED
		} else {
			this.pressureLevel = MemoryPressureLevel.NORMAL
		}

		if (oldLevel !== this.pressureLevel) {
			this.notifyPressureHandlers()
		}

		if (this.pressureLevel === MemoryPressureLevel.CRITICAL) {
			this.handleCriticalPressure()
		}
	}

	/**
	 * Handle critical memory pressure
	 */
	private handleCriticalPressure(): void {
		const now = Date.now()
		if (now - this.lastGcTime >= this.config.gcMinInterval) {
			this.lastGcTime = now
			global.gc?.()
		}
	}

	/**
	 * Notify registered pressure handlers
	 */
	private notifyPressureHandlers(): void {
		for (const handler of this.pressureHandlers) {
			try {
				handler(this.pressureLevel)
			} catch (error) {
				console.error("Error in memory pressure handler:", error)
			}
		}
	}

	/**
	 * Register a memory pressure handler
	 */
	public onPressureChange(handler: (level: MemoryPressureLevel) => void): void {
		this.pressureHandlers.add(handler)
	}

	/**
	 * Unregister a memory pressure handler
	 */
	public offPressureChange(handler: (level: MemoryPressureLevel) => void): void {
		this.pressureHandlers.delete(handler)
	}

	/**
	 * Get current memory pressure level
	 */
	public getPressureLevel(): MemoryPressureLevel {
		return this.pressureLevel
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
	 * Get target cache size for cleanup
	 */
	public getTargetCacheSize(): number {
		return (this.config.maxCacheSize * this.config.targetCacheSize) / 100
	}

	/**
	 * Get current cache size
	 */
	public getCurrentCacheSize(): number {
		return this.totalCacheSize
	}

	/**
	 * Check if cache cleanup is needed
	 */
	public needsCleanup(): boolean {
		return this.totalCacheSize > this.getTargetCacheSize() || this.pressureLevel !== MemoryPressureLevel.NORMAL
	}

	/**
	 * Calculate item size in bytes
	 * @param item Item to calculate size for
	 */
	public calculateItemSize(item: unknown): number {
		return Buffer.byteLength(JSON.stringify(item), "utf8")
	}

	/**
	 * Dispose memory manager
	 */
	public dispose(): void {
		this.pressureHandlers.clear()
	}
}
