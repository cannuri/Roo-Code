import { CapabilityService } from "../capability-service"
import { ModelCapabilities, Capability, CapabilityStrength } from "../model-capabilities"
import { RateLimitError, TimeoutError, ValidationError } from "../errors"

// Mock dependencies
jest.mock("../model-capability-manager", () => ({
	ModelCapabilityManager: {
		getInstance: jest.fn().mockReturnValue({
			determineCapabilities: jest.fn(),
			getFromCache: jest.fn(),
			addToCache: jest.fn(),
			getCacheSize: jest.fn(),
			clearCache: jest.fn(),
			dispose: jest.fn(),
		}),
		resetInstance: jest.fn(),
	},
}))

jest.mock("../../utils/cache-manager", () => ({
	CacheManager: {
		getInstance: jest.fn().mockReturnValue({
			canAddToCache: jest.fn().mockReturnValue(true),
			addToCacheSize: jest.fn(),
			removeFromCacheSize: jest.fn(),
			getCurrentCacheSize: jest.fn().mockReturnValue(0),
			getMaxCacheSize: jest.fn().mockReturnValue(1000000),
			shouldReduceCache: jest.fn().mockReturnValue(false),
		}),
		resetInstance: jest.fn(),
	},
}))

jest.mock("../../utils/lock", () => ({
	Lock: jest.fn().mockImplementation(() => ({
		acquire: jest.fn().mockResolvedValue(undefined),
		release: jest.fn(),
		withLock: jest.fn().mockImplementation((fn) => fn()),
	})),
}))

jest.mock("../../utils/retry-handler", () => ({
	RetryHandler: jest.fn().mockImplementation(() => ({
		execute: jest.fn().mockImplementation((fn) => fn()),
		executeWithResult: jest.fn(),
	})),
}))

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

// Import mocked modules
import { ModelCapabilityManager } from "../model-capability-manager"
import { CacheManager } from "../../utils/cache-manager"
import { Lock } from "../../utils/lock"
import { RetryHandler } from "../../utils/retry-handler"

describe("CapabilityService", () => {
	// Get mock implementations
	const mockManager = ModelCapabilityManager.getInstance() as jest.Mocked<any>
	const mockCacheManager = CacheManager.getInstance() as jest.Mocked<any>
	const mockLock = new Lock() as jest.Mocked<any>
	const mockRetryHandler = new RetryHandler({} as any) as jest.Mocked<any>

	// Reset before each test
	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Setup default mock returns
		mockManager.determineCapabilities.mockResolvedValue({
			supportedCapabilities: new Set<Capability>(["computerUse"]),
			capabilityVersions: { computerUse: "1.0", imageAnalysis: "" },
			capabilityStrength: {
				computerUse: "basic" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		})
		mockManager.getFromCache.mockResolvedValue(undefined)
		mockManager.getCacheSize.mockReturnValue(10)

		// Reset singleton by directly setting the instance to null
		// @ts-ignore - Accessing private static property for testing
		CapabilityService.instance = null
	})

	test("getInstance should return singleton instance", () => {
		const instance1 = CapabilityService.getInstance()
		const instance2 = CapabilityService.getInstance()
		expect(instance1).toBe(instance2)
	})

	test("getInstanceAsync should return singleton instance", async () => {
		const instance1 = await CapabilityService.getInstanceAsync()
		const instance2 = await CapabilityService.getInstanceAsync()
		expect(instance1).toBe(instance2)
	})

	test("determineCapabilities should validate input parameters", async () => {
		const service = CapabilityService.getInstance()

		// Missing API configuration
		await expect(
			service.determineCapabilities({
				apiConfiguration: undefined as any,
			}),
		).rejects.toThrow(ValidationError)

		// Model ID too long
		const longModelId = "a".repeat(101)
		await expect(
			service.determineCapabilities({
				apiConfiguration: { apiModelId: longModelId },
			}),
		).rejects.toThrow(ValidationError)

		// Invalid characters in model ID
		await expect(
			service.determineCapabilities({
				apiConfiguration: { apiModelId: "model<script>" },
			}),
		).rejects.toThrow(ValidationError)
	})

	test("determineCapabilities should return capabilities from manager", async () => {
		const service = CapabilityService.getInstance()

		const expectedCapabilities: ModelCapabilities = {
			supportedCapabilities: new Set<Capability>(["computerUse"]),
			capabilityVersions: { computerUse: "1.0", imageAnalysis: "" },
			capabilityStrength: {
				computerUse: "basic" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		}

		mockManager.determineCapabilities.mockResolvedValue(expectedCapabilities)

		const result = await service.determineCapabilities({
			apiConfiguration: { apiModelId: "gpt-4" },
		})

		expect(result).toEqual(expectedCapabilities)
		expect(mockManager.determineCapabilities).toHaveBeenCalledWith(
			expect.objectContaining({
				apiConfiguration: { apiModelId: "gpt-4" },
			}),
		)
	})

	test("determineCapabilities should use cache when available", async () => {
		const service = CapabilityService.getInstance()

		const cachedCapabilities: ModelCapabilities = {
			supportedCapabilities: new Set<Capability>(["computerUse", "imageAnalysis"]),
			capabilityVersions: { computerUse: "2.0", imageAnalysis: "1.0" },
			capabilityStrength: {
				computerUse: "advanced" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		}

		mockManager.getFromCache.mockResolvedValue(cachedCapabilities)

		const result = await service.determineCapabilities({
			apiConfiguration: { apiModelId: "claude-3" },
			browserToolEnabled: true,
		})

		expect(result).toEqual(cachedCapabilities)
		expect(mockManager.getFromCache).toHaveBeenCalledWith("claude-3:1")
		expect(mockManager.determineCapabilities).not.toHaveBeenCalled()
	})

	test("hasCapability should check if capability is supported", () => {
		const service = CapabilityService.getInstance()

		const capabilities: ModelCapabilities = {
			supportedCapabilities: new Set<Capability>(["computerUse"]),
			capabilityVersions: { computerUse: "1.0", imageAnalysis: "" },
			capabilityStrength: {
				computerUse: "basic" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		}

		expect(service.hasCapability(capabilities, "computerUse")).toBe(true)
		expect(service.hasCapability(capabilities, "imageAnalysis")).toBe(false)
	})

	test("supportsComputerUse should check if computerUse is supported", () => {
		const service = CapabilityService.getInstance()

		const capabilities: ModelCapabilities = {
			supportedCapabilities: new Set<Capability>(["computerUse"]),
			capabilityVersions: { computerUse: "1.0", imageAnalysis: "" },
			capabilityStrength: {
				computerUse: "basic" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		}

		expect(service.supportsComputerUse(capabilities)).toBe(true)

		const noComputerUse: ModelCapabilities = {
			supportedCapabilities: new Set<Capability>(["imageAnalysis"]),
			capabilityVersions: { computerUse: "", imageAnalysis: "1.0" },
			capabilityStrength: {
				computerUse: "basic" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		}

		expect(service.supportsComputerUse(noComputerUse)).toBe(false)
	})

	test("getCapabilityVersion should return version if supported", () => {
		const service = CapabilityService.getInstance()

		const capabilities: ModelCapabilities = {
			supportedCapabilities: new Set<Capability>(["computerUse", "imageAnalysis"]),
			capabilityVersions: { computerUse: "2.0", imageAnalysis: "1.0" },
			capabilityStrength: {
				computerUse: "advanced" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		}

		expect(service.getCapabilityVersion(capabilities, "computerUse")).toBe("2.0")
		expect(service.getCapabilityVersion(capabilities, "imageAnalysis")).toBe("1.0")
	})

	test("getCapabilityStrength should return strength if supported", () => {
		const service = CapabilityService.getInstance()

		const capabilities: ModelCapabilities = {
			supportedCapabilities: new Set<Capability>(["computerUse", "imageAnalysis"]),
			capabilityVersions: { computerUse: "2.0", imageAnalysis: "1.0" },
			capabilityStrength: {
				computerUse: "advanced" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		}

		expect(service.getCapabilityStrength(capabilities, "computerUse")).toBe("advanced")
		expect(service.getCapabilityStrength(capabilities, "imageAnalysis")).toBe("basic")
	})

	test("getState should return current service state", async () => {
		const service = CapabilityService.getInstance()

		mockManager.getCacheSize.mockReturnValue(42)

		// Make a successful request to update hit count
		mockManager.getFromCache.mockResolvedValue({
			supportedCapabilities: new Set<Capability>(["computerUse"]),
			capabilityVersions: { computerUse: "1.0", imageAnalysis: "" },
			capabilityStrength: {
				computerUse: "basic" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		})

		await service.determineCapabilities({
			apiConfiguration: { apiModelId: "gpt-4" },
		})

		const state = service.getState()

		expect(state).toHaveProperty("cache")
		expect(state).toHaveProperty("rateLimit")
		expect(state).toHaveProperty("performance")
		expect(state.cache.size).toBe(42)
	})

	test("clearCache should clear the manager cache", async () => {
		const service = CapabilityService.getInstance()

		await service.clearCache()

		expect(mockManager.clearCache).toHaveBeenCalled()
	})

	test("dispose should clean up resources", () => {
		const service = CapabilityService.getInstance()

		service.dispose()

		expect(mockManager.dispose).toHaveBeenCalled()

		// Second dispose should be a no-op
		mockManager.dispose.mockClear()
		service.dispose()
		expect(mockManager.dispose).not.toHaveBeenCalled()
	})
})
