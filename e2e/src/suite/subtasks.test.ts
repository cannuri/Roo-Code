import * as assert from "assert"

import { sleep, waitForToolUse, waitForMessage } from "./utils"

suite("Roo Code Subtasks", () => {
	test("Should handle subtask cancellation and resumption correctly", async function () {
		this.timeout(60000) // Increase timeout for this test
		const api = globalThis.api

		await api.setConfiguration({
			mode: "Code",
			alwaysAllowModeSwitch: true,
			alwaysAllowSubtasks: true,
			autoApprovalEnabled: true,
		})

		// Start a parent task that will create a subtask.
		await api.startNewTask(
			"You are the parent task. " +
				"Create a subtask by using the new_task tool with the message 'You are the subtask'. " +
				"After creating the subtask, wait for it to complete and then respond with 'Parent task resumed'.",
		)

		// Wait for the parent task to use the new_task tool
		// Use a longer timeout for this step as it's where the race condition occurs
		await waitForToolUse(api, "new_task", { timeout: 45000 })

		// Cancel the current task (which should be the subtask).
		await api.cancelTask()

		// Check if the parent task is still waiting (not resumed). We need to
		// wait a bit to ensure any task resumption would have happened.
		await sleep(5_000)

		// The parent task should not have resumed yet, so we shouldn't see
		// "Parent task resumed".
		assert.ok(
			!api.getMessages().some(({ type, text }) => type === "say" && text?.includes("Parent task resumed")),
			"Parent task should not have resumed after subtask cancellation.",
		)

		// Start a new task with the same message as the subtask.
		await api.startNewTask("You are the subtask")

		// Wait for the subtask to complete.
		// Use a longer timeout for this step as well
		await waitForMessage(api, { include: "Task complete", timeout: 30000 })

		// Verify that the parent task is still not resumed. We need to wait a
		// bit to ensure any task resumption would have happened.
		await sleep(5_000)

		// The parent task should still not have resumed.
		assert.ok(
			!api.getMessages().some(({ type, text }) => type === "say" && text?.includes("Parent task resumed")),
			"Parent task should not have resumed after subtask completion.",
		)

		// Clean up - cancel all tasks.
		await api.cancelTask()
	})
})
