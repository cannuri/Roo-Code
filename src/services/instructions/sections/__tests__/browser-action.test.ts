import { getBrowserActionInstructions } from "../browser-action"

describe("Browser Action Instructions", () => {
	it("should provide comprehensive browser action documentation", async () => {
		const context = {}
		const instructions = await getBrowserActionInstructions(context)

		// Verify all critical sections are present
		expect(instructions).toContain("Browser Action Tool")
		expect(instructions).toContain("Available Actions")
		expect(instructions).toContain("navigate")
		expect(instructions).toContain("click")
		expect(instructions).toContain("fill")
		expect(instructions).toContain("screenshot")
		expect(instructions).toContain("waitFor")
		expect(instructions).toContain("evaluate")
		expect(instructions).toContain("Best Practices")
		expect(instructions).toContain("Example Workflows")
	})

	it("should include all required parameters in usage examples", async () => {
		const context = {}
		const instructions = await getBrowserActionInstructions(context)

		// Verify that parameter documentation includes required/optional notation
		expect(instructions).toMatch(/url:.*?\(required\)/)
		expect(instructions).toMatch(/selector:.*?\(required\)/)
		expect(instructions).toMatch(/selector:.*?\(optional\)/)

		// Check for complete usage examples
		expect(instructions).toContain("<browser_action>")
		expect(instructions).toContain("</browser_action>")
	})
})
