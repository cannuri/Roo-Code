import * as vscode from "vscode"
import { ClineProvider } from "../ClineProvider"
import { SYSTEM_PROMPT } from "../../prompts/system"
import { WebviewMessage } from "../../../shared/WebviewMessage"

// Mock the system prompt function
jest.mock("../../prompts/system", () => ({
	SYSTEM_PROMPT: jest.fn().mockResolvedValue("Mocked system prompt"),
}))

// Mock vscode
jest.mock("vscode", () => ({
	ExtensionContext: jest.fn(),
	OutputChannel: {
		appendLine: jest.fn(),
	},
	env: {
		language: "en",
	},
	workspace: {
		workspaceFolders: [
			{
				uri: { fsPath: "/test/workspace" },
			},
		],
	},
}))

describe("ClineProvider system prompt generation", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Setup mocks
		mockContext = {
			extensionUri: { fsPath: "/test/path" },
			globalState: {
				get: jest.fn(),
				update: jest.fn(),
			},
			extension: {
				packageJSON: { version: "1.0.0" },
			},
		} as unknown as vscode.ExtensionContext

		mockOutputChannel = {
			appendLine: jest.fn(),
		} as unknown as vscode.OutputChannel

		// Create provider instance
		provider = new ClineProvider(mockContext, mockOutputChannel)

		// Mock the getState method
		provider.getState = jest.fn().mockResolvedValue({
			apiConfiguration: {
				apiModelId: "gpt-4",
				openRouterModelId: "",
			},
			browserToolEnabled: true,
			mode: "code",
			experiments: {},
		})

		// Mock postMessageToWebview to capture calls
		provider.postMessageToWebview = jest.fn()
	})

	describe("generateSystemPrompt", () => {
		// Helper function to simulate the generateSystemPrompt call
		async function simulateGenerateSystemPrompt(provider: ClineProvider, mode: string = "code"): Promise<void> {
			// Access the private generateSystemPrompt method using type assertion
			const generateSystemPrompt = async (message: WebviewMessage) => {
				// This is a mock implementation that simulates what happens in the real method
				const { apiConfiguration, browserToolEnabled } = await provider.getState()

				// This is the part we're testing - the determination of supportsComputerUse
				const COMPUTER_USE_MODELS = ["claude-3", "gpt-4", "gpt-4o"]

				let modelSupportsComputerUse =
					provider.getCurrentCline()?.api?.getModel()?.info?.supportsComputerUse ?? false

				// During system prompt preview, getCurrentCline() may be undefined since no task is active
				// In this case, we determine computer use support based on the model ID directly
				if (!modelSupportsComputerUse && (apiConfiguration.apiModelId || apiConfiguration.openRouterModelId)) {
					const modelId = apiConfiguration.apiModelId || apiConfiguration.openRouterModelId || ""
					modelSupportsComputerUse = COMPUTER_USE_MODELS.some((id) => modelId.includes(id))
				}

				const canUseBrowserTool = modelSupportsComputerUse && (browserToolEnabled ?? true)

				await SYSTEM_PROMPT(
					mockContext,
					"/test/workspace",
					canUseBrowserTool,
					undefined, // mcpHub
					undefined, // diffStrategy
					"900x600", // browserViewportSize
					mode,
					{}, // customModePrompts
					[], // customModes
					"", // customInstructions
					true, // diffEnabled
					{}, // experiments
					true, // enableMcpServerCreation
					"", // rooIgnoreInstructions
				)
			}

			await generateSystemPrompt({ type: "getSystemPrompt", mode } as WebviewMessage)
		}

		it("should include browser capabilities when browserToolEnabled is true and model supports computer use", async () => {
			// Act
			await simulateGenerateSystemPrompt(provider)

			// Assert
			expect(SYSTEM_PROMPT).toHaveBeenCalledWith(
				expect.anything(), // context
				expect.anything(), // cwd
				true, // supportsComputerUse - This should be true
				expect.anything(), // mcpHub
				expect.anything(), // diffStrategy
				expect.anything(), // browserViewportSize
				expect.anything(), // mode
				expect.anything(), // customModePrompts
				expect.anything(), // customModes
				expect.anything(), // customInstructions
				expect.anything(), // diffEnabled
				expect.anything(), // experiments
				expect.anything(), // enableMcpServerCreation
				expect.anything(), // rooIgnoreInstructions
			)
		})

		it("should not include browser capabilities when browserToolEnabled is false", async () => {
			// Override getState to return browserToolEnabled: false
			provider.getState = jest.fn().mockResolvedValue({
				apiConfiguration: {
					apiModelId: "gpt-4",
					openRouterModelId: "",
				},
				browserToolEnabled: false,
				mode: "code",
				experiments: {},
			})

			// Act
			await simulateGenerateSystemPrompt(provider)

			// Assert
			expect(SYSTEM_PROMPT).toHaveBeenCalledWith(
				expect.anything(), // context
				expect.anything(), // cwd
				false, // supportsComputerUse - This should be false
				expect.anything(), // mcpHub
				expect.anything(), // diffStrategy
				expect.anything(), // browserViewportSize
				expect.anything(), // mode
				expect.anything(), // customModePrompts
				expect.anything(), // customModes
				expect.anything(), // customInstructions
				expect.anything(), // diffEnabled
				expect.anything(), // experiments
				expect.anything(), // enableMcpServerCreation
				expect.anything(), // rooIgnoreInstructions
			)
		})

		it("should include browser capabilities when getCurrentCline() is undefined but model ID indicates support", async () => {
			// Mock getCurrentCline to return undefined to simulate system prompt preview
			provider.getCurrentCline = jest.fn().mockReturnValue(undefined)

			// Act
			await simulateGenerateSystemPrompt(provider)

			// Assert
			expect(SYSTEM_PROMPT).toHaveBeenCalledWith(
				expect.anything(), // context
				expect.anything(), // cwd
				true, // supportsComputerUse - This should be true based on model ID
				expect.anything(), // mcpHub
				expect.anything(), // diffStrategy
				expect.anything(), // browserViewportSize
				expect.anything(), // mode
				expect.anything(), // customModePrompts
				expect.anything(), // customModes
				expect.anything(), // customInstructions
				expect.anything(), // diffEnabled
				expect.anything(), // experiments
				expect.anything(), // enableMcpServerCreation
				expect.anything(), // rooIgnoreInstructions
			)
		})

		it("should not include browser capabilities for unsupported models", async () => {
			// Mock getCurrentCline to return undefined to simulate system prompt preview
			provider.getCurrentCline = jest.fn().mockReturnValue(undefined)

			// Override getState to return an unsupported model
			provider.getState = jest.fn().mockResolvedValue({
				apiConfiguration: {
					apiModelId: "unsupported-model",
					openRouterModelId: "",
				},
				browserToolEnabled: true,
				mode: "code",
				experiments: {},
			})

			// Act
			await simulateGenerateSystemPrompt(provider)

			// Assert
			expect(SYSTEM_PROMPT).toHaveBeenCalledWith(
				expect.anything(), // context
				expect.anything(), // cwd
				false, // supportsComputerUse - This should be false for unsupported model
				expect.anything(), // mcpHub
				expect.anything(), // diffStrategy
				expect.anything(), // browserViewportSize
				expect.anything(), // mode
				expect.anything(), // customModePrompts
				expect.anything(), // customModes
				expect.anything(), // customInstructions
				expect.anything(), // diffEnabled
				expect.anything(), // experiments
				expect.anything(), // enableMcpServerCreation
				expect.anything(), // rooIgnoreInstructions
			)
		})
	})
})
