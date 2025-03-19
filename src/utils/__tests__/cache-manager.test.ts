import { CacheManager, LRUTracker } from "../cache-manager"

describe("CacheManager", () => {
	beforeEach(() => {
		// Reset the singleton instance before each test
		CacheManager.resetInstance()
	})

	describe("singleton pattern", () => {
		it("should create a singleton instance", () => {
			const instance1 = CacheManager.getInstance()
			const instance2 = CacheManager.getInstance()

			expect(instance1).toBe(instance2)
		})

		it("should apply configuration on first getInstance call", () => {
			const customConfig = {
				maxCacheSize: 50 * 1024 * 1024,
				reductionRatio: 60,
				reductionThreshold: 85,
			}

			const instance = CacheManager.getInstance(customConfig)
			const config = instance.getConfig()

			expect(config.maxCacheSize).toBe(customConfig.maxCacheSize)
			expect(config.reductionRatio).toBe(customConfig.reductionRatio)
			expect(config.reductionThreshold).toBe(customConfig.reductionThreshold)
		})

		it("should ignore configuration on subsequent getInstance calls", () => {
			// First call with initial config
			const initialConfig = {
				maxCacheSize: 50 * 1024 * 1024,
				reductionRatio: 60,
				reductionThreshold: 85,
			}

			CacheManager.getInstance(initialConfig)

			// Second call with different config (should be ignored)
			const newConfig = {
				maxCacheSize: 20 * 1024 * 1024,
				reductionRatio: 50,
				reductionThreshold: 75,
			}

			const instance = CacheManager.getInstance(newConfig)
			const config = instance.getConfig()

			// Should still have initial config values
			expect(config.maxCacheSize).toBe(initialConfig.maxCacheSize)
			expect(config.reductionRatio).toBe(initialConfig.reductionRatio)
			expect(config.reductionThreshold).toBe(initialConfig.reductionThreshold)
		})

		it("should allow updating configuration after creation", () => {
			const instance = CacheManager.getInstance()

			const newConfig = {
				maxCacheSize: 20 * 1024 * 1024,
				reductionRatio: 50,
			}

			instance.updateConfig(newConfig)
			const config = instance.getConfig()

			expect(config.maxCacheSize).toBe(newConfig.maxCacheSize)
			expect(config.reductionRatio).toBe(newConfig.reductionRatio)
			// Threshold should remain at default
			expect(config.reductionThreshold).toBe(90)
		})
	})

	describe("cache size management", () => {
		it("should track cache size correctly", () => {
			const cacheManager = CacheManager.getInstance()

			cacheManager.addToCacheSize(1000)
			expect(cacheManager.getCurrentCacheSize()).toBe(1000)

			cacheManager.addToCacheSize(500)
			expect(cacheManager.getCurrentCacheSize()).toBe(1500)

			cacheManager.removeFromCacheSize(700)
			expect(cacheManager.getCurrentCacheSize()).toBe(800)
		})

		it("should prevent negative cache size", () => {
			const cacheManager = CacheManager.getInstance()

			cacheManager.addToCacheSize(1000)
			cacheManager.removeFromCacheSize(2000)
			expect(cacheManager.getCurrentCacheSize()).toBe(0)
		})

		it("should check if items can be added to cache", () => {
			const cacheManager = CacheManager.getInstance({
				maxCacheSize: 10000,
			})

			expect(cacheManager.canAddToCache(5000)).toBe(true)

			cacheManager.addToCacheSize(6000)
			expect(cacheManager.canAddToCache(5000)).toBe(false)
			expect(cacheManager.canAddToCache(4000)).toBe(true)
		})
	})

	describe("cache reduction", () => {
		it("should calculate target cache size correctly", () => {
			const cacheManager = CacheManager.getInstance({
				maxCacheSize: 10000,
				reductionRatio: 70,
			})

			expect(cacheManager.getTargetCacheSize()).toBe(7000) // 70% of 10000
		})

		it("should detect when cache reduction is needed", () => {
			const cacheManager = CacheManager.getInstance({
				maxCacheSize: 10000,
				reductionThreshold: 80,
			})

			// Below threshold
			cacheManager.addToCacheSize(7000)
			expect(cacheManager.shouldReduceCache()).toBe(false)

			// At threshold
			cacheManager.addToCacheSize(1000)
			expect(cacheManager.getCurrentCacheSize()).toBe(8000)
			expect(cacheManager.shouldReduceCache()).toBe(false)

			// Above threshold
			cacheManager.addToCacheSize(1000)
			expect(cacheManager.getCurrentCacheSize()).toBe(9000)
			expect(cacheManager.shouldReduceCache()).toBe(true)
		})

		it("should calculate reduction amount correctly", () => {
			const cacheManager = CacheManager.getInstance({
				maxCacheSize: 10000,
				reductionRatio: 60,
				reductionThreshold: 80,
			})

			// Below threshold - no reduction needed
			cacheManager.addToCacheSize(7000)
			expect(cacheManager.getReductionAmount()).toBe(0)

			// Above threshold - calculate reduction amount
			cacheManager.addToCacheSize(3000) // Total: 10000

			// Target is 60% of max (6000), so reduction amount is 10000 - 6000 = 4000
			expect(cacheManager.getReductionAmount()).toBe(4000)
		})
	})

	describe("item size calculation", () => {
		it("should calculate size of simple items", () => {
			const cacheManager = CacheManager.getInstance()

			expect(cacheManager.calculateItemSize("test")).toBe(6)
			expect(cacheManager.calculateItemSize(123)).toBe(3)
			expect(cacheManager.calculateItemSize(true)).toBe(4)
		})

		it("should calculate size of complex objects", () => {
			const cacheManager = CacheManager.getInstance()

			const obj = {
				string: "test",
				number: 123,
				boolean: true,
				array: [1, 2, 3],
				nested: {
					value: "nested",
				},
			}

			const size = cacheManager.calculateItemSize(obj)
			expect(size).toBeGreaterThan(0)
		})

		it("should handle empty values", () => {
			const cacheManager = CacheManager.getInstance()

			expect(cacheManager.calculateItemSize("")).toBe(2)
			expect(cacheManager.calculateItemSize(null)).toBe(4)
			expect(cacheManager.calculateItemSize(undefined)).toBe(9)
			expect(cacheManager.calculateItemSize({})).toBe(2)
			expect(cacheManager.calculateItemSize([])).toBe(2)
		})
	})
})

describe("LRUTracker", () => {
	it("should track items with timestamps", () => {
		const lruTracker = new LRUTracker<string>(5)

		lruTracker.set("key1", "value1")
		expect(lruTracker.has("key1")).toBe(true)
		expect(lruTracker.get("key1")).toBe("value1")
	})

	it("should update timestamps on access", () => {
		jest.useFakeTimers()

		const lruTracker = new LRUTracker<string>(5)

		// Add first item
		lruTracker.set("key1", "value1")

		// Advance time
		jest.advanceTimersByTime(1000)

		// Add second item
		lruTracker.set("key2", "value2")

		// key1 should be older than key2
		const oldestItems = lruTracker.getOldestItems(2)
		expect(oldestItems[0][0]).toBe("key1")
		expect(oldestItems[1][0]).toBe("key2")

		// Advance time again
		jest.advanceTimersByTime(1000)

		// Access key1, updating its timestamp
		lruTracker.get("key1")

		// Now key2 should be older than key1
		const newOldestItems = lruTracker.getOldestItems(2)
		expect(newOldestItems[0][0]).toBe("key2")
		expect(newOldestItems[1][0]).toBe("key1")

		jest.useRealTimers()
	})

	it("should respect capacity limit", () => {
		const lruTracker = new LRUTracker<string>(3)

		lruTracker.set("key1", "value1")
		lruTracker.set("key2", "value2")
		lruTracker.set("key3", "value3")

		// All three items should be present
		expect(lruTracker.size()).toBe(3)

		// Adding a fourth item should evict the oldest (key1)
		lruTracker.set("key4", "value4")

		expect(lruTracker.size()).toBe(3)
		expect(lruTracker.has("key1")).toBe(false)
		expect(lruTracker.has("key2")).toBe(true)
		expect(lruTracker.has("key3")).toBe(true)
		expect(lruTracker.has("key4")).toBe(true)
	})

	it("should get oldest items correctly", () => {
		jest.useFakeTimers()

		const lruTracker = new LRUTracker<string>(5)

		// Add items with increasing timestamps
		lruTracker.set("key1", "value1")
		jest.advanceTimersByTime(100)
		lruTracker.set("key2", "value2")
		jest.advanceTimersByTime(100)
		lruTracker.set("key3", "value3")
		jest.advanceTimersByTime(100)
		lruTracker.set("key4", "value4")
		jest.advanceTimersByTime(100)
		lruTracker.set("key5", "value5")

		// Get the 3 oldest items
		const oldestItems = lruTracker.getOldestItems(3)

		expect(oldestItems.length).toBe(3)
		expect(oldestItems[0][0]).toBe("key1")
		expect(oldestItems[1][0]).toBe("key2")
		expect(oldestItems[2][0]).toBe("key3")

		jest.useRealTimers()
	})

	it("should handle item deletion", () => {
		const lruTracker = new LRUTracker<string>(5)

		lruTracker.set("key1", "value1")
		lruTracker.set("key2", "value2")

		expect(lruTracker.size()).toBe(2)

		lruTracker.delete("key1")

		expect(lruTracker.size()).toBe(1)
		expect(lruTracker.has("key1")).toBe(false)
		expect(lruTracker.has("key2")).toBe(true)
	})

	it("should clear all items", () => {
		const lruTracker = new LRUTracker<string>(5)

		lruTracker.set("key1", "value1")
		lruTracker.set("key2", "value2")

		expect(lruTracker.size()).toBe(2)

		lruTracker.clear()

		expect(lruTracker.size()).toBe(0)
		expect(lruTracker.has("key1")).toBe(false)
		expect(lruTracker.has("key2")).toBe(false)
	})
})
