const { getMcpServersSection } = require("./src/core/prompts/sections/mcp-servers")

// Mock MCP Hub with a test server
const mockMcpHub = {
	getServers: () => [
		{
			name: "puppeteer",
			status: "connected",
			tools: [
				{ name: "puppeteer_navigate", description: "Navigate to a URL" },
				{
					name: "puppeteer_screenshot",
					description: "Take a screenshot of the current page or a specific element",
				},
				{ name: "puppeteer_click", description: "Click an element on the page" },
				{ name: "puppeteer_fill", description: "Fill out an input field" },
				{ name: "puppeteer_select", description: "Select an element on the page with Select tag" },
				{ name: "puppeteer_hover", description: "Hover an element on the page" },
				{ name: "puppeteer_evaluate", description: "Execute JavaScript in the browser console" },
			],
		},
	],
}

// Test the MCP servers section
async function testMcpServersSection() {
	const section = await getMcpServersSection(mockMcpHub)
	console.log(section)
}

testMcpServersSection().catch(console.error)
