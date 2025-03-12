import { ToolArgs } from "./types"

export function getGetInstructionsDescription(args: ToolArgs): string {
	return `## get_instructions
Description: Retrieves detailed instructions for specific components or features. Use this tool to get comprehensive documentation that is not included in the base system prompt.
Parameters:
- section: (required) The ID of the section to retrieve. Must be provided as a non-empty string.

Usage:
<get_instructions>
<section>section_id_here</section>
</get_instructions>

Available sections include:
- mcp_server_[name]: Documentation for a specific MCP server (replace [name] with the server name, e.g., "mcp_server_puppeteer")
- create_mcp_server: Instructions for creating a new MCP server
- modes: Information about available modes
- extended_capabilities: Additional system capabilities

Example:
<get_instructions>
<section>mcp_server_brave-search</section>
</get_instructions>

IMPORTANT: Always use the EXACT format shown above, with properly closed XML tags and the section ID as a non-empty string.`
}
