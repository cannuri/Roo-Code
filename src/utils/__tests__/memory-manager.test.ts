import { MemoryManager, MemoryPressureLevel } from "../memory-manager"
import { getSystemMemoryUsage } from "../system"

// Mock system module
jest.mock("../system", () => ({
	getSystemMemoryUsage: jest.fn(),
}))

describe("MemoryManager", () => {
	let memoryManager: MemoryManager
	const mockGetSystemMemoryUsage = getSystemMemoryUsage as jest.MockedFunction<typeof getSystemMemoryUsage>

	beforeEach(() => {
		jest.useFakeTimers()
		mockGetSystemMemoryUsage.mockReturnValue(50) // Default to normal pressure
		memoryManager = MemoryManager.getInstance()
	})

	afterEach(() => {
		jest.clearAllMocks()
		jest.useRealTimers()
		memoryManager.dispose()
	})

	describe("pressure level detection", () => {
		it("should start with normal pressure", () => {
			expect(memoryManager.getPressureLevel()).toBe(MemoryPressureLevel.NORMAL)
		})

		it("should detect elevated pressure", () => {
			mockGetSystemMemoryUsage.mockReturnValue(80)
			jest.advanceTimersByTime(5000)
			expect(memoryManager.getPressureLevel()).toBe(MemoryPressureLevel.ELEVATED)
		})

		it("should detect critical pressure", () => {
			mockGetSystemMemoryUsage.mockReturnValue(90)
			jest.advanceTimersByTime(5000)
			expect(memoryManager.getPressureLevel()).toBe(MemoryPressureLevel.CRITICAL)
		})

		it("should notify handlers of pressure changes", () => {
			const handler = jest.fn()
			memoryManager.onPressureChange(handler)

			mockGetSystemMemoryUsage.mockReturnValue(80)
			jest.advanceTimersByTime(5000)
			expect(handler).toHaveBeenCalledWith(MemoryPressureLevel.ELEVATED)

			mockGetSystemMemoryUsage.mockReturnValue(90)
			jest.advanceTimersByTime(5000)
			expect(handler).toHaveBeenCalledWith(MemoryPressureLevel.CRITICAL)
		})

		it("should handle handler removal", () => {
			const handler = jest.fn()
			memoryManager.onPressureChange(handler)
			memoryManager.offPressureChange(handler)

			mockGetSystemMemoryUsage.mockReturnValue(80)
			jest.advanceTimersByTime(5000)
			expect(handler).not.toHaveBeenCalled()
		})
	})

	describe("cache size management", () => {
		it("should track cache size correctly", () => {
			memoryManager.addToCacheSize(1000)
			expect(memoryManager.getCurrentCacheSize()).toBe(1000)

			memoryManager.addToCacheSize(500)
			expect(memoryManager.getCurrentCacheSize()).toBe(1500)

			memoryManager.removeFromCacheSize(700)
			expect(memoryManager.getCurrentCacheSize()).toBe(800)
		})

		it("should prevent negative cache size", () => {
			memoryManager.addToCacheSize(1000)
			memoryManager.removeFromCacheSize(2000)
			expect(memoryManager.getCurrentCacheSize()).toBe(0)
		})

		it("should check if items can be added to cache", () => {
			const maxSize = 100 * 1024 * 1024 // 100MB
			expect(memoryManager.canAddToCache(maxSize - 1000)).toBe(true)
			expect(memoryManager.canAddToCache(maxSize + 1000)).toBe(false)
		})

		it("should calculate target cache size", () => {
			const maxSize = 100 * 1024 * 1024 // 100MB
			const targetSize = (maxSize * 80) / 100 // 80% of max
			expect(memoryManager.getTargetCacheSize()).toBe(targetSize)
		})

		it("should detect when cleanup is needed", () => {
			// Add items up to target size
			const targetSize = memoryManager.getTargetCacheSize()
			memoryManager.addToCacheSize(targetSize)
			expect(memoryManager.needsCleanup()).toBe(false)

			// Add more items
			memoryManager.addToCacheSize(1000)
			expect(memoryManager.needsCleanup()).toBe(true)

			// Should also need cleanup under memory pressure
			memoryManager.removeFromCacheSize(memoryManager.getCurrentCacheSize())
			mockGetSystemMemoryUsage.mockReturnValue(80)
			jest.advanceTimersByTime(5000)
			expect(memoryManager.needsCleanup()).toBe(true)
		})
	})

	describe("item size calculation", () => {
		it("should calculate size of simple items", () => {
			expect(memoryManager.calculateItemSize("test")).toBe(6)
			expect(memoryManager.calculateItemSize(123)).toBe(3)
			expect(memoryManager.calculateItemSize(true)).toBe(4)
		})

		it("should calculate size of complex objects", () => {
			const obj = {
				string: "test",
				number: 123,
				boolean: true,
				array: [1, 2, 3],
				nested: {
					value: "nested",
				},
			}
			const size = memoryManager.calculateItemSize(obj)
			expect(size).toBeGreaterThan(0)
		})

		it("should handle empty values", () => {
			expect(memoryManager.calculateItemSize("")).toBe(2)
			expect(memoryManager.calculateItemSize(null)).toBe(4)
			expect(memoryManager.calculateItemSize(undefined)).toBe(9)
			expect(memoryManager.calculateItemSize({})).toBe(2)
			expect(memoryManager.calculateItemSize([])).toBe(2)
		})
	})

	describe("garbage collection", () => {
		beforeEach(() => {
			global.gc = jest.fn()
		})

		afterEach(() => {
			delete global.gc
		})

		it("should trigger GC under critical pressure", () => {
			mockGetSystemMemoryUsage.mockReturnValue(90)
			jest.advanceTimersByTime(5000)
			expect(global.gc).toHaveBeenCalled()
		})

		it("should respect minimum GC interval", () => {
			mockGetSystemMemoryUsage.mockReturnValue(90)
			jest.advanceTimersByTime(5000)
			expect(global.gc).toHaveBeenCalledTimes(1)

			jest.advanceTimersByTime(5000)
			expect(global.gc).toHaveBeenCalledTimes(1) // Should not call again within interval

			jest.advanceTimersByTime(30000)
			expect(global.gc).toHaveBeenCalledTimes(2) // Should call after interval
		})
	})

	describe("error handling", () => {
		it("should handle handler errors gracefully", () => {
			const errorHandler = jest.fn(() => {
				throw new Error("Handler error")
			})
			const successHandler = jest.fn()

			memoryManager.onPressureChange(errorHandler)
			memoryManager.onPressureChange(successHandler)

			mockGetSystemMemoryUsage.mockReturnValue(80)
			jest.advanceTimersByTime(5000)

			expect(successHandler).toHaveBeenCalled()
		})

		it("should handle missing GC function", () => {
			delete global.gc
			mockGetSystemMemoryUsage.mockReturnValue(90)
			jest.advanceTimersByTime(5000)
			// Should not throw
		})
	})
})
