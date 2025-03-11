import * as vscode from "vscode"

import { RooCodeAPI } from "../../../src/exports/roo-code"

type WaitForOptions = {
	timeout?: number
	interval?: number
}

export const waitFor = (
	condition: (() => Promise<boolean>) | (() => boolean),
	{ timeout = 30_000, interval = 250 }: WaitForOptions = {},
) => {
	let timeoutId: NodeJS.Timeout | undefined = undefined

	return Promise.race([
		new Promise<void>((resolve) => {
			const check = async () => {
				const result = condition()
				const isSatisfied = result instanceof Promise ? await result : result

				if (isSatisfied) {
					if (timeoutId) {
						clearTimeout(timeoutId)
						timeoutId = undefined
					}

					resolve()
				} else {
					setTimeout(check, interval)
				}
			}

			check()
		}),
		new Promise((_, reject) => {
			timeoutId = setTimeout(() => {
				reject(new Error(`Timeout after ${Math.floor(timeout / 1000)}s`))
			}, timeout)
		}),
	])
}

export const waitUntilReady = async (api: RooCodeAPI, { timeout = 10_000, interval = 250 }: WaitForOptions = {}) => {
	await vscode.commands.executeCommand("roo-cline.SidebarProvider.focus")
	await waitFor(api.isReady, { timeout, interval })
}

export const waitForToolUse = async (api: RooCodeAPI, toolName: string, options: WaitForOptions = {}) => {
	return waitFor(() => {
		const messages = api.getMessages()

		// Check for tool usage in multiple message formats
		return messages.some((message) => {
			// Check in tool message
			if (message.type === "say" && message.say === "tool" && message.text && message.text.includes(toolName)) {
				return true
			}

			// Check in API request started message
			if (
				message.type === "say" &&
				message.say === "api_req_started" &&
				message.text &&
				message.text.includes(toolName)
			) {
				return true
			}

			// Check in new task started message
			if (message.type === "say" && message.say === "new_task_started") {
				return true
			}

			// Check in subtask log messages
			if (
				message.type === "say" &&
				message.text &&
				message.text.includes("[subtasks] Task: ") &&
				message.text.includes("started at")
			) {
				return true
			}

			return false
		})
	}, options)
}

export const waitForMessage = async (
	api: RooCodeAPI,
	options: WaitForOptions & { include: string; exclude?: string },
) =>
	waitFor(
		() =>
			api
				.getMessages()
				.some(
					({ type, text }) =>
						type === "say" &&
						text &&
						text.includes(options.include) &&
						(!options.exclude || !text.includes(options.exclude)),
				),
		options,
	)

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
