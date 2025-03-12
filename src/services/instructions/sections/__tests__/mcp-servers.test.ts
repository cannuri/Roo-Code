import { getMcpServerInstructions, getCreateMcpServerInstructions } from "../mcp-servers"
import { McpServer, McpTool } from "../../../../shared/mcp"

describe("MCP Server Instructions", () => {
	describe("getMcpServerInstructions", () => {
		it("should return error message when mcpHub is not available", async () => {
			const result = await getMcpServerInstructions("test-server", {})
			expect(result).toContain("Error: MCP Hub not available")
		})

		it("should return error message when server is not found", async () => {
			const mockMcpHub = {
				getServers: jest.fn().mockReturnValue([]),
				getServerByName: jest.fn().mockReturnValue(undefined),
			}

			const result = await getMcpServerInstructions("non-existent-server", { mcpHub: mockMcpHub })
			expect(result).toContain("Error: MCP Server 'non-existent-server' not found")
		})

		it("should generate instructions for a server with tools", async () => {
			const mockTool: McpTool = {
				name: "test-tool",
				description: "A test tool",
				inputSchema: {
					type: "object",
					properties: {
						param1: {
							type: "string",
							description: "Parameter 1",
						},
						param2: {
							type: "number",
							description: "Parameter 2",
						},
					},
					required: ["param1"],
				} as any,
			}

			const mockServer: McpServer = {
				name: "test-server",
				config: "{}",
				status: "connected",
				tools: [mockTool],
			}

			const mockMcpHub = {
				getServerByName: jest.fn().mockReturnValue(mockServer),
			}

			const result = await getMcpServerInstructions("test-server", { mcpHub: mockMcpHub })

			// Check that the result contains the expected content
			expect(result).toContain("# test-server MCP Server")
			expect(result).toContain("### test-tool")
			expect(result).toContain("A test tool")
			expect(result).toContain("param1 (required)")
			expect(result).toContain("param2 (optional)")
			expect(result).toContain("<use_mcp_tool>")
			expect(result).toContain("<server>test-server</server>")
			expect(result).toContain("<tool>test-tool</tool>")
		})
	})

	describe("getCreateMcpServerInstructions", () => {
		it("should return instructions for creating an MCP server", async () => {
			const mockMcpHub = {
				getMcpServersPath: jest.fn().mockResolvedValue("/path/to/mcp/servers"),
				getMcpSettingsFilePath: jest.fn().mockResolvedValue("/path/to/mcp/settings.json"),
			}

			const result = await getCreateMcpServerInstructions({ mcpHub: mockMcpHub })

			expect(result).toContain("# Creating an MCP Server")
			expect(result).toContain("Implementation Steps")
			expect(result).toContain("Example Implementation")
			expect(result).toContain("Running Your Server")
			expect(result).toContain("Installing Your Server")
			expect(result).toContain("Best Practices")
			expect(result).toContain("OAuth and Authentication")
			expect(result).toContain("TypeScript Implementation")
			expect(result).toContain("/path/to/mcp/servers")
			expect(result).toContain("/path/to/mcp/settings.json")
		})

		it("should handle errors when getting MCP paths", async () => {
			const mockMcpHub = {
				getMcpServersPath: jest.fn().mockRejectedValue(new Error("Failed to get path")),
				getMcpSettingsFilePath: jest.fn().mockRejectedValue(new Error("Failed to get path")),
			}

			const result = await getCreateMcpServerInstructions({ mcpHub: mockMcpHub })

			expect(result).toContain("# Creating an MCP Server")
			// Should still return instructions even if paths are not available
			expect(result).not.toContain("/path/to/mcp/servers")
			expect(result).not.toContain("/path/to/mcp/settings.json")
		})
	})
})
