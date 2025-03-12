import * as vscode from "vscode"
import { EventEmitter } from "events"

import { ClineProvider } from "../core/webview/ClineProvider"

import { RooCodeAPI, ClineMessage } from "../exports/roo-code"
import { ConfigurationValues } from "../shared/globalState"

export function createRooCodeAPI(outputChannel: vscode.OutputChannel, provider: ClineProvider): RooCodeAPI {
	// Create an EventEmitter instance
	const emitter = new EventEmitter()

	// Track the current task ID
	let currentTaskId: string | null = null

	// Track the last seen message count to detect new messages
	let lastMessageCount = 0

	// Set up a polling interval to check for new messages
	const messageCheckInterval = setInterval(() => {
		if (!currentTaskId) return

		const messages = provider.messages
		if (messages.length > lastMessageCount) {
			// New messages have been added
			const newMessages = messages.slice(lastMessageCount)
			lastMessageCount = messages.length

			// Emit events for each new message
			for (const message of newMessages) {
				emitter.emit("message:received", currentTaskId, message)

				// Check if this is a completion message
				if (
					message.type === "say" &&
					(message.say === "completion_result" || (message.text && message.text?.includes("Task complete")))
				) {
					emitter.emit("task:completed", currentTaskId)
				}
			}
		}
	}, 100) // Check every 100ms

	// Clean up interval when extension is deactivated
	provider.context.subscriptions.push({ dispose: () => clearInterval(messageCheckInterval) })

	// Create the API object using the same EventEmitter instance
	const api = Object.assign(emitter, {
		startNewTask: async (task?: string, images?: string[]) => {
			outputChannel.appendLine("Starting new task")

			// Generate a new task ID
			currentTaskId = `task-${Date.now()}`

			// Reset message tracking for the new task
			lastMessageCount = 0

			await provider.removeClineFromStack()
			await provider.postStateToWebview()
			await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })

			await provider.postMessageToWebview({
				type: "invoke",
				invoke: "sendMessage",
				text: task,
				images: images,
			})

			outputChannel.appendLine(
				`Task started with message: ${task ? `"${task}"` : "undefined"} and ${images?.length || 0} image(s)`,
			)

			// Emit the task:started event
			emitter.emit("task:started", currentTaskId, task)
		},

		cancelTask: async () => {
			outputChannel.appendLine("Cancelling current task")

			if (currentTaskId) {
				// Emit the task:cancelled event
				emitter.emit("task:cancelled", currentTaskId)
			}

			await provider.cancelTask()
		},

		sendMessage: async (message?: string, images?: string[]) => {
			outputChannel.appendLine(
				`Sending message: ${message ? `"${message}"` : "undefined"} with ${images?.length || 0} image(s)`,
			)

			await provider.postMessageToWebview({
				type: "invoke",
				invoke: "sendMessage",
				text: message,
				images: images,
			})

			// Emit the message:sent event
			if (currentTaskId) {
				emitter.emit("message:sent", currentTaskId, message || "", images)
			}
		},

		pressPrimaryButton: async () => {
			outputChannel.appendLine("Pressing primary button")
			await provider.postMessageToWebview({ type: "invoke", invoke: "primaryButtonClick" })
		},

		pressSecondaryButton: async () => {
			outputChannel.appendLine("Pressing secondary button")
			await provider.postMessageToWebview({ type: "invoke", invoke: "secondaryButtonClick" })
		},

		setConfiguration: async (values: Partial<ConfigurationValues>) => {
			await provider.setValues(values)
		},

		isReady: () => provider.viewLaunched,

		getMessages: () => provider.messages,

		getCurrentTaskId: () => currentTaskId,
	}) as RooCodeAPI

	// Add a dispose method to clean up resources
	const originalDispose = api.removeAllListeners.bind(api)
	api.removeAllListeners = function () {
		clearInterval(messageCheckInterval)
		return originalDispose()
	}

	return api
}
