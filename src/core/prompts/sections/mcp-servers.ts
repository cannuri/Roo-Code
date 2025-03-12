import { DiffStrategy } from "../../diff/DiffStrategy"
import { McpHub } from "../../../services/mcp/McpHub"

export async function getMcpServersSection(
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	enableMcpServerCreation?: boolean,
): Promise<string> {
	if (!mcpHub) {
		return ""
	}

	const connectedServers =
		mcpHub.getServers().length > 0
			? mcpHub
					.getServers()
					.filter((server) => server.status === "connected")
					.map((server) => {
						// Create a simplified listing of capabilities
						const capabilitiesList = (server.tools || [])
							.map((tool) => `- ${tool.description?.split(/\.|:/).shift()}`)
							.join("\n")

						return `## ${server.name}\n\n### Capabilities:\n${capabilitiesList}`
					})
					.join("\n\n")
			: "(No MCP servers currently connected)"

	const baseSection = `MCP SERVERS

The Model Context Protocol (MCP) enables communication between the system and locally running MCP servers that provide additional tools and resources to extend your capabilities.

# Connected MCP Servers

When a server is connected, you MUST first retrieve the full documentation for the server's tools using the \`get_instructions\` tool BEFORE attempting to use any MCP tool. Once you have the full documentation, you can use the server's tools via the \`use_mcp_tool\` tool, and access the server's resources via the \`access_mcp_resource\` tool.

IMPORTANT: To get the full documentation for an MCP server, use the following EXACT format:

<get_instructions>
<section>mcp_server_[name]</section>
</get_instructions>

Replace [name] with the actual name of the MCP Server (e.g., "puppeteer", "brave-search").

Example for brave-search:
<get_instructions>
<section>mcp_server_brave-search</section>
</get_instructions>

Example for puppeteer:
<get_instructions>
<section>mcp_server_puppeteer</section>
</get_instructions>

${connectedServers}

## IMPORTANT: DO NOT attempt to use any MCP tool without first retrieving its complete documentation using the EXACT format shown above.`

	if (!enableMcpServerCreation) {
		return baseSection
	}

	return (
		baseSection +
		`

## Creating an MCP Server

The user may ask you to "add a tool" that performs some function. This requires creating an MCP server that provides tools and resources that may connect to external APIs. To get the complete instructions on creating an MCP server, use the following EXACT format:

<get_instructions>
<section>create_mcp_server</section>
</get_instructions>

After retrieving these instructions, follow them precisely to fulfill the user's request.`
	)
}
