import { Lock, LockTimeoutError, withLock, synchronized } from "../lock"

describe("Lock", () => {
	// Mock timers for testing timeouts and delays
	beforeEach(() => {
		jest.useFakeTimers()
	})

	afterEach(() => {
		jest.useRealTimers()
		jest.restoreAllMocks()
	})

	describe("basic locking mechanism", () => {
		it("should acquire lock immediately when free", async () => {
			const lock = new Lock()

			expect(lock.isLocked()).toBe(false)

			await lock.acquire()

			expect(lock.isLocked()).toBe(true)
		})

		it("should release lock correctly", async () => {
			const lock = new Lock()

			await lock.acquire()
			expect(lock.isLocked()).toBe(true)

			lock.release()
			expect(lock.isLocked()).toBe(false)
		})

		it("should execute function with lock protection", async () => {
			const lock = new Lock()
			const mockFn = jest.fn().mockResolvedValue("result")

			const result = await lock.withLock(mockFn)

			expect(result).toBe("result")
			expect(mockFn).toHaveBeenCalledTimes(1)
			expect(lock.isLocked()).toBe(false) // Lock should be released after execution
		})
	})

	describe("queuing mechanism", () => {
		it("should queue lock requests when lock is held", async () => {
			const lock = new Lock()
			const executionOrder: number[] = []

			// Acquire the lock first
			await lock.acquire()

			// Create three competing operations
			const op1 = lock.withLock(() => {
				executionOrder.push(1)
				return "op1"
			})

			const op2 = lock.withLock(() => {
				executionOrder.push(2)
				return "op2"
			})

			const op3 = lock.withLock(() => {
				executionOrder.push(3)
				return "op3"
			})

			// Release the lock to allow the first operation to proceed
			lock.release()

			// Run all timers to process the queue
			await jest.runAllTimersAsync()

			// Wait for all operations to complete
			await Promise.all([op1, op2, op3])

			// Check execution order (should be 1, 2, 3)
			expect(executionOrder).toEqual([1, 2, 3])
		})

		it("should process queue in FIFO order", async () => {
			const lock = new Lock()
			const results: string[] = []

			// Acquire the lock first
			await lock.acquire()

			// Queue multiple operations
			const promises = []
			for (let i = 0; i < 5; i++) {
				const promise = lock.acquire().then(() => {
					results.push(`operation-${i}`)
					lock.release()
				})
				promises.push(promise)
			}

			// Release the lock to start processing the queue
			lock.release()

			// Run all timers to process the queue
			await jest.runAllTimersAsync()

			// Wait for all operations to complete
			await Promise.all(promises)

			// Check execution order
			expect(results).toEqual(["operation-0", "operation-1", "operation-2", "operation-3", "operation-4"])
		})
	})

	describe("error handling", () => {
		it("should release lock even if operation throws an error", async () => {
			const lock = new Lock()
			const error = new Error("Test error")

			// Create an operation that will throw
			const operation = () =>
				lock.withLock(() => {
					throw error
				})

			// Execute and catch the error
			await expect(operation()).rejects.toThrow(error)

			// Lock should be released despite the error
			expect(lock.isLocked()).toBe(false)

			// Should be able to acquire the lock again
			await lock.acquire()
			expect(lock.isLocked()).toBe(true)
		})

		it("should handle errors in async operations", async () => {
			const lock = new Lock()
			const error = new Error("Async error")

			// Create an async operation that will throw
			const operation = () =>
				lock.withLock(async () => {
					await Promise.resolve()
					throw error
				})

			// Execute and catch the error
			await expect(operation()).rejects.toThrow(error)

			// Lock should be released despite the error
			expect(lock.isLocked()).toBe(false)
		})
	})

	describe("timeout functionality", () => {
		it("should throw LockTimeoutError when acquisition times out", async () => {
			const lock = new Lock()

			// Acquire the lock first
			await lock.acquire()

			// Try to acquire with a timeout
			let error: any = null
			const acquirePromise = lock.acquire({ timeoutMs: 100 }).catch((e) => {
				error = e
			})

			// Advance time past the timeout
			await jest.advanceTimersByTimeAsync(101)
			await acquirePromise

			// Check that we got the right error
			expect(error).not.toBeNull()
			expect(error instanceof LockTimeoutError).toBe(true)
			expect(error.message).toContain("Lock acquisition timed out after 100ms")
			expect(lock.isLocked()).toBe(true) // Original lock should still be held
			expect(lock.isLocked()).toBe(true) // Original lock should still be held
		})

		it("should cancel timeout when lock is acquired before timeout", async () => {
			const lock = new Lock()

			// Acquire the lock first
			await lock.acquire()

			// Try to acquire with a timeout
			const promise = lock.acquire({ timeoutMs: 1000 })

			// Release the lock before timeout
			lock.release()

			// Should resolve without error
			await expect(promise).resolves.not.toThrow()
			expect(lock.isLocked()).toBe(true) // New lock should be acquired
		})

		it("should support timeout in withLock method", async () => {
			const lock = new Lock()

			// Acquire the lock first
			await lock.acquire()

			// Try to execute with lock and timeout
			let error: any = null
			const withLockPromise = lock
				.withLock(() => "result", { timeoutMs: 100 })
				.catch((e) => {
					error = e
				})

			// Advance time past the timeout
			await jest.advanceTimersByTimeAsync(101)
			await withLockPromise

			// Check that we got the right error
			expect(error).not.toBeNull()
			expect(error instanceof LockTimeoutError).toBe(true)
			expect(error.message).toContain("Lock acquisition timed out after 100ms")
		})
	})

	describe("utility functions", () => {
		it("should create a lock-protected function with withLock", async () => {
			const mockFn = jest.fn().mockImplementation((a, b) => a + b)
			const protectedFn = withLock(mockFn)

			const result = await protectedFn(2, 3)

			expect(result).toBe(5)
			expect(mockFn).toHaveBeenCalledWith(2, 3)
		})

		it("should create a lock-protected method with synchronized decorator", async () => {
			class TestClass {
				public callCount = 0

				@synchronized()
				async increment(value: number): Promise<number> {
					this.callCount += value
					return this.callCount
				}
			}

			const instance = new TestClass()
			const result = await instance.increment(5)

			expect(result).toBe(5)
			expect(instance.callCount).toBe(5)
		})

		it("should queue multiple calls to synchronized methods", async () => {
			class TestClass {
				public executionOrder: number[] = []

				@synchronized()
				async operation1(): Promise<void> {
					this.executionOrder.push(1)
				}

				@synchronized()
				async operation2(): Promise<void> {
					this.executionOrder.push(2)
				}

				@synchronized()
				async operation3(): Promise<void> {
					this.executionOrder.push(3)
				}
			}

			const instance = new TestClass()

			// Start all operations (they should be queued)
			const promises = [instance.operation1(), instance.operation2(), instance.operation3()]

			// Run all timers to process the queue
			await jest.runAllTimersAsync()

			// Wait for all operations to complete
			await Promise.all(promises)

			// Check execution order
			expect(instance.executionOrder).toEqual([1, 2, 3])
		})
	})
})
