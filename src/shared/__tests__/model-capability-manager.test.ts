import { ModelCapabilityManager } from "../model-capability-manager"
import { determineModelCapabilities, Capability, CapabilityStrength } from "../model-capabilities"
import { Lock } from "../../utils/lock"
import { ValidationError } from "../errors"

// Mock dependencies
jest.mock("../model-capabilities", () => ({
	determineModelCapabilities: jest.fn(),
	MODEL_CAPABILITIES: {
		"claude-3": {
			capabilities: ["computerUse", "imageAnalysis"],
			info: {
				computerUse: { version: "2.0", strength: "advanced" },
				imageAnalysis: { version: "1.0", strength: "advanced" },
			},
		},
		"gpt-4": {
			capabilities: ["computerUse"],
			info: {
				computerUse: { version: "1.0", strength: "basic" },
			},
		},
	},
	Capability: ["computerUse", "imageAnalysis"],
}))

jest.mock("../../utils/lock")
jest.mock("../../services/telemetry/TelemetryService", () => ({
	telemetryService: {
		captureEvent: jest.fn(),
	},
}))
jest.mock("../../utils/logging", () => ({
	logger: {
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
	},
}))

describe("ModelCapabilityManager", () => {
	// Create a real instance for testing
	let manager: ModelCapabilityManager

	// Reset singletons before each test
	beforeEach(() => {
		jest.clearAllMocks()
		ModelCapabilityManager.resetInstance()

		// Setup mocks
		const mockDetermineCapabilities = determineModelCapabilities as jest.MockedFunction<
			typeof determineModelCapabilities
		>
		mockDetermineCapabilities.mockReturnValue({
			supportedCapabilities: new Set<Capability>(["computerUse"]),
			capabilityVersions: { computerUse: "1.0", imageAnalysis: "" },
			capabilityStrength: {
				computerUse: "basic" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		})

		// Mock Lock
		const mockLock = Lock as jest.MockedClass<typeof Lock>
		mockLock.prototype.withLock.mockImplementation(async (fn) => fn())

		// Create a fresh instance for each test
		manager = ModelCapabilityManager.getInstance({
			maxCacheSize: 10,
			cacheLifetime: 1000,
		})
	})

	test("getInstance should return singleton instance", () => {
		const instance1 = ModelCapabilityManager.getInstance()
		const instance2 = ModelCapabilityManager.getInstance()
		expect(instance1).toBe(instance2)
	})

	test("getInstance should accept configuration", () => {
		const instance = ModelCapabilityManager.getInstance({
			maxCacheSize: 500,
			cacheLifetime: 30 * 60 * 1000,
		})

		// We can't directly test private fields, but we can test behavior
		expect(instance).toBeDefined()
	})

	test("createEmptyCapabilityRecords should return empty records", () => {
		const records = manager.createEmptyCapabilityRecords()

		expect(records.supportedCapabilities.size).toBe(0)
		expect(records.capabilityVersions).toHaveProperty("computerUse")
		expect(records.capabilityVersions).toHaveProperty("imageAnalysis")
		expect(records.capabilityStrength).toHaveProperty("computerUse")
		expect(records.capabilityStrength).toHaveProperty("imageAnalysis")
	})

	test("determineCapabilities should validate input parameters", async () => {
		// Missing API configuration
		await expect(manager.determineCapabilities({} as any)).rejects.toThrow(ValidationError)
	})

	test("determineCapabilities should call determineModelCapabilities", async () => {
		const mockDetermineCapabilities = determineModelCapabilities as jest.MockedFunction<
			typeof determineModelCapabilities
		>

		const expectedCapabilities = {
			supportedCapabilities: new Set<Capability>(["computerUse"]),
			capabilityVersions: { computerUse: "1.0", imageAnalysis: "" },
			capabilityStrength: {
				computerUse: "basic" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		}

		mockDetermineCapabilities.mockReturnValue(expectedCapabilities)

		const result = await manager.determineCapabilities({
			apiConfiguration: { apiModelId: "gpt-4" },
			browserToolEnabled: true,
		})

		expect(result).toEqual(expectedCapabilities)
		expect(mockDetermineCapabilities).toHaveBeenCalledWith({
			apiConfiguration: { apiModelId: "gpt-4" },
			browserToolEnabled: true,
		})
	})

	test("determineCapabilities should handle errors", async () => {
		const mockDetermineCapabilities = determineModelCapabilities as jest.MockedFunction<
			typeof determineModelCapabilities
		>

		mockDetermineCapabilities.mockImplementation(() => {
			throw new Error("Test error")
		})

		await expect(
			manager.determineCapabilities({
				apiConfiguration: { apiModelId: "gpt-4" },
			}),
		).rejects.toThrow("Test error")
	})

	test("supportsComputerUse should check if computerUse is supported", () => {
		const capabilities = {
			supportedCapabilities: new Set<Capability>(["computerUse"]),
			capabilityVersions: { computerUse: "1.0", imageAnalysis: "" },
			capabilityStrength: {
				computerUse: "basic" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		}

		expect(manager.supportsComputerUse(capabilities)).toBe(true)

		const noComputerUse = {
			supportedCapabilities: new Set<Capability>(["imageAnalysis"]),
			capabilityVersions: { computerUse: "", imageAnalysis: "1.0" },
			capabilityStrength: {
				computerUse: "basic" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		}

		expect(manager.supportsComputerUse(noComputerUse)).toBe(false)
	})

	test("getFromCache and addToCache should work together", async () => {
		const cacheKey = "test-key"

		// Initially cache should be empty
		expect(await manager.getFromCache(cacheKey)).toBeUndefined()

		// Add to cache
		const capabilities = {
			supportedCapabilities: new Set<Capability>(["computerUse"]),
			capabilityVersions: { computerUse: "1.0", imageAnalysis: "" },
			capabilityStrength: {
				computerUse: "basic" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		}

		await manager.addToCache(cacheKey, capabilities)

		// Now should return from cache
		const result = await manager.getFromCache(cacheKey)
		expect(result).toEqual(capabilities)
	})

	test("getCacheSize should return current cache size", async () => {
		// Initially empty
		expect(manager.getCacheSize()).toBe(0)

		const capabilities = {
			supportedCapabilities: new Set<Capability>(["computerUse"]),
			capabilityVersions: { computerUse: "1.0", imageAnalysis: "" },
			capabilityStrength: {
				computerUse: "basic" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		}

		// Add two entries
		await manager.addToCache("key1", capabilities)
		await manager.addToCache("key2", capabilities)

		expect(manager.getCacheSize()).toBe(2)
	})

	test("clearCache should empty the cache", async () => {
		const capabilities = {
			supportedCapabilities: new Set<Capability>(["computerUse"]),
			capabilityVersions: { computerUse: "1.0", imageAnalysis: "" },
			capabilityStrength: {
				computerUse: "basic" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		}

		// Add entries
		await manager.addToCache("key1", capabilities)
		await manager.addToCache("key2", capabilities)

		expect(manager.getCacheSize()).toBe(2)

		// Clear cache
		await manager.clearCache()

		expect(manager.getCacheSize()).toBe(0)
	})

	test("dispose should clean up resources", () => {
		// Add a spy to clearInterval
		const clearIntervalSpy = jest.spyOn(global, "clearInterval")

		manager.dispose()

		// Should have called clearInterval for the cleanup timer
		expect(clearIntervalSpy).toHaveBeenCalled()

		// Cache should be cleared
		expect(manager.getCacheSize()).toBe(0)

		clearIntervalSpy.mockRestore()
	})
})
