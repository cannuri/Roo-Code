import { RetryHandler, RetryError } from "../retry-handler"

describe("RetryHandler", () => {
	// Mock timers for testing delays
	beforeEach(() => {
		jest.useFakeTimers()
	})

	afterEach(() => {
		jest.useRealTimers()
		jest.restoreAllMocks()
	})

	describe("execute", () => {
		it("should execute operation successfully on first attempt", async () => {
			const handler = new RetryHandler({
				maxRetries: 3,
				initialDelayMs: 100,
				backoffFactor: 2,
			})

			const operation = jest.fn().mockResolvedValue("success")

			const promise = handler.execute(operation)
			await jest.runAllTimersAsync()
			const result = await promise

			expect(result).toBe("success")
			expect(operation).toHaveBeenCalledTimes(1)
		})

		it("should retry failed operations", async () => {
			const handler = new RetryHandler({
				maxRetries: 3,
				initialDelayMs: 100,
				backoffFactor: 2,
				useJitter: false, // Disable jitter for predictable tests
			})

			const operation = jest
				.fn()
				.mockRejectedValueOnce(new Error("Attempt 1 failed"))
				.mockRejectedValueOnce(new Error("Attempt 2 failed"))
				.mockResolvedValueOnce("success")

			// Start the operation
			const promise = handler.execute(operation)

			// First attempt fails immediately
			expect(operation).toHaveBeenCalledTimes(1)

			// Advance timers for the first retry delay (100ms)
			await jest.advanceTimersByTimeAsync(100)
			expect(operation).toHaveBeenCalledTimes(2)

			// Advance timers for the second retry delay (200ms)
			await jest.advanceTimersByTimeAsync(200)
			expect(operation).toHaveBeenCalledTimes(3)

			const result = await promise
			expect(result).toBe("success")
		})

		it("should use exponential backoff for retries", async () => {
			const handler = new RetryHandler({
				maxRetries: 3,
				initialDelayMs: 100,
				backoffFactor: 2,
				useJitter: false, // Disable jitter for predictable tests
			})

			const operation = jest
				.fn()
				.mockRejectedValueOnce(new Error("Attempt 1 failed"))
				.mockRejectedValueOnce(new Error("Attempt 2 failed"))
				.mockRejectedValueOnce(new Error("Attempt 3 failed"))
				.mockResolvedValueOnce("success")

			const promise = handler.execute(operation)

			// First attempt fails immediately
			expect(operation).toHaveBeenCalledTimes(1)

			// First retry after 100ms
			await jest.advanceTimersByTimeAsync(100)
			expect(operation).toHaveBeenCalledTimes(2)

			// Second retry after 200ms (100ms * 2^1)
			await jest.advanceTimersByTimeAsync(200)
			expect(operation).toHaveBeenCalledTimes(3)

			// Third retry after 400ms (100ms * 2^2)
			await jest.advanceTimersByTimeAsync(400)
			expect(operation).toHaveBeenCalledTimes(4)

			const result = await promise
			expect(result).toBe("success")
		}, 10000) // Increase timeout for this test

		it("should handle max retries correctly", async () => {
			const handler = new RetryHandler({
				maxRetries: 2,
				initialDelayMs: 100,
				backoffFactor: 2,
				useJitter: false,
			})

			const testError = new Error("Operation failed")
			const operation = jest.fn().mockRejectedValue(testError)

			// Start the operation using executeWithResult instead of execute
			const promise = handler.executeWithResult(operation)

			// First attempt fails immediately
			expect(operation).toHaveBeenCalledTimes(1)

			// First retry after 100ms
			await jest.advanceTimersByTimeAsync(100)
			expect(operation).toHaveBeenCalledTimes(2)

			// Second retry after 200ms
			await jest.advanceTimersByTimeAsync(200)
			expect(operation).toHaveBeenCalledTimes(3)

			// Run all remaining timers to ensure all promises are settled
			await jest.runAllTimersAsync()

			const result = await promise
			expect(result.successful).toBe(false)
			expect(result.error).toBe(testError)
			expect(result.attempts).toBe(3)
		}, 10000) // Increase timeout for this test

		it("should handle timeout configuration correctly", async () => {
			const handler = new RetryHandler({
				maxRetries: 2,
				initialDelayMs: 100,
				backoffFactor: 2,
				timeoutMs: 50,
			})

			// Create an operation that never resolves
			const operation = jest.fn().mockImplementation(() => {
				return new Promise((resolve) => {
					// This will never resolve naturally
					setTimeout(resolve, 1000000)
				})
			})

			// Use executeWithResult instead of execute
			const promise = handler.executeWithResult(operation)

			// Advance past the timeout for first attempt
			await jest.advanceTimersByTimeAsync(50)

			// Advance for the delay before first retry
			await jest.advanceTimersByTimeAsync(100)

			// Advance past the timeout for second attempt
			await jest.advanceTimersByTimeAsync(50)

			// Advance for the delay before second retry
			await jest.advanceTimersByTimeAsync(200)

			// Advance past the timeout for third attempt
			await jest.advanceTimersByTimeAsync(50)

			// Run all remaining timers to ensure all promises are settled
			await jest.runAllTimersAsync()

			const result = await promise
			expect(result.successful).toBe(false)
			expect(result.error).toBeTruthy() // Should have an error
			expect(result.attempts).toBe(3)
			expect(operation).toHaveBeenCalledTimes(3)
		}, 10000) // Increase timeout for this test
	})

	describe("executeWithResult", () => {
		it("should return successful result with attempt count", async () => {
			const handler = new RetryHandler({
				maxRetries: 3,
				initialDelayMs: 100,
				backoffFactor: 2,
				useJitter: false,
			})

			const operation = jest
				.fn()
				.mockRejectedValueOnce(new Error("Attempt 1 failed"))
				.mockResolvedValueOnce("success")

			const promise = handler.executeWithResult(operation)

			// First attempt fails immediately
			expect(operation).toHaveBeenCalledTimes(1)

			// First retry after 100ms
			await jest.advanceTimersByTimeAsync(100)

			const result = await promise
			expect(result).toEqual({
				result: "success",
				attempts: 1,
				successful: true,
			})
		}, 10000) // Increase timeout for this test

		it("should return failure result with error and attempt count", async () => {
			const handler = new RetryHandler({
				maxRetries: 2,
				initialDelayMs: 100,
				backoffFactor: 2,
				useJitter: false,
			})

			const testError = new Error("Operation failed")
			const operation = jest.fn().mockRejectedValue(testError)

			const promise = handler.executeWithResult(operation)

			// First attempt fails immediately
			expect(operation).toHaveBeenCalledTimes(1)

			// First retry after 100ms
			await jest.advanceTimersByTimeAsync(100)

			// Second retry after 200ms
			await jest.advanceTimersByTimeAsync(200)

			const result = await promise
			expect(result).toEqual({
				error: testError,
				attempts: 3,
				successful: false,
			})
		}, 10000) // Increase timeout for this test
	})

	describe("jitter", () => {
		it("should apply jitter to delay times when enabled", async () => {
			// Mock Math.random to return a predictable value
			const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.5)

			const handler = new RetryHandler({
				maxRetries: 1,
				initialDelayMs: 100,
				backoffFactor: 2,
				useJitter: true,
			})

			const operation = jest
				.fn()
				.mockRejectedValueOnce(new Error("Attempt 1 failed"))
				.mockResolvedValueOnce("success")

			const promise = handler.execute(operation)

			// First attempt fails immediately
			expect(operation).toHaveBeenCalledTimes(1)

			// With jitter at 0.5, the delay should be exactly the base delay
			await jest.advanceTimersByTimeAsync(100)

			expect(operation).toHaveBeenCalledTimes(2)
			expect(randomSpy).toHaveBeenCalled()

			await promise
		}, 10000) // Increase timeout for this test
	})
})
