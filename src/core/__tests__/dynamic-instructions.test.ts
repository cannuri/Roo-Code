import { InstructionsRegistry } from "../../services/instructions/InstructionsRegistry"
import {
	getMcpServerInstructions,
	getCreateMcpServerInstructions,
} from "../../services/instructions/sections/mcp-servers"
import { getBrowserActionInstructions } from "../../services/instructions/sections/browser-action"
import { standardSections } from "../../services/instructions/sections"

// Mock the MCP Hub and other dependencies
jest.mock("../../services/mcp/McpHub")
jest.mock("vscode")
jest.mock("../../services/instructions/sections/browser-action")
jest.mock("../../services/instructions/sections/mcp-servers")

describe("Dynamic Instructions System", () => {
	describe("get_instructions tool functionality", () => {
		let registry: InstructionsRegistry

		beforeEach(() => {
			// Set up a fresh registry for each test
			registry = new InstructionsRegistry()

			// Mock the instruction functions
			const mockBrowserAction = getBrowserActionInstructions as jest.MockedFunction<
				typeof getBrowserActionInstructions
			>
			mockBrowserAction.mockResolvedValue("Browser Action Tool\nAvailable Actions")

			const mockMcpServer = getMcpServerInstructions as jest.MockedFunction<typeof getMcpServerInstructions>
			mockMcpServer.mockResolvedValue("Test MCP Server")

			// Register the standard sections
			registry.registerSection({
				id: "browser_action",
				title: "Browser Action Tool",
				description: "Documentation for browser actions",
				getContent: getBrowserActionInstructions,
			})

			// Register a mock MCP server section
			registry.registerSection({
				id: "mcp_server_test",
				title: "Test MCP Server Documentation",
				description: "Documentation for test MCP server",
				getContent: (context) => getMcpServerInstructions("test", context),
			})
		})

		it("should retrieve browser action instructions", async () => {
			// This simulates what would happen in the get_instructions tool handler
			const context = { cwd: "/test/path", mode: "code" }
			const content = await registry.getSection("browser_action", context)

			expect(content).toBe("Browser Action Tool\nAvailable Actions")
		})

		it("should retrieve MCP server instructions", async () => {
			// This simulates what would happen in the get_instructions tool handler
			const context = { cwd: "/test/path", mode: "code" }
			const content = await registry.getSection("mcp_server_test", context)

			expect(content).toBe("Test MCP Server")
		})

		it("should handle non-existent section gracefully", async () => {
			// This simulates what would happen in the get_instructions tool handler
			const context = { cwd: "/test/path", mode: "code" }
			const content = await registry.getSection("non_existent", context)

			// The registry returns null for non-existent sections
			expect(content).toBeNull()

			// In the actual implementation, this would be formatted as an error message
			// with available sections, but we're testing the registry directly here
		})

		it("should list available sections", () => {
			const sections = registry.getSectionIds()
			expect(sections).toContain("browser_action")
			expect(sections).toContain("mcp_server_test")
		})
	})

	describe("InstructionsRegistry", () => {
		let registry: InstructionsRegistry

		beforeEach(() => {
			registry = new InstructionsRegistry()
			standardSections.forEach((section) => registry.registerSection(section))
		})

		it("should register and retrieve sections", async () => {
			// Test registration and retrieval
			const context = { someKey: "someValue" }
			const mockBrowserAction = getBrowserActionInstructions as jest.MockedFunction<
				typeof getBrowserActionInstructions
			>
			mockBrowserAction.mockResolvedValue("Browser Action Tool Content")

			const content = await registry.getSection("browser_action", context)
			expect(content).toBe("Browser Action Tool Content")
			expect(mockBrowserAction).toHaveBeenCalledWith(context)
		})

		it("should cache section content", async () => {
			// Test caching behavior
			const context = { someKey: "someValue" }
			const mockBrowserAction = getBrowserActionInstructions as jest.MockedFunction<
				typeof getBrowserActionInstructions
			>
			mockBrowserAction.mockResolvedValue("Cached content")

			// First call should execute the function
			await registry.getSection("browser_action", context)

			// Second call with same context should use cache
			await registry.getSection("browser_action", context)

			expect(mockBrowserAction).toHaveBeenCalledTimes(1)
		})

		it("should invalidate cache when context changes", async () => {
			// Test cache invalidation with different context
			const context1 = { someKey: "value1" }
			const context2 = { someKey: "value2" }
			const mockBrowserAction = getBrowserActionInstructions as jest.MockedFunction<
				typeof getBrowserActionInstructions
			>
			mockBrowserAction.mockResolvedValue("Context-specific content")

			await registry.getSection("browser_action", context1)
			await registry.getSection("browser_action", context2)

			expect(mockBrowserAction).toHaveBeenCalledTimes(2)
		})

		it("should handle dynamic MCP server sections", async () => {
			// Mock the getMcpServerInstructions function
			const mockMcpInstructions = getMcpServerInstructions as jest.MockedFunction<typeof getMcpServerInstructions>
			mockMcpInstructions.mockImplementation(
				async (name: string, ctx: any) => `Test MCP Server ${name} Instructions`,
			)

			// Register a dynamic MCP server section
			const serverName = "test-server"
			const sectionId = `mcp_server_${serverName}`
			registry.registerSection({
				id: sectionId,
				title: `${serverName} MCP Server Documentation`,
				description: `Detailed documentation for the ${serverName} MCP server`,
				getContent: (context: any) => getMcpServerInstructions(serverName, context),
			})

			// Test retrieving the section
			const context = { someKey: "someValue" }
			const content = await registry.getSection(sectionId, context)

			expect(content).toContain(`Test MCP Server ${serverName} Instructions`)
			expect(mockMcpInstructions).toHaveBeenCalledWith(serverName, context)
		})
	})

	describe("Error handling", () => {
		let registry: InstructionsRegistry

		beforeEach(() => {
			registry = new InstructionsRegistry()
		})

		it("should handle errors in getContent gracefully", async () => {
			// Register a section with a getContent function that throws an error
			registry.registerSection({
				id: "error_section",
				title: "Error Section",
				description: "A section that throws an error",
				getContent: async () => {
					throw new Error("Test error")
				},
			})

			// Spy on console.error
			const consoleSpy = jest.spyOn(console, "error").mockImplementation()

			// Attempt to get the section content
			const content = await registry.getSection("error_section", {})

			// Verify error handling
			expect(content).toBeNull()
			expect(consoleSpy).toHaveBeenCalled()

			// Restore console.error
			consoleSpy.mockRestore()
		})

		it("should handle circular references in context", async () => {
			// Register a test section
			registry.registerSection({
				id: "circular_context",
				title: "Circular Context Test",
				description: "Tests handling of circular references in context",
				getContent: async (ctx) => `Context received: ${typeof ctx}`,
			})

			// Create a context with circular references
			const circularContext: any = { name: "test" }
			circularContext.self = circularContext

			// Attempt to get the section with circular context
			const content = await registry.getSection("circular_context", circularContext)

			// Verify it still works
			expect(content).not.toBeNull()
			expect(content).toContain("Context received: object")
		})
	})

	describe("Dynamic section registration", () => {
		it("should register standard sections", () => {
			// Create a new registry and register standard sections
			const registry = new InstructionsRegistry()
			standardSections.forEach((section) => registry.registerSection(section))

			// Check that standard sections are registered
			const sectionIds = registry.getSectionIds()
			expect(sectionIds).toContain("browser_action")
			expect(sectionIds).toContain("create_mcp_server")
		})

		it("should register MCP server sections dynamically", () => {
			// Create a new registry
			const registry = new InstructionsRegistry()

			// Create a mock MCP Hub
			const mockMcpHub = {
				getServers: jest.fn().mockReturnValue([{ name: "test", status: "connected", tools: [] }]),
			}

			// Register MCP server sections
			const servers = mockMcpHub.getServers()
			servers.forEach((server: { name: string; status: string; tools: any[] }) => {
				registry.registerSection({
					id: `mcp_server_${server.name}`,
					title: `${server.name} MCP Server Documentation`,
					description: `Detailed documentation for the ${server.name} MCP server`,
					getContent: (context) => getMcpServerInstructions(server.name, context),
				})
			})

			// Check that the MCP server section is registered
			const sectionIds = registry.getSectionIds()
			expect(sectionIds).toContain("mcp_server_test")
		})
	})
})
