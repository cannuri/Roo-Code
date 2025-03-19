import * as os from "os"
import { getSystemMemoryUsage, getDetailedMemoryInfo, isUnderHighMemoryPressure } from "../system"

// Mock os module
jest.mock("os", () => ({
	totalmem: jest.fn(),
	freemem: jest.fn(),
}))

describe("System Utils", () => {
	const mockOs = os as jest.Mocked<typeof os>

	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("getSystemMemoryUsage", () => {
		it("should calculate memory usage percentage correctly", () => {
			mockOs.totalmem.mockReturnValue(1000)
			mockOs.freemem.mockReturnValue(400)

			const usage = getSystemMemoryUsage()
			expect(usage).toBe(60) // (1000-400)/1000 * 100 = 60%
		})

		it("should handle zero total memory", () => {
			mockOs.totalmem.mockReturnValue(0)
			mockOs.freemem.mockReturnValue(0)

			const usage = getSystemMemoryUsage()
			expect(usage).toBe(0)
		})

		it("should handle edge cases", () => {
			// All memory free
			mockOs.totalmem.mockReturnValue(1000)
			mockOs.freemem.mockReturnValue(1000)
			expect(getSystemMemoryUsage()).toBe(0)

			// No memory free
			mockOs.totalmem.mockReturnValue(1000)
			mockOs.freemem.mockReturnValue(0)
			expect(getSystemMemoryUsage()).toBe(100)
		})
	})

	describe("getDetailedMemoryInfo", () => {
		beforeEach(() => {
			mockOs.totalmem.mockReturnValue(16000000000) // 16GB
			mockOs.freemem.mockReturnValue(8000000000) // 8GB
		})

		it("should return detailed memory information", () => {
			const info = getDetailedMemoryInfo()

			expect(info).toEqual({
				total: 16000000000,
				free: 8000000000,
				used: 8000000000,
				percentUsed: 50,
				processUsage: expect.any(Object),
			})
		})

		it("should include process memory usage", () => {
			const info = getDetailedMemoryInfo()

			expect(info.processUsage).toHaveProperty("heapTotal")
			expect(info.processUsage).toHaveProperty("heapUsed")
			expect(info.processUsage).toHaveProperty("external")
			expect(info.processUsage).toHaveProperty("arrayBuffers")
		})
	})

	describe("isUnderHighMemoryPressure", () => {
		it("should detect high memory pressure", () => {
			mockOs.totalmem.mockReturnValue(1000)
			mockOs.freemem.mockReturnValue(100)

			expect(isUnderHighMemoryPressure()).toBe(true)
		})

		it("should respect custom threshold", () => {
			mockOs.totalmem.mockReturnValue(1000)
			mockOs.freemem.mockReturnValue(500)

			expect(isUnderHighMemoryPressure(40)).toBe(true) // 50% used > 40% threshold
			expect(isUnderHighMemoryPressure(60)).toBe(false) // 50% used < 60% threshold
		})

		it("should handle edge cases", () => {
			// No memory pressure
			mockOs.totalmem.mockReturnValue(1000)
			mockOs.freemem.mockReturnValue(1000)
			expect(isUnderHighMemoryPressure()).toBe(false)

			// Maximum memory pressure
			mockOs.totalmem.mockReturnValue(1000)
			mockOs.freemem.mockReturnValue(0)
			expect(isUnderHighMemoryPressure()).toBe(true)
		})

		it("should validate threshold values", () => {
			mockOs.totalmem.mockReturnValue(1000)
			mockOs.freemem.mockReturnValue(500)

			// Default threshold (85%)
			expect(isUnderHighMemoryPressure()).toBe(false)

			// Various thresholds
			expect(isUnderHighMemoryPressure(0)).toBe(true) // Always high pressure
			expect(isUnderHighMemoryPressure(100)).toBe(false) // Never high pressure
			expect(isUnderHighMemoryPressure(50)).toBe(false) // Exactly at threshold
		})
	})
})
