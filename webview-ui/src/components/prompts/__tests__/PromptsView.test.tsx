import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import PromptsView from "../PromptsView"
import { ExtensionStateContext } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

// Mock vscode API
jest.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

const mockExtensionState = {
	customModePrompts: {},
	listApiConfigMeta: [
		{ id: "config1", name: "Config 1" },
		{ id: "config2", name: "Config 2" },
	],
	enhancementApiConfigId: "",
	setEnhancementApiConfigId: jest.fn(),
	mode: "code",
	customInstructions: "Initial instructions",
	setCustomInstructions: jest.fn(),
}

const renderPromptsView = (props = {}) => {
	const mockOnDone = jest.fn()
	return render(
		<ExtensionStateContext.Provider value={{ ...mockExtensionState, ...props } as any}>
			<PromptsView onDone={mockOnDone} />
		</ExtensionStateContext.Provider>,
	)
}

describe("PromptsView", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("renders all mode tabs", () => {
		renderPromptsView()
		expect(screen.getByTestId("code-tab")).toBeInTheDocument()
		expect(screen.getByTestId("ask-tab")).toBeInTheDocument()
		expect(screen.getByTestId("architect-tab")).toBeInTheDocument()
	})

	it("defaults to current mode as active tab", () => {
		renderPromptsView({ mode: "ask" })

		const codeTab = screen.getByTestId("code-tab")
		const askTab = screen.getByTestId("ask-tab")
		const architectTab = screen.getByTestId("architect-tab")

		expect(askTab).toHaveAttribute("data-active", "true")
		expect(codeTab).toHaveAttribute("data-active", "false")
		expect(architectTab).toHaveAttribute("data-active", "false")
	})

	it("switches between tabs correctly", async () => {
		const { rerender } = render(
			<ExtensionStateContext.Provider value={{ ...mockExtensionState, mode: "code" } as any}>
				<PromptsView onDone={jest.fn()} />
			</ExtensionStateContext.Provider>,
		)

		const codeTab = screen.getByTestId("code-tab")
		const askTab = screen.getByTestId("ask-tab")
		const architectTab = screen.getByTestId("architect-tab")

		// Initial state matches current mode (code)
		expect(codeTab).toHaveAttribute("data-active", "true")
		expect(askTab).toHaveAttribute("data-active", "false")
		expect(architectTab).toHaveAttribute("data-active", "false")

		// Click Ask tab and update context
		fireEvent.click(askTab)
		rerender(
			<ExtensionStateContext.Provider value={{ ...mockExtensionState, mode: "ask" } as any}>
				<PromptsView onDone={jest.fn()} />
			</ExtensionStateContext.Provider>,
		)

		expect(askTab).toHaveAttribute("data-active", "true")
		expect(codeTab).toHaveAttribute("data-active", "false")
		expect(architectTab).toHaveAttribute("data-active", "false")

		// Click Architect tab and update context
		fireEvent.click(architectTab)
		rerender(
			<ExtensionStateContext.Provider value={{ ...mockExtensionState, mode: "architect" } as any}>
				<PromptsView onDone={jest.fn()} />
			</ExtensionStateContext.Provider>,
		)

		expect(architectTab).toHaveAttribute("data-active", "true")
		expect(askTab).toHaveAttribute("data-active", "false")
		expect(codeTab).toHaveAttribute("data-active", "false")
	})

	it("handles prompt changes correctly", async () => {
		renderPromptsView()

		// Get the textarea
		const textarea = await waitFor(() => screen.getByTestId("code-prompt-textarea"))
		fireEvent.change(textarea, {
			target: { value: "New prompt value" },
		})

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "updatePrompt",
			promptMode: "code",
			customPrompt: { roleDefinition: "New prompt value" },
		})
	})

	it("resets role definition only for built-in modes", async () => {
		const customMode = {
			slug: "custom-mode",
			name: "Custom Mode",
			roleDefinition: "Custom role",
			groups: [],
		}

		// Test with built-in mode (code)
		const { unmount } = render(
			<ExtensionStateContext.Provider
				value={{ ...mockExtensionState, mode: "code", customModes: [customMode] } as any}>
				<PromptsView onDone={jest.fn()} />
			</ExtensionStateContext.Provider>,
		)

		// Find and click the role definition reset button
		const resetButton = screen.getByTestId("role-definition-reset")
		expect(resetButton).toBeInTheDocument()
		await fireEvent.click(resetButton)

		// Verify it only resets role definition
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "updatePrompt",
			promptMode: "code",
			customPrompt: { roleDefinition: undefined },
		})

		// Cleanup before testing custom mode
		unmount()

		// Test with custom mode
		render(
			<ExtensionStateContext.Provider
				value={{ ...mockExtensionState, mode: "custom-mode", customModes: [customMode] } as any}>
				<PromptsView onDone={jest.fn()} />
			</ExtensionStateContext.Provider>,
		)

		// Verify reset button is not present for custom mode
		expect(screen.queryByTestId("role-definition-reset")).not.toBeInTheDocument()
	})

	it("handles API configuration selection", async () => {
		renderPromptsView()

		// Click the ENHANCE tab first to show the API config dropdown
		const enhanceTab = screen.getByTestId("ENHANCE-tab")
		fireEvent.click(enhanceTab)

		// Wait for the ENHANCE tab click to take effect
		const dropdown = await waitFor(() => screen.getByTestId("api-config-dropdown"))
		fireEvent.change(dropdown, {
			target: { value: "config1" },
		})

		expect(mockExtensionState.setEnhancementApiConfigId).toHaveBeenCalledWith("config1")
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "enhancementApiConfigId",
			text: "config1",
		})
	})

	it("handles clearing custom instructions correctly", async () => {
		const setCustomInstructions = jest.fn()
		renderPromptsView({
			...mockExtensionState,
			customInstructions: "Initial instructions",
			setCustomInstructions,
		})

		const textarea = screen.getByTestId("global-custom-instructions-textarea")
		fireEvent.change(textarea, {
			target: { value: "" },
		})

		expect(setCustomInstructions).toHaveBeenCalledWith(undefined)
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "customInstructions",
			text: undefined,
		})
	})
})

describe("PromptsView - Custom Mode Editing", () => {
	const customMode = {
		slug: "custom-test-mode",
		name: "Custom Test Mode",
		roleDefinition: "Act as a custom test mode.",
		groups: [],
		toolPermissions: {}, // Start with no specific tool permissions
	}

	const renderWithCustomMode = (currentModeSlug = customMode.slug) => {
		const mockOnDone = jest.fn()
		return render(
			<ExtensionStateContext.Provider
				value={
					{
						...mockExtensionState,
						mode: currentModeSlug,
						customModes: [customMode],
						customModePrompts: {
							[customMode.slug]: customMode,
						},
					} as any
				}>
				<PromptsView onDone={mockOnDone} />
			</ExtensionStateContext.Provider>,
		)
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("renders the custom mode tab", () => {
		renderWithCustomMode()
		expect(screen.getByTestId(`${customMode.slug}-tab`)).toBeInTheDocument()
		expect(screen.getByTestId(`${customMode.slug}-tab`)).toHaveAttribute("data-active", "true")
	})

	// --- NEW Tool Permission Tests (Expected to Fail) ---

	it("renders the subtask permission checkbox for custom modes", async () => {
		renderWithCustomMode()
		// Click the edit button first
		const editButton = screen.getByTitle("prompts:tools.editTools") // Assuming English translation
		fireEvent.click(editButton)
		// Now find the checkbox
		const checkbox = await screen.findByTestId("tool-permission-subtask-checkbox")
		expect(checkbox).toBeInTheDocument()
		expect(checkbox).not.toBeChecked() // Assuming default is unchecked
	})

	it("renders the switch permission checkbox for custom modes", async () => {
		renderWithCustomMode()
		// Click the edit button first
		const editButton = screen.getByTitle("prompts:tools.editTools") // Assuming English translation
		fireEvent.click(editButton)
		// Now find the checkbox
		const checkbox = await screen.findByTestId("tool-permission-switch-checkbox")
		expect(checkbox).toBeInTheDocument()
		expect(checkbox).not.toBeChecked() // Assuming default is unchecked
	})

	it("renders the followup permission checkbox for custom modes", async () => {
		renderWithCustomMode()
		// Click the edit button first
		const editButton = screen.getByTitle("prompts:tools.editTools") // Assuming English translation
		fireEvent.click(editButton)
		// Now find the checkbox
		const checkbox = await screen.findByTestId("tool-permission-followup-checkbox")
		expect(checkbox).toBeInTheDocument()
		expect(checkbox).not.toBeChecked() // Assuming default is unchecked
	})

	it("updates state when subtask permission checkbox is clicked", async () => {
		const { rerender } = renderWithCustomMode() // Capture rerender
		// Click the edit button first
		const editButton = screen.getByTitle("prompts:tools.editTools") // Assuming English translation
		fireEvent.click(editButton)
		// Now find the checkbox
		const checkbox = await screen.findByTestId("tool-permission-subtask-checkbox")
		fireEvent.click(checkbox)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "updateCustomMode",
			slug: customMode.slug,
			modeConfig: {
				...customMode,
				groups: ["subtask"], // Expect group to be added
				source: "global", // Assuming default source
			},
		})

		// Simulate state update by re-rendering with the new group
		const updatedSubtaskMode = { ...customMode, groups: ["subtask"] }
		rerender(
			<ExtensionStateContext.Provider
				value={
					{
						...mockExtensionState,
						mode: customMode.slug,
						customModes: [updatedSubtaskMode],
						customModePrompts: {
							[customMode.slug]: updatedSubtaskMode,
						},
					} as any
				}>
				<PromptsView onDone={jest.fn()} />
			</ExtensionStateContext.Provider>,
		)

		// Click again to uncheck
		fireEvent.click(checkbox)
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "updateCustomMode",
			slug: customMode.slug,
			modeConfig: {
				...customMode,
				groups: [], // Expect group to be removed
				source: "global",
			},
		})
	})

	it("updates state when switch permission checkbox is clicked", async () => {
		const { rerender } = renderWithCustomMode() // Capture rerender
		// Click the edit button first
		const editButton = screen.getByTitle("prompts:tools.editTools") // Assuming English translation
		fireEvent.click(editButton)
		// Now find the checkbox
		const checkbox = await screen.findByTestId("tool-permission-switch-checkbox")
		fireEvent.click(checkbox)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "updateCustomMode",
			slug: customMode.slug,
			modeConfig: {
				...customMode,
				groups: ["switch"], // Expect group to be added
				source: "global",
			},
		})

		// Simulate state update by re-rendering with the new group
		const updatedSwitchMode = { ...customMode, groups: ["switch"] }
		rerender(
			<ExtensionStateContext.Provider
				value={
					{
						...mockExtensionState,
						mode: customMode.slug,
						customModes: [updatedSwitchMode],
						customModePrompts: {
							[customMode.slug]: updatedSwitchMode,
						},
					} as any
				}>
				<PromptsView onDone={jest.fn()} />
			</ExtensionStateContext.Provider>,
		)

		// Click again to uncheck
		fireEvent.click(checkbox)
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "updateCustomMode",
			slug: customMode.slug,
			modeConfig: {
				...customMode,
				groups: [], // Expect group to be removed
				source: "global",
			},
		})
	})

	it("updates state when followup permission checkbox is clicked", async () => {
		const { rerender } = renderWithCustomMode() // Capture rerender
		// Click the edit button first
		const editButton = screen.getByTitle("prompts:tools.editTools") // Assuming English translation
		fireEvent.click(editButton)
		// Now find the checkbox
		const checkbox = await screen.findByTestId("tool-permission-followup-checkbox")
		fireEvent.click(checkbox)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "updateCustomMode",
			slug: customMode.slug,
			modeConfig: {
				...customMode,
				groups: ["followup"], // Expect group to be added
				source: "global",
			},
		})

		// Simulate state update by re-rendering with the new group
		const updatedFollowupMode = { ...customMode, groups: ["followup"] }
		rerender(
			<ExtensionStateContext.Provider
				value={
					{
						...mockExtensionState,
						mode: customMode.slug,
						customModes: [updatedFollowupMode],
						customModePrompts: {
							[customMode.slug]: updatedFollowupMode,
						},
					} as any
				}>
				<PromptsView onDone={jest.fn()} />
			</ExtensionStateContext.Provider>,
		)

		// Click again to uncheck
		fireEvent.click(checkbox)
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "updateCustomMode",
			slug: customMode.slug,
			modeConfig: {
				...customMode,
				groups: [], // Expect group to be removed
				source: "global",
			},
		})
	})
})
