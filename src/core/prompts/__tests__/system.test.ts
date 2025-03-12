import * as toolsIndex from "../tools/index"
import { getGetInstructionsDescription } from "../tools/get-instructions"
import { getBrowserActionDescription } from "../tools/browser-action"
import { getMcpServersSection } from "../sections/mcp-servers"
import { SYSTEM_PROMPT } from "../system"
import * as vscode from "vscode"

// Create a mock ExtensionContext
const mockContext = {
	extensionPath: "mock/extension/path",
	globalStoragePath: "mock/storage/path",
	storagePath: "mock/storage/path",
	logPath: "mock/log/path",
	subscriptions: [],
	workspaceState: {
		get: () => undefined,
		update: () => Promise.resolve(),
	},
	globalState: {
		get: () => undefined,
		update: () => Promise.resolve(),
		setKeysForSync: () => {},
	},
	extensionUri: { fsPath: "mock/extension/path" },
	globalStorageUri: { fsPath: "mock/settings/path" },
	asAbsolutePath: (relativePath: string) => `mock/extension/path/${relativePath}`,
	extension: {
		packageJSON: {
			version: "1.0.0",
		},
	},
} as unknown as vscode.ExtensionContext

describe("System Prompt Components", () => {
	it("should export getGetInstructionsDescription in tools/index.ts", () => {
		// Verify that getGetInstructionsDescription is exported from tools/index.ts
		expect(toolsIndex.getGetInstructionsDescription).toBeDefined()
		expect(toolsIndex.getGetInstructionsDescription).toBe(getGetInstructionsDescription)
	})

	it("should include get_instructions in the tools module", () => {
		// Import the tools module directly
		const toolsModule = require("../tools/index")

		// Verify that get_instructions is included in the exports
		expect(toolsModule.getGetInstructionsDescription).toBeDefined()

		// Check if the function is properly implemented
		const getInstructionsDesc = getGetInstructionsDescription({
			cwd: "/test/path",
			supportsComputerUse: true,
		})
		expect(getInstructionsDesc).toContain("get_instructions")
		expect(getInstructionsDesc).toContain("<get_instructions>")
		expect(getInstructionsDesc).toContain("<section>section_id_here</section>")
	})

	it("should have a simplified browser_action description", () => {
		const browserActionDesc = getBrowserActionDescription({
			supportsComputerUse: true,
			cwd: "/test/path",
		})

		// Verify that the browser_action description is simplified
		expect(browserActionDesc).toContain("browser_action")
		expect(browserActionDesc).toContain("For detailed documentation and usage examples, use:")
		expect(browserActionDesc).toContain("<get_instructions>")
		expect(browserActionDesc).toContain("<section>browser_action</section>")
	})

	it("should have simplified MCP server section", async () => {
		const mockMcpHub = {
			getServers: jest.fn().mockReturnValue([{ name: "test-server", status: "connected", tools: [] }]),
		}

		const mcpServersSection = await getMcpServersSection(mockMcpHub as any)

		// Verify that the MCP server section mentions get_instructions
		expect(mcpServersSection).toContain(
			"When a server is connected, you MUST first retrieve the full documentation",
		)
		expect(mcpServersSection).toContain("<get_instructions>")
		expect(mcpServersSection).toContain("<section>mcp_server_[name]</section>")
	})
})

describe("SYSTEM_PROMPT", () => {
	it("should include complete get_instructions tool definition", async () => {
		const cwd = "/test/path"
		const prompt = await SYSTEM_PROMPT(mockContext, cwd, true)

		// Check for the get_instructions description
		expect(prompt).toContain("get_instructions")
		expect(prompt).toContain("Retrieves detailed instructions for specific components")

		// Check for usage example
		expect(prompt).toContain("<get_instructions>")
		expect(prompt).toContain("<section>section_id_here</section>")
		expect(prompt).toContain("</get_instructions>")
	})

	it("should generate a concise prompt with essential sections only", async () => {
		const cwd = "/test/path"
		const mockMcpHub = {
			getServers: jest.fn().mockReturnValue([{ name: "test-server", status: "connected", tools: [] }]),
		}
		const prompt = await SYSTEM_PROMPT(mockContext, cwd, true, mockMcpHub as any)

		// Check that essential sections are included
		expect(prompt).toContain("CAPABILITIES")
		expect(prompt).toContain("RULES")
		expect(prompt).toContain("SYSTEM INFORMATION")
		expect(prompt).toContain("OBJECTIVE")
		expect(prompt).toContain("TOOL USE")
		expect(prompt).toContain("MCP SERVERS")
		expect(prompt).toContain("# Connected MCP Servers")

		// Check that the get_instructions reference note is included
		expect(prompt).toContain(
			"NOTE: Additional detailed documentation is available through the get_instructions tool.",
		)
		expect(prompt).toContain("Use <get_instructions><section>section_name</section></get_instructions> to access:")
		expect(prompt).toContain('- Available modes (section="modes")')
		expect(prompt).toContain('- Additional capabilities (section="extended_capabilities")')

		// Verify that the simplified MCP servers section is included in the prompt
		expect(prompt).toContain("When a server is connected, you MUST first retrieve the full documentation")
		expect(prompt).toContain("<get_instructions>")
		expect(prompt).toContain("<section>mcp_server_[name]</section>")

		// Verify that detailed MCP documentation is not included directly in the prompt
		// but is referenced through get_instructions
		const mcpDetailedDocs = "For detailed documentation on each MCP server tool"
		expect(prompt.includes(mcpDetailedDocs)).toBeFalsy()
	})
})
