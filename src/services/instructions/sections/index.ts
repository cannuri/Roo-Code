import { InstructionSection } from "../InstructionsRegistry"
import { getMcpServerInstructions, getCreateMcpServerInstructions } from "./mcp-servers"
import { getBrowserActionInstructions } from "./browser-action"

export { getMcpServerInstructions, getCreateMcpServerInstructions, getBrowserActionInstructions }

/**
 * Standard instruction sections that are available by default
 */
export const standardSections: InstructionSection[] = [
	{
		id: "browser_action",
		title: "Browser Action Tool",
		description: "Detailed documentation for the browser_action tool",
		getContent: getBrowserActionInstructions,
	},
	{
		id: "create_mcp_server",
		title: "Creating MCP Servers",
		description: "Complete instructions for creating MCP servers",
		getContent: getCreateMcpServerInstructions,
	},
]

/**
 * Generate a section ID for an MCP server
 * @param serverName The name of the MCP server
 * @returns The section ID for the server
 */
export function getMcpServerSectionId(serverName: string): string {
	return `mcp_server_${serverName}`
}

/**
 * Register MCP server sections for all connected servers
 * @param registry The instruction registry
 * @param mcpHub The MCP hub
 */
export function registerMcpServerSections(registry: any, mcpHub: any): void {
	// Register standard sections first
	for (const section of standardSections) {
		try {
			registry.registerSection(section)
		} catch (error) {
			// Section might already be registered
			console.debug(`Failed to register section ${section.id}:`, error)
		}
	}

	// Register a section for each connected server
	if (mcpHub) {
		const servers = mcpHub.getServers()
		for (const server of servers) {
			try {
				const sectionId = getMcpServerSectionId(server.name)
				registry.registerSection({
					id: sectionId,
					title: `${server.name} MCP Server Documentation`,
					description: `Detailed documentation for the ${server.name} MCP server`,
					getContent: (context: any) => getMcpServerInstructions(server.name, context),
				})
			} catch (error) {
				// Section might already be registered
				console.debug(`Failed to register section for server ${server.name}:`, error)
			}
		}
	}
}
