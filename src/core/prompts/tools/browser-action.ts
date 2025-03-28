import { ToolArgs } from "./types"

export function getBrowserActionDescription(args: ToolArgs): string | undefined {
	if (!args.supportsComputerUse) {
		return undefined
	}

	const persistenceRules = args.browserPersistSession
		? `- **Browser Persistence is ON:** The browser session **MUST remain open** between tool calls unless explicitly closed by the user or the entire task involving the browser is complete.
	   - The sequence **must always start with** launching the browser.
	   - **CRITICAL: DO NOT use the 'close' action simply because you are waiting for instructions or encountered an error (especially a "no tool used" error).** If the user asked you to perform an action and then "wait", or if you are unsure how to proceed, or recovering from an error while the browser is open, the **ONLY** correct action is to use the 'ask_followup_question' tool to confirm readiness or clarify the next step. Closing the browser in this situation is incorrect when persistence is ON.
	   - Use the 'close' action *only* when explicitly instructed to do so by the user, OR when the entire multi-step browser interaction task is fully complete and the browser is definitively no longer needed.
	   - You *can* use other tools while the browser is open if needed (e.g., read a file to get data before typing it), but return to browser actions promptly.
	   - **Task Completion:** Completing a single browser action (like 'upload', 'click', etc.) does **not** automatically mean the user's overall task is complete. After successfully performing an action, **always** use the 'ask_followup_question' tool to confirm the next step or ask if there's anything else needed, unless the user explicitly stated the action was the final step.
	   - **Completion:** Do not use the \`attempt_completion\` tool simply because you have asked a follow-up question or completed a single browser step. The browser session is intended to be ongoing. Only use \`attempt_completion\` after the user explicitly confirms the *entire* multi-step browser-related task is finished, or after you have been instructed to \`close\` the browser and have done so.
	   - If you need to visit a completely unrelated URL, it's still best practice to 'close' the current session and 'launch' a new one.`
		: `- The sequence of actions **must always start with** launching the browser at a URL, and **must always end with** closing the browser. If you need to visit a new URL that is not possible to navigate to from the current webpage, you must first close the browser, then launch again at the new URL.
- While the browser is active, only the 'browser_action' tool can be used. No other tools should be called during this time. You may proceed to use other tools only after closing the browser. For example if you run into an error and need to fix a file, you must close the browser, then use other tools to make the necessary changes, then re-launch the browser to verify the result.`

	// Construct the full description using string concatenation
	let description = "## browser_action\n"
	description +=
		"Description: Request to interact with a Puppeteer-controlled browser. Every action, except 'close', will be responded to with a screenshot of the browser's current state, along with any new console logs. You may only perform one browser action per message, and wait for the user's response including a screenshot and logs to determine the next action.\n"
	description += persistenceRules + "\n"
	description +=
		"- **IMPORTANT: NEVER click on buttons that would open a system file dialog.** Instead, use the 'upload' action directly with the file input element's selector and the desired file path.\n"
	description +=
		"- The browser window has a resolution of **" +
		args.browserViewportSize +
		"** pixels. When performing any click actions, ensure the coordinates are within this resolution range.\n"
	description +=
		"- Before clicking on any elements such as icons, links, or buttons, you must consult the provided screenshot of the page to determine the coordinates of the element. The click should be targeted at the **center of the element**, not on its edges.\n"
	description += "Parameters:\n"
	description += "- action: (required) The action to perform. The available actions are:\n"
	description +=
		"	   * launch: Launch a new Puppeteer-controlled browser instance at the specified URL. This **must always be the first action**.\n"
	description += "	       - Use with the 'url' parameter to provide the URL.\n"
	description +=
		"	       - Ensure the URL is valid and includes the appropriate protocol (e.g. http://localhost:3000/page, file:///path/to/file.html, etc.)\n"
	description += "	   * click: Click at a specific x,y coordinate.\n"
	description += "	       - Use with the 'coordinate' parameter to specify the location.\n"
	description +=
		"	       - Always click in the center of an element (icon, button, link, etc.) based on coordinates derived from a screenshot.\n"
	description +=
		'	       - **DO NOT click on buttons labeled "Upload", "Choose File", "Browse", or similar that would open system file dialogs.** Use the \'upload\' action instead.\n' // Escaped quotes
	description +=
		"	   * type: Type a string of text on the keyboard. You might use this after clicking on a text field to input text.\n"
	description += "	       - Use with the 'text' parameter to provide the string to type.\n"
	description += "	   * scroll_down: Scroll down the page by one page height.\n"
	description += "	   * scroll_up: Scroll up the page by one page height.\n"
	description +=
		"	   * upload: **UPLOAD FILES DIRECTLY WITH THIS ACTION - DO NOT CLICK ON UPLOAD BUTTONS.** This action uploads a file to a file input element on the page by directly setting its value, bypassing any system file dialogs.\n"
	description +=
		"	       - Use with the 'selector' parameter to specify the CSS selector for the file input element (typically 'input[type=\"file\"]').\n" // Escaped quotes
	description += "	       - Use with the 'filepath' parameter to specify the path to the file to upload.\n"
	description +=
		"	       - **IMPORTANT:** Always use this action instead of clicking on buttons that would open system file dialogs.\n"
	description +=
		"	   * close: Close the Puppeteer-controlled browser instance. " +
		(args.browserPersistSession
			? "(Use only when explicitly instructed or task is fully complete)"
			: "This **must always be the final browser action**.") +
		"\n"
	description += "	       - Example: '<action>close</action>'\n"
	description += "- url: (optional) Use this for providing the URL for the 'launch' action.\n"
	description += "	   * Example: <url>https://example.com</url>\n"
	description +=
		"- coordinate: (optional) The X and Y coordinates for the 'click' action. Coordinates should be within the **" +
		args.browserViewportSize +
		"** resolution.\n"
	description += "	   * Example: <coordinate>450,300</coordinate>\n"
	description += "- text: (optional) Use this for providing the text for the 'type' action.\n"
	description += "	   * Example: <text>Hello, world!</text>\n"
	description += "- selector: (optional) The CSS selector for the file input element for the 'upload' action.\n"
	description += '	   * Example: <selector>input[type="file"]</selector>\n' // Escaped quotes
	description += "- filepath: (optional) The **absolute** path to the file to upload for the 'upload' action.\n"
	description += "	   * Example: <filepath>/Users/username/path/to/file.jpg</filepath>\n"
	description += "Usage:\n"
	description += "<browser_action>\n"
	description +=
		"<action>Action to perform (e.g., launch, click, type, scroll_down, scroll_up, upload, close)</action>\n"
	description += "<url>URL to launch the browser at (optional)</url>\n"
	description += "<coordinate>x,y coordinates (optional)</coordinate>\n"
	description += "<text>Text to type (optional)</text>\n"
	description += "<selector>CSS selector for file input (optional)</selector>\n"
	description += "<filepath>Path to file to upload (optional)</filepath>\n"
	description += "</browser_action>\n\n"
	description += "Example: Requesting to launch a browser at https://example.com\n"
	description += "<browser_action>\n"
	description += "<action>launch</action>\n"
	description += "<url>https://example.com</url>\n"
	description += "</browser_action>\n\n"
	description += "Example: Requesting to click on the element at coordinates 450,300\n"
	description += "<browser_action>\n"
	description += "<action>click</action>\n"
	description += "<coordinate>450,300</coordinate>\n"
	description += "</browser_action>\n\n"
	description += "Example: Requesting to upload a file to a file input element\n"
	description += "<browser_action>\n"
	description += "<action>upload</action>\n"
	description += '<selector>input[type="file"]</selector>\n' // Escaped quotes
	description += "<filepath>/path/to/file.jpg</filepath>\n"
	description += "</browser_action>"

	return description
}
