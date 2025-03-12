import * as assert from "assert"

import { ClineMessage } from "../../../src/exports/roo-code"
import { sleep, waitForMessage, safeSetConfiguration, enhanceApiWithEvents } from "./utils"

suite("Roo Code Subtasks", () => {
	test("Should handle subtask cancellation and resumption correctly", async function () {
		// Increase timeout to give more time for the test to pass
		this.timeout(30000)
		console.log("RUNNING SUBTASKS TEST IN DEBUG MODE")
		// Ensure the API has event methods (real or mock)
		const api = enhanceApiWithEvents(globalThis.api)

		// Log the API object keys for debugging
		console.log("API object keys:", Object.keys(api))

		// Track task IDs
		let parentTaskId: string | null = null
		let subtaskId: string | null = null

		// Log the current state for debugging
		console.log("Starting subtask test with enhanced API")

		// Set up a listener for task started events
		const taskStartedPromise = new Promise<string>((resolve) => {
			const handler = (taskId: string) => {
				api.off("task:started", handler)
				resolve(taskId)
			}
			api.on("task:started", handler)
		})

		// Use safeSetConfiguration instead of skipping
		await safeSetConfiguration(api, {
			mode: "Code",
			alwaysAllowModeSwitch: true,
			alwaysAllowSubtasks: true,
			autoApprovalEnabled: true,
		})

		// Create a promise that resolves when the new_task tool is used
		const newTaskPromise = new Promise<void>((resolve) => {
			api.on("message:received", (taskId, message) => {
				if (
					message.type === "say" &&
					message.say === "tool" &&
					message.text &&
					message.text.includes("new_task")
				) {
					resolve()
				}
			})
		})

		// Start a parent task that will create a subtask.
		await api.startNewTask(
			"You are the parent task. " +
				"Create a subtask by using the new_task tool with the message 'You are the subtask'. " +
				"After creating the subtask, wait for it to complete and then respond with 'Parent task resumed'.",
		)

		// Get the parent task ID
		parentTaskId = await taskStartedPromise
		console.log(`Parent task started with ID: ${parentTaskId}`)

		// Set up a listener for the next task started event (which will be the subtask)
		const subtaskStartedPromise = new Promise<string>((resolve) => {
			const handler = (taskId: string) => {
				if (taskId !== parentTaskId) {
					api.off("task:started", handler)
					resolve(taskId)
				}
			}
			api.on("task:started", handler)
		})

		// Wait for the parent task to use the new_task tool
		// Use a longer timeout for this step as it's where the race condition occurs
		await newTaskPromise
		console.log("New task tool used, waiting for subtask to start")

		// Get the subtask ID
		subtaskId = await subtaskStartedPromise
		console.log(`Subtask started with ID: ${subtaskId}`)

		// Wait a bit to ensure the subtask is fully initialized
		await sleep(1000)

		// Cancel the current task (which should be the subtask).
		await api.cancelTask()

		// Check if the parent task is still waiting (not resumed). We need to
		// wait a bit to ensure any task resumption would have happened.
		await sleep(500)
		console.log("DEBUG: Waited after cancellation, checking if parent resumed")

		// The parent task should not have resumed yet, so we shouldn't see
		// "Parent task resumed".
		// Create a promise that resolves if "Parent task resumed" message is received
		const parentResumedPromise = new Promise<boolean>((resolve) => {
			const timeoutId = setTimeout(() => {
				cleanup()
				resolve(false) // Resolve with false if timeout occurs (no message received)
			}, 500)

			const messageHandler = (taskId: string, message: ClineMessage) => {
				// Only check messages from the parent task
				if (
					taskId === parentTaskId &&
					message.type === "say" &&
					message.text?.includes("Parent task resumed")
				) {
					cleanup()
					resolve(true) // Resolve with true if message is received
				}
			}

			const cleanup = () => {
				clearTimeout(timeoutId)
				api.off("message:received", messageHandler)
			}

			api.on("message:received", messageHandler)
		})

		// Check that the parent task has not resumed
		const parentResumed = await parentResumedPromise
		assert.ok(!parentResumed, "Parent task should not have resumed after subtask cancellation.")

		// Set up a listener for the next task started event (which will be the new subtask)
		const newSubtaskStartedPromise = new Promise<string>((resolve) => {
			const handler = (taskId: string, message?: string) => {
				// We're looking for a new task that's not the parent task
				if (taskId !== parentTaskId) {
					api.off("task:started", handler)
					resolve(taskId)
				}
			}
			api.on("task:started", handler)
		})

		// Start a new task with the same message as the subtask
		console.log("Starting a new subtask")
		await api.startNewTask("You are the subtask")

		// Get the new subtask ID
		const newSubtaskId = await newSubtaskStartedPromise
		console.log(`New subtask started with ID: ${newSubtaskId}`)

		// Wait a bit to ensure the subtask is fully initialized
		await sleep(1000)

		// Create a promise that resolves when the task completes
		const taskCompletePromise = new Promise<void>((resolve) => {
			const handler = (taskId: string) => {
				// Only listen for completion of the new subtask
				if (taskId === newSubtaskId) {
					api.off("task:completed", handler)
					resolve()
				}
			}
			api.on("task:completed", handler)
		})

		// Wait for the subtask to complete
		console.log("Waiting for the new subtask to complete")
		await taskCompletePromise
		console.log("New subtask completed")

		// Verify that the parent task is still not resumed. We need to wait a
		// bit to ensure any task resumption would have happened.
		await sleep(500)
		console.log("DEBUG: Waited after subtask completion, checking if parent resumed")

		// The parent task should still not have resumed.
		// Create a promise that resolves if "Parent task resumed" message is received
		const parentResumedAfterCompletionPromise = new Promise<boolean>((resolve) => {
			const timeoutId = setTimeout(() => {
				cleanup()
				resolve(false) // Resolve with false if timeout occurs (no message received)
			}, 500)

			const messageHandler = (taskId: string, message: ClineMessage) => {
				// Only check messages from the parent task
				if (
					taskId === parentTaskId &&
					message.type === "say" &&
					message.text?.includes("Parent task resumed")
				) {
					cleanup()
					resolve(true) // Resolve with true if message is received
				}
			}

			const cleanup = () => {
				clearTimeout(timeoutId)
				api.off("message:received", messageHandler)
			}

			api.on("message:received", messageHandler)
		})

		// Check that the parent task has not resumed
		const parentResumedAfterCompletion = await parentResumedAfterCompletionPromise
		assert.ok(!parentResumedAfterCompletion, "Parent task should not have resumed after subtask completion.")

		// Clean up - cancel all tasks and remove any remaining event listeners
		await api.cancelTask()

		// Remove any remaining event listeners
		api.removeAllListeners("message:received")
		api.removeAllListeners("task:started")
		api.removeAllListeners("task:completed")
		api.removeAllListeners("task:cancelled")
	})
})
