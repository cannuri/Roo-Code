import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import ChatRow from "../ChatRow"
import { ClineMessage, ClineSayTool } from "@roo/shared/ExtensionMessage"
import { vi } from "vitest"

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { [key: string]: any }) => {
			if (key === "tools:readFile.truncateTooltip") {
				return "File content truncated. Click for details."
			}
			if (key === "chat:fileOperations.wantsToRead") {
				return "Wants to read file:"
			}
			if (key === "chat:fileOperations.didRead") {
				return "Read file:"
			}
			// Add other translations if ChatRow uses them and they affect these tests
			return `${key} ${options ? JSON.stringify(options) : ""}`
		},
	}),
}))

vi.mock("../../../utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock useExtensionState as ChatRowContent uses it
vi.mock("../../../context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		mcpServers: [],
		alwaysAllowMcp: false,
		currentCheckpoint: null,
		// Add other state properties if they become relevant for these tests
	}),
}))

// Base properties for mock messages, ensuring they are part of ClineMessage
const mockMessageBase = {
	role: "assistant" as const, // Use 'as const' for literal types
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	isLoading: false,
	isError: false,
	isCollapsed: false,
	executionId: "exec-123",
	// id will be set uniquely per message in getMockMessage
	partial: false,
	// progressStatus, images, checkpoint can be omitted if not needed or set to undefined
}

const defaultChatRowProps = {
	isExpanded: true,
	isLast: true,
	isStreaming: false,
	onToggleExpand: vi.fn(),
	onHeightChange: vi.fn(),
	lastModifiedMessage: undefined,
	onSuggestionClick: vi.fn(),
}

// Helper to remove the LRM character for exact matching if needed
// The component uses `tool.path ?? ""` and adds `\u200E` (LRM)
const formatPathForAssertion = (path: string) => `${path}\u200E`

describe("ChatRow", () => {
	describe("readFile tool message rendering", () => {
		const filePath = "mock/file.txt"
		const wantsToReadText = "Wants to read file:" // From mock t function

		const getMockMessage = (toolPayload: Partial<ClineSayTool>): ClineMessage => {
			// Construct the tool-specific part of the payload (for readFile)
			const readFileSpecificPayload: Partial<ClineSayTool> = {
				tool: "readFile",
				path: filePath,
				content: filePath, // In readFile, content is often the path for linking
				...toolPayload, // This will add isFileTruncated, reason, totalLines
			}

			// Create the full message object
			const message: ClineMessage = {
				...mockMessageBase, // Spread base properties
				// id: `msg-${Math.random().toString(36).substring(7)}`, // Temporarily remove to bypass TS issue
				ts: Date.now() + Math.random(), // Unique timestamp
				type: "ask", // For tool interactions like "wants to read", it's an 'ask'
				ask: "tool", // Specifically a 'tool' type of ask
				text: JSON.stringify(readFileSpecificPayload), // The tool payload is stringified in 'text'
				// No `say` property when type is 'ask'
			}
			return message
		}

		// Scenario A: Not Truncated
		it("should render readFile tool message without truncation info when isFileTruncated is false", () => {
			const mockMessage = getMockMessage({
				isFileTruncated: false,
				totalLines: 50,
				reason: undefined,
			})

			render(<ChatRow {...defaultChatRowProps} message={mockMessage} />)

			expect(screen.getByText(wantsToReadText)).toBeInTheDocument()
			// The path is rendered inside a complex structure, let's find it more reliably
			// It's inside a clickable div, and the text is tool.path + LRM
			const pathDisplayElement = screen.getByText(formatPathForAssertion(filePath))
			expect(pathDisplayElement).toBeInTheDocument()

			// Assert: Truncation reason is NOT rendered.
			// If reason is part of the same span as path, we check that the path element does not contain it.
			// Or, if it would be a separate element, query for it.
			// Given the component structure: {removeLeadingNonAlphanumeric(tool.path ?? "") + "\u200E"} {tool.reason}
			// We expect the pathDisplayElement not to contain any typical reason text.
			// A more direct way is to ensure no element with the reason text exists.
			expect(screen.queryByText(/\(max \d+ lines\)/i)).not.toBeInTheDocument() // Example reason format

			// Assert: Info icon is NOT rendered
			expect(document.querySelector(".codicon-info")).not.toBeInTheDocument()
			expect(screen.queryByTitle("File content truncated. Click for details.")).not.toBeInTheDocument()
		})

		// Scenario B: Truncated
		it("should render readFile tool message with truncation info and icon when isFileTruncated is true", () => {
			const truncationReason = "(max 100 lines)"
			const mockMessage = getMockMessage({
				isFileTruncated: true,
				totalLines: 150,
				reason: truncationReason,
			})

			render(<ChatRow {...defaultChatRowProps} message={mockMessage} />)

			expect(screen.getByText(wantsToReadText)).toBeInTheDocument()

			// The path and reason are rendered together:
			// {removeLeadingNonAlphanumeric(tool.path ?? "") + "\u200E"} {tool.reason}
			// We can check for the combined text or parts of it.
			const pathAndReasonContainer = screen.getByText((content, _element) => {
				return content.includes(formatPathForAssertion(filePath)) && content.includes(truncationReason)
			})
			expect(pathAndReasonContainer).toBeInTheDocument()

			// Assert: Info icon IS rendered (assuming it will be added next to the reason)
			// The task implies an icon will be added.
			// The icon itself has an aria-label.
			const infoIcon = screen.getByLabelText("File content truncated. Click for details.")
			expect(infoIcon).toBeInTheDocument()
			expect(infoIcon).toHaveClass("codicon-info") // Check for the icon class

			// The tooltip content is also available if rendered (e.g. on hover/focus)
			// For this test, checking the icon's presence and aria-label is sufficient.
			// If we needed to test tooltip visibility, we'd need to simulate hover/focus.
		})
	})
})
