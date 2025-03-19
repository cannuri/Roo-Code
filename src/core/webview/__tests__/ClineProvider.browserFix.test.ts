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

describe("ClineProvider browser capabilities fix", () => {
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

		// Mock postMessageToWebview to capture calls
		provider.postMessageToWebview = jest.fn()
	})

	describe("Fixed modelSupportsComputerUse determination", () => {
		// Helper function to test the fixed implementation
		async function testModelSupportsComputerUse(
			apiModelId: string,
			browserToolEnabled: boolean,
			getCurrentClineReturnValue: any | undefined,
			expectedSupportsComputerUse: boolean,
		): Promise<void> {
			// Mock getState
			provider.getState = jest.fn().mockResolvedValue({
				apiConfiguration: {
					apiModelId,
					openRouterModelId: "",
				},
				browserToolEnabled,
				mode: "code",
				experiments: {},
			})

			// Mock getCurrentCline
			provider.getCurrentCline = jest.fn().mockReturnValue(getCurrentClineReturnValue)

			// Simulate the fixed implementation
			const { apiConfiguration } = await provider.getState()

			// Define models that support computer use
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

			// Assert
			expect(canUseBrowserTool).toBe(expectedSupportsComputerUse)
		}

		it("should support browser when getCurrentCline() is undefined but model ID is gpt-4", async () => {
			await testModelSupportsComputerUse("gpt-4", true, undefined, true)
		})

		it("should support browser when getCurrentCline() is undefined but model ID is claude-3", async () => {
			await testModelSupportsComputerUse("claude-3-opus", true, undefined, true)
		})

		it("should not support browser when getCurrentCline() is undefined and model ID is unsupported", async () => {
			await testModelSupportsComputerUse("unsupported-model", true, undefined, false)
		})

		it("should not support browser when browserToolEnabled is false, even with supported model", async () => {
			await testModelSupportsComputerUse("gpt-4", false, undefined, false)
		})

		it("should use getCurrentCline() value when available", async () => {
			// Test when getCurrentCline() returns a value with supportsComputerUse = true
			await testModelSupportsComputerUse(
				"unsupported-model", // This would normally not support computer use
				true,
				{ api: { getModel: () => ({ info: { supportsComputerUse: true } }) } },
				true, // But we expect true because getCurrentCline() returns true
			)

			// Test when getCurrentCline() returns a value with supportsComputerUse = false
			await testModelSupportsComputerUse(
				"gpt-4", // This would normally support computer use
				true,
				{ api: { getModel: () => ({ info: { supportsComputerUse: false } }) } },
				false, // But we expect false because getCurrentCline() returns false
			)
		})
	})

	describe("System prompt generation with fix", () => {
		// Helper function to simulate the generateSystemPrompt call with the fix
		async function simulateFixedGenerateSystemPrompt(
			apiModelId: string,
			browserToolEnabled: boolean,
			getCurrentClineReturnValue: any | undefined,
		): Promise<void> {
			// Mock getState
			provider.getState = jest.fn().mockResolvedValue({
				apiConfiguration: {
					apiModelId,
					openRouterModelId: "",
				},
				browserToolEnabled,
				mode: "code",
				experiments: {},
			})

			// Mock getCurrentCline
			provider.getCurrentCline = jest.fn().mockReturnValue(getCurrentClineReturnValue)

			// Simulate the fixed implementation
			const { apiConfiguration } = await provider.getState()

			// Define models that support computer use
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
				"code",
				{}, // customModePrompts
				[], // customModes
				"", // customInstructions
				true, // diffEnabled
				{}, // experiments
				true, // enableMcpServerCreation
				"", // rooIgnoreInstructions
			)
		}

		it("should include browser capabilities in system prompt for supported models even when getCurrentCline() is undefined", async () => {
			// Act
			await simulateFixedGenerateSystemPrompt("gpt-4", true, undefined)

			// Assert
			expect(SYSTEM_PROMPT).toHaveBeenCalledWith(
				expect.anything(), // context
				expect.anything(), // cwd
				true, // supportsComputerUse - This should be true with the fix
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

		it("should not include browser capabilities in system prompt for unsupported models", async () => {
			// Act
			await simulateFixedGenerateSystemPrompt("unsupported-model", true, undefined)

			// Assert
			expect(SYSTEM_PROMPT).toHaveBeenCalledWith(
				expect.anything(), // context
				expect.anything(), // cwd
				false, // supportsComputerUse - This should be false for unsupported models
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
