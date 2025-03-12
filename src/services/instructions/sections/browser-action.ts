/**
 * Browser Action Instructions
 *
 * This file contains the implementation for the browser_action tool documentation.
 */

/**
 * Get detailed instructions for the browser_action tool
 * @param context The context object
 * @returns Detailed documentation for the browser_action tool
 */
export async function getBrowserActionInstructions(context: any): Promise<string> {
	return `# Browser Action Tool

The \`browser_action\` tool allows you to perform a variety of web browser operations, including navigating to URLs, clicking elements, filling forms, and taking screenshots.

## Available Actions

### navigate
Navigate to a URL in the browser.

Parameters:
- url: (required) The URL to navigate to

Usage:
<browser_action>
<action>navigate</action>
<url>https://example.com</url>
</browser_action>

### click
Click on an element in the page.

Parameters:
- selector: (required) CSS selector or XPath for the element to click

Usage:
<browser_action>
<action>click</action>
<selector>button.submit</selector>
</browser_action>

### fill
Fill a form field with text.

Parameters:
- selector: (required) CSS selector or XPath for the input field
- text: (required) The text to fill in the field

Usage:
<browser_action>
<action>fill</action>
<selector>input[name="search"]</selector>
<text>search term</text>
</browser_action>

### screenshot
Take a screenshot of the current page or a specific element.

Parameters:
- selector: (optional) CSS selector or XPath for a specific element to screenshot. If omitted, captures the whole page.
- filename: (optional) Name to give the screenshot file. If omitted, a timestamp will be used.

Usage:
<browser_action>
<action>screenshot</action>
<selector>.main-content</selector>
<filename>content-screenshot</filename>
</browser_action>

### waitFor
Wait for an element to appear on the page.

Parameters:
- selector: (required) CSS selector or XPath to wait for
- timeout: (optional) Timeout in milliseconds (default: 30000)

Usage:
<browser_action>
<action>waitFor</action>
<selector>.search-results</selector>
<timeout>5000</timeout>
</browser_action>

### evaluate
Execute custom JavaScript in the browser context.

Parameters:
- script: (required) JavaScript code to execute in the browser

Usage:
<browser_action>
<action>evaluate</action>
<script>
return document.title;
</script>
</browser_action>

## Best Practices

1. Always check if a page has loaded completely before interacting with it
2. Use precise selectors to target elements
3. When possible, wait for specific elements instead of using timeouts
4. Handle navigation and page transitions properly

## Example Workflows

### Login to a website
<browser_action>
<action>navigate</action>
<url>https://example.com/login</url>
</browser_action>

<browser_action>
<action>waitFor</action>
<selector>form[action="/login"]</selector>
</browser_action>

<browser_action>
<action>fill</action>
<selector>input[name="username"]</selector>
<text>myusername</text>
</browser_action>

<browser_action>
<action>fill</action>
<selector>input[name="password"]</selector>
<text>mypassword</text>
</browser_action>

<browser_action>
<action>click</action>
<selector>button[type="submit"]</selector>
</browser_action>

### Search and screenshot results
<browser_action>
<action>navigate</action>
<url>https://example.com</url>
</browser_action>

<browser_action>
<action>fill</action>
<selector>input[name="q"]</selector>
<text>search term</text>
</browser_action>

<browser_action>
<action>click</action>
<selector>button[type="submit"]</selector>
</browser_action>

<browser_action>
<action>waitFor</action>
<selector>.search-results</selector>
</browser_action>

<browser_action>
<action>screenshot</action>
<selector>.search-results</selector>
<filename>search-results</filename>
</browser_action>
`
}
