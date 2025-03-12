import { ToolArgs } from "./types"

export function getBrowserActionDescription(args: ToolArgs): string | undefined {
	if (!args.supportsComputerUse) {
		return undefined
	}
	const simplifiedDescription = `## browser_action
Description: Execute browser actions like navigating to URLs, clicking elements, filling forms, and taking screenshots.
For detailed documentation and usage examples, use:

<get_instructions>
<section>browser_action</section>
</get_instructions>

Parameters:
- action: (required) The action to perform (navigate, click, fill, screenshot, etc.)
- Other parameters depend on the specific action

Usage:
<browser_action>
<action>Action name here</action>
<!-- Additional parameters based on the action -->
</browser_action>`

	return simplifiedDescription
}
