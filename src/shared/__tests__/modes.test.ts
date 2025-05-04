// Mock setup must come before imports
jest.mock("vscode")
const mockAddCustomInstructions = jest.fn().mockResolvedValue("Combined instructions")
jest.mock("../../core/prompts/sections/custom-instructions", () => ({
	addCustomInstructions: mockAddCustomInstructions,
}))

import { isToolAllowedForMode, FileRestrictionError, ModeConfig, getFullModeDetails, modes } from "../modes"
import { addCustomInstructions } from "../../core/prompts/sections/custom-instructions"

describe("isToolAllowedForMode", () => {
	const customModes: ModeConfig[] = [
		{
			slug: "markdown-editor",
			name: "Markdown Editor",
			roleDefinition: "You are a markdown editor",
			groups: ["read", ["edit", { fileRegex: "\\.md$" }], "browser"],
		},
		{
			slug: "css-editor",
			name: "CSS Editor",
			roleDefinition: "You are a CSS editor",
			groups: ["read", ["edit", { fileRegex: "\\.css$" }], "browser"],
		},
		{
			slug: "test-exp-mode",
			name: "Test Exp Mode",
			roleDefinition: "You are an experimental tester",
			groups: ["read", "edit", "browser"],
		},
	]

	it("allows always available tools", () => {
		// Only attempt_completion is always available now
		expect(isToolAllowedForMode("attempt_completion", "markdown-editor", customModes)).toBe(true)
		// ask_followup_question is now in the 'followup' group and needs to be explicitly added to a mode
		expect(isToolAllowedForMode("ask_followup_question", "markdown-editor", customModes)).toBe(false)
	})

	it("allows unrestricted tools", () => {
		expect(isToolAllowedForMode("read_file", "markdown-editor", customModes)).toBe(true)
		expect(isToolAllowedForMode("browser_action", "markdown-editor", customModes)).toBe(true)
	})

	describe("file restrictions", () => {
		it("allows editing matching files", () => {
			// Test markdown editor mode
			const mdResult = isToolAllowedForMode("write_to_file", "markdown-editor", customModes, undefined, {
				path: "test.md",
				content: "# Test",
			})
			expect(mdResult).toBe(true)

			// Test CSS editor mode
			const cssResult = isToolAllowedForMode("write_to_file", "css-editor", customModes, undefined, {
				path: "styles.css",
				content: ".test { color: red; }",
			})
			expect(cssResult).toBe(true)
		})

		it("rejects editing non-matching files", () => {
			// Test markdown editor mode with non-markdown file
			expect(() =>
				isToolAllowedForMode("write_to_file", "markdown-editor", customModes, undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(FileRestrictionError)
			expect(() =>
				isToolAllowedForMode("write_to_file", "markdown-editor", customModes, undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(/\\.md\$/)

			// Test CSS editor mode with non-CSS file
			expect(() =>
				isToolAllowedForMode("write_to_file", "css-editor", customModes, undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(FileRestrictionError)
			expect(() =>
				isToolAllowedForMode("write_to_file", "css-editor", customModes, undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(/\\.css\$/)
		})

		it("handles partial streaming cases (path only, no content/diff)", () => {
			// Should allow path-only for matching files (no validation yet since content/diff not provided)
			expect(
				isToolAllowedForMode("write_to_file", "markdown-editor", customModes, undefined, {
					path: "test.js",
				}),
			).toBe(true)

			expect(
				isToolAllowedForMode("apply_diff", "markdown-editor", customModes, undefined, {
					path: "test.js",
				}),
			).toBe(true)

			// Should allow path-only for architect mode too
			expect(
				isToolAllowedForMode("write_to_file", "architect", [], undefined, {
					path: "test.js",
				}),
			).toBe(true)
		})

		it("applies restrictions to both write_to_file and apply_diff", () => {
			// Test write_to_file
			const writeResult = isToolAllowedForMode("write_to_file", "markdown-editor", customModes, undefined, {
				path: "test.md",
				content: "# Test",
			})
			expect(writeResult).toBe(true)

			// Test apply_diff
			const diffResult = isToolAllowedForMode("apply_diff", "markdown-editor", customModes, undefined, {
				path: "test.md",
				diff: "- old\n+ new",
			})
			expect(diffResult).toBe(true)

			// Test both with non-matching file
			expect(() =>
				isToolAllowedForMode("write_to_file", "markdown-editor", customModes, undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(FileRestrictionError)

			expect(() =>
				isToolAllowedForMode("apply_diff", "markdown-editor", customModes, undefined, {
					path: "test.js",
					diff: "- old\n+ new",
				}),
			).toThrow(FileRestrictionError)
		})

		it("uses description in file restriction error for custom modes", () => {
			const customModesWithDescription: ModeConfig[] = [
				{
					slug: "docs-editor",
					name: "Documentation Editor",
					roleDefinition: "You are a documentation editor",
					groups: [
						"read",
						["edit", { fileRegex: "\\.(md|txt)$", description: "Documentation files only" }],
						"browser",
					],
				},
			]

			// Test write_to_file with non-matching file
			expect(() =>
				isToolAllowedForMode("write_to_file", "docs-editor", customModesWithDescription, undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(FileRestrictionError)
			expect(() =>
				isToolAllowedForMode("write_to_file", "docs-editor", customModesWithDescription, undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(/Documentation files only/)

			// Test apply_diff with non-matching file
			expect(() =>
				isToolAllowedForMode("apply_diff", "docs-editor", customModesWithDescription, undefined, {
					path: "test.js",
					diff: "- old\n+ new",
				}),
			).toThrow(FileRestrictionError)
			expect(() =>
				isToolAllowedForMode("apply_diff", "docs-editor", customModesWithDescription, undefined, {
					path: "test.js",
					diff: "- old\n+ new",
				}),
			).toThrow(/Documentation files only/)

			// Test that matching files are allowed
			expect(
				isToolAllowedForMode("write_to_file", "docs-editor", customModesWithDescription, undefined, {
					path: "test.md",
					content: "# Test",
				}),
			).toBe(true)

			expect(
				isToolAllowedForMode("write_to_file", "docs-editor", customModesWithDescription, undefined, {
					path: "test.txt",
					content: "Test content",
				}),
			).toBe(true)

			// Test partial streaming cases
			expect(
				isToolAllowedForMode("write_to_file", "docs-editor", customModesWithDescription, undefined, {
					path: "test.js",
				}),
			).toBe(true)
		})

		it("allows architect mode to edit markdown files only", () => {
			// Should allow editing markdown files
			expect(
				isToolAllowedForMode("write_to_file", "architect", [], undefined, {
					path: "test.md",
					content: "# Test",
				}),
			).toBe(true)

			// Should allow applying diffs to markdown files
			expect(
				isToolAllowedForMode("apply_diff", "architect", [], undefined, {
					path: "readme.md",
					diff: "- old\n+ new",
				}),
			).toBe(true)

			// Should reject non-markdown files
			expect(() =>
				isToolAllowedForMode("write_to_file", "architect", [], undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(FileRestrictionError)
			expect(() =>
				isToolAllowedForMode("write_to_file", "architect", [], undefined, {
					path: "test.js",
					content: "console.log('test')",
				}),
			).toThrow(/Markdown files only/)

			// Should maintain read capabilities
			expect(isToolAllowedForMode("read_file", "architect", [])).toBe(true)
			expect(isToolAllowedForMode("browser_action", "architect", [])).toBe(true)
			expect(isToolAllowedForMode("use_mcp_tool", "architect", [])).toBe(true)
		})
	})
	describe("slugRegex restrictions", () => {
		const modesWithSlugRegex: ModeConfig[] = [
			{
				slug: "subtask-runner",
				name: "Subtask Runner",
				roleDefinition: "Runs subtasks",
				groups: [["subtask", { slugRegex: "^subtask-target-.*" }]],
			},
			{
				slug: "mode-switcher",
				name: "Mode Switcher",
				roleDefinition: "Switches modes",
				groups: [["switch", { slugRegex: "^switch-target-.*" }]],
			},
			{
				slug: "subtask-no-regex",
				name: "Subtask No Regex",
				roleDefinition: "Runs any subtask",
				groups: ["subtask"], // No slugRegex defined
			},
			{
				slug: "switch-no-regex",
				name: "Switch No Regex",
				roleDefinition: "Switches to any mode",
				groups: ["switch"], // No slugRegex defined
			},
		]

		// --- subtask tool tests ---
		it("subtask: allows when slugRegex matches toolParams.mode", () => {
			expect(
				isToolAllowedForMode("new_task", "subtask-runner", modesWithSlugRegex, undefined, {
					mode: "subtask-target-allowed",
					message: "test",
				}),
			).toBe(true) // Should FAIL until implemented
		})

		it("subtask: rejects when slugRegex does not match toolParams.mode", () => {
			expect(
				isToolAllowedForMode("new_task", "subtask-runner", modesWithSlugRegex, undefined, {
					mode: "other-mode",
					message: "test",
				}),
			).toBe(false) // Should PASS (as false is default), but confirms logic path
		})

		it("subtask: allows when slugRegex matches toolParams.mode_slug (legacy)", () => {
			// Test legacy parameter name if needed
			expect(
				isToolAllowedForMode("new_task", "subtask-runner", modesWithSlugRegex, undefined, {
					mode_slug: "subtask-target-allowed",
					message: "test",
				}),
			).toBe(true) // Should FAIL until implemented
		})

		it("subtask: rejects when slugRegex does not match toolParams.mode_slug (legacy)", () => {
			expect(
				isToolAllowedForMode("new_task", "subtask-runner", modesWithSlugRegex, undefined, {
					mode_slug: "other-mode",
					message: "test",
				}),
			).toBe(false) // Should PASS (as false is default), but confirms logic path
		})

		it("subtask: allows when group exists but no slugRegex is defined", () => {
			expect(
				isToolAllowedForMode("new_task", "subtask-no-regex", modesWithSlugRegex, undefined, {
					mode: "any-mode",
					message: "test",
				}),
			).toBe(true) // Should PASS (current behavior)
		})

		it("subtask: allows when slugRegex exists but toolParams are missing", () => {
			// If toolParams are missing, the regex check shouldn't run/fail
			expect(isToolAllowedForMode("new_task", "subtask-runner", modesWithSlugRegex)).toBe(true) // Should PASS (current behavior)
		})

		// --- switch_mode tool tests ---
		it("switch: allows when slugRegex matches toolParams.mode_slug", () => {
			expect(
				isToolAllowedForMode("switch_mode", "mode-switcher", modesWithSlugRegex, undefined, {
					mode_slug: "switch-target-allowed",
				}),
			).toBe(true) // Should FAIL until implemented
		})

		it("switch: rejects when slugRegex does not match toolParams.mode_slug", () => {
			expect(
				isToolAllowedForMode("switch_mode", "mode-switcher", modesWithSlugRegex, undefined, {
					mode_slug: "other-mode",
				}),
			).toBe(false) // Should PASS (as false is default), but confirms logic path
		})

		// Note: switch_mode only uses mode_slug, no need to test 'mode' param

		it("switch: allows when group exists but no slugRegex is defined", () => {
			expect(
				isToolAllowedForMode("switch_mode", "switch-no-regex", modesWithSlugRegex, undefined, {
					mode_slug: "any-mode",
				}),
			).toBe(true) // Should PASS (current behavior)
		})

		it("switch: allows when slugRegex exists but toolParams are missing", () => {
			// If toolParams are missing, the regex check shouldn't run/fail
			expect(isToolAllowedForMode("switch_mode", "mode-switcher", modesWithSlugRegex)).toBe(true) // Should PASS (current behavior)
		})
	})

	it("handles non-existent modes", () => {
		expect(isToolAllowedForMode("write_to_file", "non-existent", customModes)).toBe(false)
	})

	it("respects tool requirements", () => {
		const toolRequirements = {
			write_to_file: false,
		}

		expect(isToolAllowedForMode("write_to_file", "markdown-editor", customModes, toolRequirements)).toBe(false)
	})
})

// New tests for default built-in mode permissions
describe("default permissions for built-in modes", () => {
	const builtInModes: ModeConfig[] = [] // Use empty array as customModes to test against built-in definitions
	const modesToTest = ["architect", "ask", "debug", "orchestrator"]
	const toolsToCheck = ["new_task", "switch_mode", "ask_followup_question"]

	modesToTest.forEach((modeSlug) => {
		describe(`mode: ${modeSlug}`, () => {
			toolsToCheck.forEach((toolName) => {
				/**
				 * @test {isToolAllowedForMode} Verifies default tool permissions for built-in modes.
				 * These tests are expected to FAIL until the corresponding groups ('subtask', 'switch', 'followup')
				 * are added to the built-in mode definitions in src/shared/modes.ts.
				 */
				it(`should allow tool: ${toolName}`, () => {
					// We expect this to be true eventually, but it should fail initially
					expect(isToolAllowedForMode(toolName as any, modeSlug, builtInModes)).toBe(true)
				})
			})
		})
	})
})
// End of new tests
describe('when tool group is "subtask"', () => {
	const toolName = "new_task"
	const requiredGroup = "subtask"

	it('should return true if mode has the "subtask" group', () => {
		const mode: ModeConfig = {
			slug: "test-mode",
			name: "Test Mode",
			roleDefinition: "A test mode", // roleDefinition is required by ModeConfig
			groups: [requiredGroup], // Use groups array
		}
		expect(isToolAllowedForMode(toolName, mode.slug, [mode])).toBe(true)
	})

	it('should return false if mode does not have the "subtask" group', () => {
		const mode: ModeConfig = {
			slug: "test-mode",
			name: "Test Mode",
			roleDefinition: "A test mode",
			groups: [], // Do not include the required group
		}
		expect(isToolAllowedForMode(toolName, mode.slug, [mode])).toBe(false)
	})
})

describe('when tool group is "switch"', () => {
	const toolName = "switch_mode"
	const requiredGroup = "switch"

	it('should return true if mode has the "switch" group', () => {
		const mode: ModeConfig = {
			slug: "test-mode",
			name: "Test Mode",
			roleDefinition: "A test mode",
			groups: [requiredGroup],
		}
		expect(isToolAllowedForMode(toolName, mode.slug, [mode])).toBe(true)
	})

	it('should return false if mode does not have the "switch" group', () => {
		const mode: ModeConfig = {
			slug: "test-mode",
			name: "Test Mode",
			roleDefinition: "A test mode",
			groups: [],
		}
		expect(isToolAllowedForMode(toolName, mode.slug, [mode])).toBe(false)
	})
})

describe('when tool group is "followup"', () => {
	const toolName = "ask_followup_question"
	const requiredGroup = "followup"

	it('should return true if mode has the "followup" group', () => {
		const mode: ModeConfig = {
			slug: "test-mode",
			name: "Test Mode",
			roleDefinition: "A test mode",
			groups: [requiredGroup],
		}
		expect(isToolAllowedForMode(toolName, mode.slug, [mode])).toBe(true)
	})

	it('should return false if mode does not have the "followup" group', () => {
		const mode: ModeConfig = {
			slug: "test-mode",
			name: "Test Mode",
			roleDefinition: "A test mode",
			groups: [],
		}
		expect(isToolAllowedForMode(toolName, mode.slug, [mode])).toBe(false)
	})
})

describe("FileRestrictionError", () => {
	it("formats error message with pattern when no description provided", () => {
		const error = new FileRestrictionError("Markdown Editor", "\\.md$", undefined, "test.js")
		expect(error.message).toBe(
			"This mode (Markdown Editor) can only edit files matching pattern: \\.md$. Got: test.js",
		)
		expect(error.name).toBe("FileRestrictionError")
	})

	describe("debug mode", () => {
		it("is configured correctly", () => {
			const debugMode = modes.find((mode) => mode.slug === "debug")
			expect(debugMode).toBeDefined()
			expect(debugMode).toMatchObject({
				slug: "debug",
				name: "🪲 Debug",
				roleDefinition:
					"You are Roo, an expert software debugger specializing in systematic problem diagnosis and resolution.",
				groups: ["read", "edit", "browser", "command", "mcp", "subtask", "switch", "followup"],
			})
			expect(debugMode?.customInstructions).toContain(
				"Reflect on 5-7 different possible sources of the problem, distill those down to 1-2 most likely sources, and then add logs to validate your assumptions. Explicitly ask the user to confirm the diagnosis before fixing the problem.",
			)
		})
	})

	describe("getFullModeDetails", () => {
		beforeEach(() => {
			jest.clearAllMocks()
			;(addCustomInstructions as jest.Mock).mockResolvedValue("Combined instructions")
		})

		it("returns base mode when no overrides exist", async () => {
			const result = await getFullModeDetails("debug")
			expect(result).toMatchObject({
				slug: "debug",
				name: "🪲 Debug",
				roleDefinition:
					"You are Roo, an expert software debugger specializing in systematic problem diagnosis and resolution.",
			})
		})

		it("applies custom mode overrides", async () => {
			const customModes: ModeConfig[] = [
				{
					slug: "debug",
					name: "Custom Debug",
					roleDefinition: "Custom debug role",
					groups: ["read"],
				},
			]

			const result = await getFullModeDetails("debug", customModes)
			expect(result).toMatchObject({
				slug: "debug",
				name: "Custom Debug",
				roleDefinition: "Custom debug role",
				groups: ["read"],
			})
		})

		it("applies prompt component overrides", async () => {
			const customModePrompts = {
				debug: {
					roleDefinition: "Overridden role",
					customInstructions: "Overridden instructions",
				},
			}

			const result = await getFullModeDetails("debug", undefined, customModePrompts)
			expect(result.roleDefinition).toBe("Overridden role")
			expect(result.customInstructions).toBe("Overridden instructions")
		})

		it("combines custom instructions when cwd provided", async () => {
			const options = {
				cwd: "/test/path",
				globalCustomInstructions: "Global instructions",
				language: "en",
			}

			await getFullModeDetails("debug", undefined, undefined, options)

			expect(addCustomInstructions).toHaveBeenCalledWith(
				expect.any(String),
				"Global instructions",
				"/test/path",
				"debug",
				{ language: "en" },
			)
		})

		it("falls back to first mode for non-existent mode", async () => {
			const result = await getFullModeDetails("non-existent")
			expect(result).toMatchObject({
				...modes[0],
				customInstructions: "",
			})
		})
	})

	it("formats error message with description when provided", () => {
		const error = new FileRestrictionError("Markdown Editor", "\\.md$", "Markdown files only", "test.js")
		expect(error.message).toBe(
			"This mode (Markdown Editor) can only edit files matching pattern: \\.md$ (Markdown files only). Got: test.js",
		)
		expect(error.name).toBe("FileRestrictionError")
	})
})
