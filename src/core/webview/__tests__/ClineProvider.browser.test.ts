import { ClineProvider } from "../ClineProvider"
import { ModelCapabilityManager } from "../../../shared/model-capability-manager"
import { logger } from "../../../utils/logging"

// Mock dependencies
jest.mock("../../../shared/model-capability-manager")
jest.mock("../../../utils/logging")
// Mock vscode module
jest.mock("vscode", () => {
	return {
		ExtensionContext: class {},
		OutputChannel: class {
			appendLine = jest.fn()
		},
		window: {
			createOutputChannel: jest.fn().mockReturnValue({
				appendLine: jest.fn(),
			}),
			createTextEditorDecorationType: jest.fn().mockReturnValue({}),
		},
		workspace: {
			getConfiguration: jest.fn().mockReturnValue({
				update: jest.fn(),
			}),
			workspaceFolders: [],
		},
		ConfigurationTarget: {
			Global: 1,
		},
		Uri: {
			joinPath: jest.fn().mockReturnValue({}),
		},
		commands: {
			executeCommand: jest.fn(),
		},
		env: {
			clipboard: {
				writeText: jest.fn(),
			},
		},
		ExtensionMode: {
			Development: 1,
			Production: 2,
		},
	}
})

// Mock other dependencies
jest.mock("../../../core/Cline", () => ({
	Cline: class {},
}))

jest.mock("../../../integrations/editor/DecorationController", () => ({}))

describe("ClineProvider browser tool functionality", () => {
	let provider: ClineProvider
	let mockContext: any
	let mockOutputChannel: any
	let mockCapabilityManager: jest.Mocked<ModelCapabilityManager>

	beforeEach(() => {
		jest.clearAllMocks()

		// Setup mocks
		mockContext = {
			globalState: {
				update: jest.fn(),
				get: jest.fn(),
			},
			secrets: {
				store: jest.fn(),
				get: jest.fn(),
			},
			extensionUri: { fsPath: "/test/path" },
			globalStorageUri: { fsPath: "/test/storage" },
			extensionMode: 1,
		}

		mockOutputChannel = {
			appendLine: jest.fn(),
		}

		// Setup ModelCapabilityManager mock
		mockCapabilityManager = {
			determineCapabilities: jest.fn().mockResolvedValue({
				supportedCapabilities: new Set(["computerUse"]),
				capabilityVersions: { computerUse: "1.0", imageAnalysis: "" },
				capabilityStrength: { computerUse: "basic", imageAnalysis: "basic" },
			}),
			supportsComputerUse: jest.fn().mockReturnValue(true),
			getCacheSize: jest.fn().mockReturnValue(0),
			getFromCache: jest.fn().mockResolvedValue(undefined),
			addToCache: jest.fn().mockResolvedValue(undefined),
			createEmptyCapabilityRecords: jest.fn(),
			clearCache: jest.fn().mockResolvedValue(undefined),
			dispose: jest.fn(),
		} as unknown as jest.Mocked<ModelCapabilityManager>

		// Mock the getInstance method
		jest.spyOn(ModelCapabilityManager, "getInstance").mockReturnValue(mockCapabilityManager)

		// Create provider instance
		provider = new ClineProvider(mockContext as any, mockOutputChannel as any)

		// Mock getCurrentCline
		provider.getCurrentCline = jest.fn().mockReturnValue({
			api: {
				getModel: jest.fn().mockReturnValue({
					id: "test-model",
					info: {
						supportsComputerUse: true,
					},
				}),
			},
		})

		// Mock getState
		provider.getState = jest.fn().mockResolvedValue({
			apiConfiguration: { apiModelId: "test-model" },
			browserToolEnabled: true,
		})
	})

	test("generateSystemPrompt should safely handle null/undefined values in capability check", async () => {
		// Access the private generateSystemPrompt method using any
		const generateSystemPrompt = (provider as any).generateSystemPrompt

		// Test with normal operation
		await generateSystemPrompt({ mode: "code" })

		expect(mockCapabilityManager.determineCapabilities).toHaveBeenCalled()
		expect(mockCapabilityManager.supportsComputerUse).toHaveBeenCalled()
		expect(logger.info).toHaveBeenCalledWith(
			expect.stringContaining("Browser tool availability"),
			expect.objectContaining({
				canUseBrowserTool: true,
			}),
		)

		// Test with null model
		provider.getCurrentCline = jest.fn().mockReturnValue({
			api: {
				getModel: jest.fn().mockReturnValue(null),
			},
		})

		await generateSystemPrompt({ mode: "code" })

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Model information not available"),
			expect.any(Object),
		)

		// Test with null API
		provider.getCurrentCline = jest.fn().mockReturnValue({
			api: null,
		})

		await generateSystemPrompt({ mode: "code" })

		expect(logger.debug).toHaveBeenCalledWith(
			expect.stringContaining("No active Cline instance"),
			expect.any(Object),
		)

		// Test with capability check error
		provider.getCurrentCline = jest.fn().mockReturnValue({
			api: {
				getModel: jest.fn().mockReturnValue({
					id: "test-model",
					info: {
						supportsComputerUse: true,
					},
				}),
			},
		})

		mockCapabilityManager.determineCapabilities.mockRejectedValueOnce(new Error("Test error"))

		await generateSystemPrompt({ mode: "code" })

		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Error checking browser capabilities"),
			expect.objectContaining({
				error: "Test error",
			}),
		)
	})

	test("generateSystemPrompt should respect browserToolEnabled setting", async () => {
		// Access the private generateSystemPrompt method using any
		const generateSystemPrompt = (provider as any).generateSystemPrompt

		// Test with browserToolEnabled = false
		provider.getState = jest.fn().mockResolvedValue({
			apiConfiguration: { apiModelId: "test-model" },
			browserToolEnabled: false,
		})

		await generateSystemPrompt({ mode: "code" })

		expect(logger.info).toHaveBeenCalledWith(
			expect.stringContaining("Browser tool availability"),
			expect.objectContaining({
				canUseBrowserTool: false,
				browserToolEnabled: false,
			}),
		)
	})
})
