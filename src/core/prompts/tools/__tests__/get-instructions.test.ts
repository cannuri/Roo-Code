import { getGetInstructionsDescription } from "../get-instructions"
import { ToolArgs } from "../types"
import { InstructionsRegistry } from "../../../../services/instructions/InstructionsRegistry"
import { getBrowserActionInstructions } from "../../../../services/instructions/sections/browser-action"
import { getMcpServerInstructions } from "../../../../services/instructions/sections/mcp-servers"

// Mock the instruction functions
jest.mock("../../../../services/instructions/sections/browser-action")
jest.mock("../../../../services/instructions/sections/mcp-servers")

describe("get_instructions tool", () => {
	describe("getGetInstructionsDescription", () => {
		it("returns a description for the get_instructions tool", () => {
			const args: ToolArgs = {
				cwd: "/test/path",
				supportsComputerUse: true,
			}

			const description = getGetInstructionsDescription(args)

			expect(description).toContain("## get_instructions")
			expect(description).toContain(
				"Description: Retrieves detailed instructions for specific components or features.",
			)
			expect(description).toContain("- section: (required) The ID of the section to retrieve")
			expect(description).toContain("<get_instructions>")
			expect(description).toContain("<section>section_id_here</section>")
			expect(description).toContain("</get_instructions>")
			expect(description).toContain("IMPORTANT: Always use the EXACT format shown above")
			expect(description).toContain("mcp_server_[name]: Documentation for a specific MCP server")
			expect(description).toContain("create_mcp_server: Instructions for creating a new MCP server")
		})
	})

	describe("get_instructions tool handler", () => {
		let registry: InstructionsRegistry

		beforeEach(() => {
			// Set up a fresh registry for each test
			registry = new InstructionsRegistry()

			// Mock the instruction functions
			const mockBrowserAction = getBrowserActionInstructions as jest.MockedFunction<
				typeof getBrowserActionInstructions
			>
			mockBrowserAction.mockResolvedValue("Browser Action Tool Documentation")

			const mockMcpServer = getMcpServerInstructions as jest.MockedFunction<typeof getMcpServerInstructions>
			mockMcpServer.mockResolvedValue("Test MCP Server Documentation")

			// Register the sections
			registry.registerSection({
				id: "browser_action",
				title: "Browser Action Tool",
				description: "Documentation for browser actions",
				getContent: getBrowserActionInstructions,
			})

			registry.registerSection({
				id: "mcp_server_test",
				title: "Test MCP Server Documentation",
				description: "Documentation for test MCP server",
				getContent: (context) => getMcpServerInstructions("test", context),
			})
		})

		it("should retrieve browser action instructions", async () => {
			const context = { cwd: "/test/path", mode: "code" }
			const content = await registry.getSection("browser_action", context)

			expect(content).toBe("Browser Action Tool Documentation")
			expect(getBrowserActionInstructions).toHaveBeenCalledWith(context)
		})

		it("should retrieve MCP server instructions", async () => {
			const context = { cwd: "/test/path", mode: "code" }
			const content = await registry.getSection("mcp_server_test", context)

			expect(content).toBe("Test MCP Server Documentation")
			expect(getMcpServerInstructions).toHaveBeenCalledWith("test", context)
		})

		it("should handle non-existent section gracefully", async () => {
			const context = { cwd: "/test/path", mode: "code" }
			const content = await registry.getSection("non_existent", context)

			expect(content).toBeNull()
		})

		it("should list available sections", () => {
			const sections = registry.getSectionIds()
			expect(sections).toContain("browser_action")
			expect(sections).toContain("mcp_server_test")
		})
	})
})
