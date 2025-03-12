import { McpHub } from "../../mcp/McpHub"
import { McpServer, McpTool } from "../../../shared/mcp"

/**
 * Get the getServerByName method from McpHub
 */
declare module "../../mcp/McpHub" {
	interface McpHub {
		getServerByName?(name: string): McpServer | undefined
	}
}

export async function getMcpServerInstructions(serverName: string, context: any): Promise<string> {
	const { mcpHub } = context
	if (!mcpHub) {
		return "Error: MCP Hub not available"
	}

	// Find the server by name
	// First try getServerByName if it exists
	let server: McpServer | undefined
	if (typeof mcpHub.getServerByName === "function") {
		server = mcpHub.getServerByName(serverName)
	} else {
		// Fallback to searching in getServers
		server = mcpHub.getServers().find((s: McpServer) => s.name === serverName)
	}

	if (!server) {
		return `Error: MCP Server '${serverName}' not found`
	}

	// Generate detailed instructions for this specific MCP server
	return generateServerInstructions(server)
}

function generateServerInstructions(server: McpServer): string {
	const toolsDocumentation = (server.tools || [])
		.map((tool) => {
			// Handle inputSchema safely
			let parameterDocs = ""
			if (tool.inputSchema && typeof tool.inputSchema === "object") {
				const schema = tool.inputSchema as any
				if (schema.properties && typeof schema.properties === "object") {
					parameterDocs = Object.entries(schema.properties)
						.map(([name, propSchema]: [string, any]) => {
							const required = Array.isArray(schema.required) && schema.required.includes(name)
							return `- ${name}${required ? " (required)" : " (optional)"}: ${propSchema.description || "No description provided"}`
						})
						.join("\n")
				}
			}

			// Generate parameter examples for usage
			let paramExamples = ""
			if (tool.inputSchema && typeof tool.inputSchema === "object") {
				const schema = tool.inputSchema as any
				if (schema.properties && typeof schema.properties === "object") {
					paramExamples = Object.keys(schema.properties)
						.map((p) => `<${p}>${p === "code" ? "Your code here" : `Value for ${p}`}</${p}>`)
						.join("\n")
				}
			}

			return `### ${tool.name}
Description: ${tool.description || "No description provided"}
${parameterDocs ? `\nParameters:\n${parameterDocs}` : ""}

Usage:
<use_mcp_tool>
<server>${server.name}</server>
<tool>${tool.name}</tool>
${paramExamples || "<!-- No parameters required -->"}
</use_mcp_tool>`
		})
		.join("\n\n")

	const resourcesDocumentation = (server.resources || [])
		.map((resource) => {
			return `### ${resource.name}
Description: ${resource.description || "No description provided"}

Access with:
<access_mcp_resource>
<server>${server.name}</server>
<resource>${resource.uri}</resource>
</access_mcp_resource>`
		})
		.join("\n\n")

	const resourceTemplatesDocumentation = (server.resourceTemplates || [])
		.map((template) => {
			return `### ${template.name}
Description: ${template.description || "No description provided"}
URI Template: ${template.uriTemplate}

Access with:
<access_mcp_resource>
<server>${server.name}</server>
<resource>weather://YourCity/current</resource>
</access_mcp_resource>

Replace 'YourCity' with the actual city name.`
		})
		.join("\n\n")

	// Server description is not in the McpServer type, so we don't use it
	return `# ${server.name} MCP Server

## Available Tools

${toolsDocumentation || "No tools available."}

${resourcesDocumentation ? `\n## Available Resources\n\n${resourcesDocumentation}` : ""}

${resourceTemplatesDocumentation ? `\n## Resource Templates\n\n${resourceTemplatesDocumentation}` : ""}`
}

export async function getCreateMcpServerInstructions(context: any): Promise<string> {
	const { mcpHub } = context
	let mcpServersPath = ""
	let mcpSettingsFilePath = ""

	if (mcpHub) {
		try {
			mcpServersPath = await mcpHub.getMcpServersPath()
			mcpSettingsFilePath = await mcpHub.getMcpSettingsFilePath()
		} catch (error) {
			console.error("Failed to get MCP paths:", error)
		}
	}

	// Return the detailed instructions for creating an MCP server
	return `# Creating an MCP Server

To create a new MCP server that provides additional tools and resources, follow these steps:

1. Identify the purpose and functionality of the server
2. Determine what tools and resources it should provide
3. Implement the server using the MCP SDK

## Implementation Steps

1. Create a new directory for your MCP server project${mcpServersPath ? ` in ${mcpServersPath}` : ""}
2. Initialize a new Node.js project with \`npm init -y\`
3. Install the MCP SDK with \`npm install @modelcontextprotocol/sdk\`
4. Create an index.js file with your server implementation
5. Define your tools and resources
6. Start the server and connect it to the MCP hub

## Example Implementation

\`\`\`javascript
// index.js
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

// Create a new MCP server
const server = new Server({
  name: 'my-custom-server',
  description: 'A custom MCP server that provides useful tools',
});

// Add tools to the server
server.addTool({
  name: 'get_weather',
  description: 'Get the current weather for a location',
  parameters: [
    {
      name: 'location',
      description: 'The location to get weather for',
      required: true,
    },
  ],
  handler: async ({ location }) => {
    // Implementation to fetch weather data
    return { temperature: 72, conditions: 'sunny' };
  },
});

// Start the server
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.log('Server started successfully');
});
\`\`\`

## Running Your Server

1. Save your implementation to a file
2. Run it with \`node index.js\`
3. The server will automatically connect to the MCP hub
4. Once connected, you can use its tools via the \`use_mcp_tool\` command

## Installing Your Server

To make your MCP server available to the system, you need to add it to the MCP settings file${mcpSettingsFilePath ? ` at ${mcpSettingsFilePath}` : ""}:

\`\`\`json
{
  "mcpServers": {
    "your-server-name": {
      "command": "node",
      "args": ["/path/to/your/server/index.js"],
      "env": {
        "API_KEY": "your-api-key-if-needed"
      },
      "alwaysAllow": [],
      "disabled": false
    }
  }
}
\`\`\`

## Best Practices

- Keep tools focused on a single responsibility
- Provide clear documentation for each tool
- Handle errors gracefully
- Validate input parameters
- Return well-structured data

## OAuth and Authentication

When creating MCP servers that require OAuth or other authentication:

1. MCP servers operate in a non-interactive environment
2. They cannot initiate OAuth flows, open browser windows, or prompt for user input during runtime
3. All credentials and authentication tokens must be provided upfront through environment variables
4. For OAuth flows, create a separate one-time setup script that captures and logs the authentication tokens
5. Use these tokens in your MCP server configuration

## TypeScript Implementation

For TypeScript implementations, use the \`create-typescript-server\` tool:

\`\`\`bash
cd ${mcpServersPath || "/path/to/mcp/servers"}
npx @modelcontextprotocol/create-server my-server-name
cd my-server-name
npm install
\`\`\`

This creates a TypeScript project with the necessary structure and dependencies.
`
}
