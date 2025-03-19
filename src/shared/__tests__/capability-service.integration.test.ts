import { CapabilityService, CapabilityParams } from "../capability-service"
import { ModelCapabilityManager } from "../model-capability-manager"
import { MemoryManager, MemoryPressureLevel } from "../../utils/memory-manager"
import { CircuitBreaker } from "../../utils/circuit-breaker"
import { Capability, ModelCapabilities } from "../model-capabilities"

// Use real implementations for integration tests
jest.unmock("../model-capability-manager")
jest.unmock("../../utils/memory-manager")
jest.unmock("../../utils/circuit-breaker")

// But still mock the logging to avoid console noise
jest.mock("../../utils/logging")
jest.mock("../../services/telemetry/TelemetryService", () => ({
	telemetryService: {
		captureEvent: jest.fn(),
	},
}))

describe("CapabilityService Integration", () => {
	let service: CapabilityService

	// Reset all singletons before each test
	beforeEach(async () => {
		// Reset all singleton instances
		;(CapabilityService as any).instance = null

		// We need to access these through prototype to avoid TypeScript errors
		const modelManagerProto = Object.getPrototypeOf(ModelCapabilityManager)
		if (modelManagerProto.instance) {
			modelManagerProto.instance = null
		}

		const memoryManagerProto = Object.getPrototypeOf(MemoryManager)
		if (memoryManagerProto.instance) {
			memoryManagerProto.instance = null
		}

		// Create a fresh service instance with test configuration
		service = await CapabilityService.getInstanceAsync({
			maxCacheSize: 10,
			maxModelIdLength: 50,
			maxRequestsPerWindow: 5,
			maxValidationDepth: 3,
			timeout: 1000,
			maxRetries: 2,
			baseRetryDelay: 100,
			maxDataSize: 1024,
			rateLimitWindow: 1000,
			performanceSamplingRate: 0.1, // Enable sampling for integration tests
		})
	})

	afterEach(async () => {
		// Ensure proper cleanup after each test
		if (service) {
			service.dispose()
		}

		// Force garbage collection if available (Node with --expose-gc flag)
		if (global.gc) {
			global.gc()
		}

		// Wait for any pending promises to resolve
		await new Promise((resolve) => setTimeout(resolve, 100))
	})

	describe("Concurrent operations", () => {
		it("should handle multiple concurrent capability requests safely", async () => {
			// Create multiple concurrent requests
			const params: CapabilityParams = {
				apiConfiguration: { apiModelId: "test-model" },
				browserToolEnabled: true,
			}

			// Mock the ModelCapabilityManager.determineCapabilities method
			// since we're not actually making API calls in tests
			const originalMethod = ModelCapabilityManager.prototype.determineCapabilities

			// Create a mock implementation
			const mockImplementation = async () => {
				// Simulate some async work with random delay
				await new Promise((resolve) => setTimeout(resolve, Math.random() * 50))
				return {
					supportedCapabilities: new Set<Capability>(["computerUse"]),
					capabilityVersions: {
						computerUse: "1.0",
						imageAnalysis: "1.0",
					},
					capabilityStrength: {
						computerUse: "basic",
						imageAnalysis: "basic",
					},
				}
			}

			// Apply the mock
			ModelCapabilityManager.prototype.determineCapabilities = mockImplementation as any

			try {
				// Make 10 concurrent requests
				const promises = Array(10)
					.fill(0)
					.map(() => service.determineCapabilities(params))
				const results = await Promise.all(promises)

				// Verify all requests succeeded
				expect(results.length).toBe(10)
				results.forEach((result) => {
					expect(result.supportedCapabilities.has("computerUse")).toBe(true)
				})
			} finally {
				// Restore the original method
				ModelCapabilityManager.prototype.determineCapabilities = originalMethod
			}
		})
	})

	describe("Memory pressure handling", () => {
		it("should respond to memory pressure events", async () => {
			// Get the memory manager instance
			const memoryManager = MemoryManager.getInstance()

			// Spy on clearCache method
			const clearCacheSpy = jest.spyOn(ModelCapabilityManager.getInstance(), "clearCache")

			// Manually trigger the memory pressure handler since we can't directly trigger events
			const capabilityService = await CapabilityService.getInstanceAsync()
			const handleMemoryPressure = (capabilityService as any).handleMemoryPressure.bind(capabilityService)

			// Trigger memory pressure events
			handleMemoryPressure(MemoryPressureLevel.ELEVATED)
			expect(clearCacheSpy).toHaveBeenCalledTimes(1)

			handleMemoryPressure(MemoryPressureLevel.CRITICAL)
			expect(clearCacheSpy).toHaveBeenCalledTimes(2)

			// Return to normal (no additional cache clear expected)
			handleMemoryPressure(MemoryPressureLevel.NORMAL)
			expect(clearCacheSpy).toHaveBeenCalledTimes(2)
		})
	})

	describe("Circuit breaker integration", () => {
		it("should trip circuit breaker after multiple failures", async () => {
			// Mock the ModelCapabilityManager.determineCapabilities method to always fail
			const originalMethod = ModelCapabilityManager.prototype.determineCapabilities

			// Create a mock implementation that always fails
			const mockFailingImplementation = async () => {
				throw new Error("Simulated failure")
			}

			// Apply the mock
			ModelCapabilityManager.prototype.determineCapabilities = mockFailingImplementation as any

			const params: CapabilityParams = {
				apiConfiguration: { apiModelId: "test-model" },
				browserToolEnabled: true,
			}

			try {
				// Make multiple requests to trip the circuit breaker
				for (let i = 0; i < 6; i++) {
					try {
						await service.determineCapabilities(params)
					} catch (error) {
						// Expected to fail
					}
				}

				// Circuit should be open now, this should fail with circuit open error
				await expect(service.determineCapabilities(params)).rejects.toThrow("Service temporarily unavailable")
			} finally {
				// Restore the original method
				ModelCapabilityManager.prototype.determineCapabilities = originalMethod
			}
		})
	})

	describe("Performance monitoring", () => {
		it("should collect and report performance metrics", async () => {
			// Mock the ModelCapabilityManager.determineCapabilities method
			const originalMethod = ModelCapabilityManager.prototype.determineCapabilities

			// Create a mock implementation with consistent delay
			const mockImplementation = async () => {
				// Simulate some async work with consistent delay
				await new Promise((resolve) => setTimeout(resolve, 50))
				return {
					supportedCapabilities: new Set<Capability>(["computerUse"]),
					capabilityVersions: {
						computerUse: "1.0",
						imageAnalysis: "1.0",
					},
					capabilityStrength: {
						computerUse: "basic",
						imageAnalysis: "basic",
					},
				}
			}

			// Apply the mock
			ModelCapabilityManager.prototype.determineCapabilities = mockImplementation as any

			const params: CapabilityParams = {
				apiConfiguration: { apiModelId: "test-model" },
				browserToolEnabled: true,
			}

			try {
				// Force 100% sampling rate for testing
				;(service as any).config.performanceSamplingRate = 1.0

				// Make several requests to collect metrics
				for (let i = 0; i < 5; i++) {
					await service.determineCapabilities(params)
				}

				// Get service state and check metrics
				const state = service.getState()
				expect(state.performance.avgResponseTime).toBeGreaterThan(0)
			} finally {
				// Restore the original method
				ModelCapabilityManager.prototype.determineCapabilities = originalMethod
			}
		})
	})

	describe("Rate limiting", () => {
		it("should enforce rate limits", async () => {
			// Mock the ModelCapabilityManager.determineCapabilities method
			const originalMethod = ModelCapabilityManager.prototype.determineCapabilities

			// Create a mock implementation that succeeds
			const mockImplementation = async () => {
				return {
					supportedCapabilities: new Set<Capability>(["computerUse"]),
					capabilityVersions: {
						computerUse: "1.0",
						imageAnalysis: "1.0",
					},
					capabilityStrength: {
						computerUse: "basic",
						imageAnalysis: "basic",
					},
				}
			}

			// Apply the mock
			ModelCapabilityManager.prototype.determineCapabilities = mockImplementation as any

			// Create a service with very low rate limit for testing
			;(CapabilityService as any).instance = null
			const rateLimitedService = await CapabilityService.getInstanceAsync({
				maxRequestsPerWindow: 3, // Only allow 3 requests
				rateLimitWindow: 10000, // In a 10 second window
				performanceSamplingRate: 0,
			})

			const params: CapabilityParams = {
				apiConfiguration: { apiModelId: "test-model" },
				browserToolEnabled: true,
			}

			try {
				// First 3 requests should succeed
				await rateLimitedService.determineCapabilities(params)
				await rateLimitedService.determineCapabilities(params)
				await rateLimitedService.determineCapabilities(params)

				// 4th request should be rate limited
				await expect(rateLimitedService.determineCapabilities(params)).rejects.toThrow("Rate limit exceeded")
			} finally {
				// Clean up
				rateLimitedService.dispose()
				// Restore the original method
				ModelCapabilityManager.prototype.determineCapabilities = originalMethod
			}
		})
	})

	describe("Error handling and retries", () => {
		it("should retry transient errors but respect retry limits", async () => {
			// Mock the ModelCapabilityManager.determineCapabilities method
			const originalMethod = ModelCapabilityManager.prototype.determineCapabilities

			// Create a mock implementation that fails twice then succeeds
			let callCount = 0
			const mockImplementation = async () => {
				callCount++
				if (callCount <= 2) {
					throw new Error(`Transient error ${callCount}`)
				}

				return {
					supportedCapabilities: new Set<Capability>(["computerUse"]),
					capabilityVersions: {
						computerUse: "1.0",
						imageAnalysis: "1.0",
					},
					capabilityStrength: {
						computerUse: "basic",
						imageAnalysis: "basic",
					},
				}
			}

			// Apply the mock
			ModelCapabilityManager.prototype.determineCapabilities = mockImplementation as any

			const params: CapabilityParams = {
				apiConfiguration: { apiModelId: "test-model" },
				browserToolEnabled: true,
			}

			try {
				// This should succeed after 2 retries (3 attempts total)
				const result = await service.determineCapabilities(params)

				// Verify the result
				expect(result.supportedCapabilities.has("computerUse")).toBe(true)

				// Verify retry count
				expect(callCount).toBe(3)
			} finally {
				// Restore the original method
				ModelCapabilityManager.prototype.determineCapabilities = originalMethod
			}
		})
	})
})
