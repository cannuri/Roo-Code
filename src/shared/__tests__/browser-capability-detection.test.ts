import { ModelCapabilityManager } from "../model-capability-manager"
import { determineModelCapabilities, Capability, CapabilityStrength, ModelCapabilities } from "../model-capabilities"
import { ModelInfo } from "../api"
import { logger } from "../../utils/logging"

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
}))

jest.mock("../../utils/logging", () => ({
	logger: {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
}))

jest.mock("../../services/telemetry/TelemetryService", () => ({
	telemetryService: {
		captureEvent: jest.fn(),
	},
}))

describe("Browser capability detection", () => {
	let capabilityManager: ModelCapabilityManager

	// Clean up after all tests
	afterAll(() => {
		// Explicitly dispose the capability manager to clean up resources
		ModelCapabilityManager.getInstance().dispose()
		// Reset the singleton instance
		ModelCapabilityManager.resetInstance()
	})

	beforeEach(() => {
		// Reset the singleton instance before each test
		jest.clearAllMocks()
		ModelCapabilityManager.resetInstance()

		// Setup mock for determineModelCapabilities
		const mockDetermineCapabilities = determineModelCapabilities as jest.MockedFunction<
			typeof determineModelCapabilities
		>
		mockDetermineCapabilities.mockImplementation((params) => {
			// If browserToolEnabled is false, return empty capabilities
			if (params.browserToolEnabled === false) {
				return {
					supportedCapabilities: new Set<Capability>(),
					capabilityVersions: { computerUse: "", imageAnalysis: "" } as Record<Capability, string>,
					capabilityStrength: {
						computerUse: "basic" as CapabilityStrength,
						imageAnalysis: "basic" as CapabilityStrength,
					},
				}
			}

			// Otherwise return capabilities with computerUse
			return {
				supportedCapabilities: new Set<Capability>(["computerUse" as Capability]),
				capabilityVersions: { computerUse: "1.0", imageAnalysis: "" } as Record<Capability, string>,
				capabilityStrength: {
					computerUse: "basic" as CapabilityStrength,
					imageAnalysis: "basic" as CapabilityStrength,
				},
			}
		})

		capabilityManager = ModelCapabilityManager.getInstance()
	})

	test("should handle null/undefined model information gracefully", async () => {
		// Test with valid model info
		const result1 = await capabilityManager.determineCapabilities({
			apiModel: {
				contextWindow: 100000,
				supportsComputerUse: true,
				supportsPromptCache: false,
				id: "claude-3-opus",
				name: "Claude 3 Opus",
				provider: "anthropic",
				maxTokens: 200000,
				inputTokenCost: 0.01,
				outputTokenCost: 0.03,
			} as ModelInfo,
			apiConfiguration: { apiModelId: "claude-3-opus" },
		})

		expect(result1.supportedCapabilities.has("computerUse")).toBe(true)

		// Test with undefined model info
		const result2 = await capabilityManager.determineCapabilities({
			apiConfiguration: { apiModelId: "claude-3-opus" },
		})

		expect(result2.supportedCapabilities.has("computerUse")).toBe(true)

		// Test with disabled browser tool
		const result3 = await capabilityManager.determineCapabilities({
			apiConfiguration: { apiModelId: "claude-3-opus" },
			browserToolEnabled: false,
		})

		expect(result3.supportedCapabilities.has("computerUse")).toBe(false)
	})

	test("should handle errors during capability determination", async () => {
		// Mock determineModelCapabilities to throw an error
		const mockDetermineCapabilities = determineModelCapabilities as jest.MockedFunction<
			typeof determineModelCapabilities
		>

		// Save the original implementation
		const originalImplementation = mockDetermineCapabilities.getMockImplementation()

		// Override with an implementation that throws for this test only
		mockDetermineCapabilities.mockImplementationOnce(() => {
			throw new Error("Test error")
		})

		// Should throw the error but log it first
		await expect(
			capabilityManager.determineCapabilities({
				apiConfiguration: { apiModelId: "claude-3-opus" },
			}),
		).rejects.toThrow("Test error")

		expect(logger.error).toHaveBeenCalledWith(
			"Error determining capabilities",
			expect.objectContaining({
				error: "Test error",
			}),
		)

		// Restore the original implementation for subsequent tests
		if (originalImplementation) {
			mockDetermineCapabilities.mockImplementation(originalImplementation)
		}
	})

	test("should respect browserToolEnabled setting", async () => {
		// Test with browserToolEnabled = false
		const result = await capabilityManager.determineCapabilities({
			apiConfiguration: { apiModelId: "claude-3-opus" },
			browserToolEnabled: false,
		})

		expect(result.supportedCapabilities.size).toBe(0)
		expect(result.supportedCapabilities.has("computerUse")).toBe(false)
	})

	test("supportsComputerUse helper should work correctly", () => {
		const capabilities1: ModelCapabilities = {
			supportedCapabilities: new Set<Capability>(["computerUse" as Capability]),
			capabilityVersions: { computerUse: "1.0", imageAnalysis: "" } as Record<Capability, string>,
			capabilityStrength: {
				computerUse: "basic" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		}

		expect(capabilityManager.supportsComputerUse(capabilities1)).toBe(true)

		const capabilities2: ModelCapabilities = {
			supportedCapabilities: new Set<Capability>(),
			capabilityVersions: { computerUse: "", imageAnalysis: "" } as Record<Capability, string>,
			capabilityStrength: {
				computerUse: "basic" as CapabilityStrength,
				imageAnalysis: "basic" as CapabilityStrength,
			},
		}

		expect(capabilityManager.supportsComputerUse(capabilities2)).toBe(false)
	})
})
