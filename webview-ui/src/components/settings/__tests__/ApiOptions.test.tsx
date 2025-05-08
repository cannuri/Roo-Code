import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import type { ProviderSettings, ModelInfo } from "@roo-code/types"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"

import ApiOptions, { ApiOptionsProps } from "../ApiOptions"
import { useSelectedModel } from "@src/components/ui/hooks/useSelectedModel" // Import the hook to be mocked

// Mock useSelectedModel at the top level
// Mock MODELS_BY_PROVIDER to ensure selectedProviderModels is not empty
jest.mock("../constants", () => ({
	...jest.requireActual("../constants"),
	MODELS_BY_PROVIDER: {
		"mock-provider": {
			"default-mock-model": {},
			"thinking-model-with-max-tokens": {},
			"thinking-model": {},
			"non-thinking-model": {},
			"non-thinking-model-with-max-tokens": {},
			"model-without-max-tokens": {},
		},
		gemini: {
			"gemini-2.5-pro-exp-03-25": {},
		},
		PROVIDERS: jest.requireActual("../constants").PROVIDERS,
	},
}))

// Mock i18n
jest.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Define mock hook implementation before mocking it
const mockUseRouterModels = {
	data: {
		openrouter: [],
		requesty: [],
		glama: [],
		unbound: [],
		litellm: [
			{ id: "litellm-model-1", context_length: 32000 },
			{ id: "litellm-model-2", context_length: 128000 },
		],
	},
	error: null,
	isLoading: false,
	refetch: jest.fn(),
}

// Mock the hooks
jest.mock("@src/components/ui/hooks/useRouterModels", () => ({
	useRouterModels: () => mockUseRouterModels,
}))

// Mock vscode object
global.vscode = {
	postMessage: jest.fn(),
} as any

// Mock vscode module
jest.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

// Mock VSCodeLink component as anchor
jest.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: ({ children, onClick }: any) => (
		<button onClick={onClick} className="vscode-button">
			{children}
		</button>
	),
	VSCodeLink: ({ children, href }: any) => (
		<a href={href} className="vscode-link">
			{children}
		</a>
	),
}))

// Mock @shadcn/ui components
jest.mock("@/components/ui", () => ({
	Select: ({ children, value, onValueChange }: any) => (
		<select value={value} onChange={(e) => onValueChange && onValueChange(e.target.value)}>
			{children}
		</select>
	),
	SelectTrigger: ({ children }: any) => <>{children}</>, // Render children directly
	SelectValue: ({ children }: any) => <>{children}</>, // Render children directly
	SelectContent: ({ children }: any) => <>{children}</>, // Render children directly
	SelectItem: ({ children, value }: any) => (
		<option value={value}>{children}</option> // Use native option
	),
	SelectSeparator: () => null, // Render nothing for separator
	Button: ({ children, onClick, _variant, role, className }: any) => (
		<button onClick={onClick} className={`button-mock ${className || ""}`} role={role}>
			{children}
		</button>
	),
	// Add missing components used by ModelPicker
	Command: ({ children }: any) => <div>{children}</div>, // Simple div mock
	CommandEmpty: ({ children }: any) => <div>{children}</div>, // Simple div mock
	CommandGroup: ({ children }: any) => <div>{children}</div>, // Simple div mock
	CommandInput: ({ value, onValueChange, placeholder, className, _ref }: any) => (
		<input
			value={value}
			onChange={(e) => onValueChange && onValueChange(e.target.value)}
			placeholder={placeholder}
			className={className}
		/>
	),
	CommandItem: ({ children, value, onSelect }: any) => (
		<div onClick={() => onSelect && onSelect(value)}>{children}</div> // Simple div mock
	),
	CommandList: ({ children }: any) => <div>{children}</div>, // Simple div mock
	Popover: ({ children, _open, _onOpenChange }: any) => <div>{children}</div>, // Simple div mock
	PopoverContent: ({ children, _className }: any) => <div>{children}</div>, // Simple div mock
	PopoverTrigger: ({ children, _asChild }: any) => <div>{children}</div>, // Simple div mock
	Slider: ({ value, onChange }: any) => (
		<div data-testid="slider">
			<input type="range" value={value || 0} onChange={(e) => onChange(parseFloat(e.target.value))} />
		</div>
	),
}))

jest.mock("../TemperatureControl", () => ({
	TemperatureControl: ({ value, onChange }: any) => (
		<div data-testid="temperature-control">
			<input
				type="range"
				value={value || 0}
				onChange={(e) => onChange(parseFloat(e.target.value))}
				min={0}
				max={2}
				step={0.1}
			/>
		</div>
	),
}))

jest.mock("../RateLimitSecondsControl", () => ({
	RateLimitSecondsControl: ({ value, onChange }: any) => (
		<div data-testid="rate-limit-seconds-control">
			<input
				type="range"
				value={value || 0}
				onChange={(e) => onChange(parseFloat(e.target.value))}
				min={0}
				max={60}
				step={1}
			/>
		</div>
	),
}))

// Mock DiffSettingsControl for tests
jest.mock("../DiffSettingsControl", () => ({
	DiffSettingsControl: ({ diffEnabled, fuzzyMatchThreshold, onChange }: any) => (
		<div data-testid="diff-settings-control">
			<label>
				Enable editing through diffs
				<input
					type="checkbox"
					checked={diffEnabled}
					onChange={(e) => onChange("diffEnabled", e.target.checked)}
				/>
			</label>
			<div>
				Fuzzy match threshold
				<input
					type="range"
					value={fuzzyMatchThreshold || 1.0}
					onChange={(e) => onChange("fuzzyMatchThreshold", parseFloat(e.target.value))}
					min={0.8}
					max={1}
					step={0.005}
				/>
			</div>
		</div>
	),
}))

// Mock MaxOutputTokensControl component
jest.mock("../MaxOutputTokensControl", () => ({
	MaxOutputTokensControl: ({ modelInfo }: any) => {
		// Only render if model has maxTokens > 0
		if (modelInfo?.maxTokens && modelInfo.maxTokens > 0) {
			return (
				<div data-testid="max-output-tokens-control">
					<div>Max Output Tokens</div>
					<input type="range" min={8192} max={modelInfo.maxTokens} step={1024} />
				</div>
			)
		}
		return null
	},
}))

// Mock ThinkingBudget component
jest.mock("../ThinkingBudget", () => ({
	ThinkingBudget: ({ modelInfo }: any) => {
		// Only render if model supports reasoning budget (thinking models)
		if (modelInfo?.supportsReasoningBudget || modelInfo?.requiredReasoningBudget) {
			return (
				<div data-testid="reasoning-budget">
					<div>Max Thinking Tokens</div>
					<input type="range" min={1024} max={100000} step={1024} />
				</div>
			)
		}
		return null
	},
}))

// Mock LiteLLM provider for tests
jest.mock("../providers/LiteLLM", () => ({
	LiteLLM: ({ apiConfiguration, setApiConfigurationField }: any) => (
		<div data-testid="litellm-provider">
			<input
				data-testid="litellm-base-url"
				type="text"
				value={apiConfiguration.litellmBaseUrl || ""}
				onChange={(e) => setApiConfigurationField("litellmBaseUrl", e.target.value)}
				placeholder="Base URL"
			/>
			<input
				data-testid="litellm-api-key"
				type="password"
				value={apiConfiguration.litellmApiKey || ""}
				onChange={(e) => setApiConfigurationField("litellmApiKey", e.target.value)}
				placeholder="API Key"
			/>
			<button data-testid="litellm-refresh-models">Refresh Models</button>
		</div>
	),
}))

jest.mock("@src/components/ui/hooks/useSelectedModel", () => ({
	useSelectedModel: jest.fn((apiConfiguration: ProviderSettings) => {
		if (apiConfiguration.apiModelId?.includes("thinking")) {
			const info: ModelInfo = {
				contextWindow: 4000,
				maxTokens: 128000,
				supportsPromptCache: true,
				requiredReasoningBudget: true,
				supportsReasoningBudget: true,
			}

			return {
				provider: apiConfiguration.apiProvider,
				info,
			}
		} else if (apiConfiguration.apiModelId === "non-thinking-model-with-max-tokens") {
			const info: ModelInfo = {
				contextWindow: 4000,
				maxTokens: 16384,
				supportsPromptCache: true,
				supportsReasoningBudget: false,
			}

			return {
				provider: apiConfiguration.apiProvider,
				info,
			}
		} else {
			const info: ModelInfo = { contextWindow: 4000, supportsPromptCache: true }

			return {
				provider: apiConfiguration.apiProvider,
				info,
			}
		}
	}),
}))

const renderApiOptions = (props: Partial<ApiOptionsProps> = {}) => {
	const queryClient = new QueryClient()

	render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<ApiOptions
					errorMessage={undefined}
					setErrorMessage={() => {}}
					uriScheme={undefined}
					apiConfiguration={{}}
					setApiConfigurationField={() => {}}
					{...props}
				/>
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)
}

describe("ApiOptions Component", () => {
	it("renders controls for non-thinking model with max tokens", () => {
		renderApiOptions({
			apiConfiguration: {
				apiProvider: "mock-provider",
				apiModelId: "non-thinking-model-with-max-tokens",
			},
		})

		// Should show MaxOutputTokensControl
		expect(screen.getByTestId("max-output-tokens-control")).toBeInTheDocument()
		expect(screen.getByText("Max Output Tokens")).toBeInTheDocument()

		// Should NOT show ThinkingBudget
		expect(screen.queryByTestId("reasoning-budget")).not.toBeInTheDocument()
	})

	it("renders controls for thinking model", () => {
		renderApiOptions({
			apiConfiguration: {
				apiProvider: "mock-provider",
				apiModelId: "thinking-model-with-max-tokens",
			},
		})

		// Should show both controls
		expect(screen.getByTestId("max-output-tokens-control")).toBeInTheDocument()
		expect(screen.getByTestId("reasoning-budget")).toBeInTheDocument()
	})

	it("renders no token controls for model without max tokens", () => {
		renderApiOptions({
			apiConfiguration: {
				apiProvider: "mock-provider",
				apiModelId: "model-without-max-tokens",
			},
		})

		// Should show neither control
		expect(screen.queryByTestId("max-output-tokens-control")).not.toBeInTheDocument()
		expect(screen.queryByTestId("reasoning-budget")).not.toBeInTheDocument()
	})

	it("hides all controls when fromWelcomeView is true", () => {
		renderApiOptions({ fromWelcomeView: true })
		// Check for absence of DiffSettingsControl text
		expect(screen.queryByText(/enable editing through diffs/i)).not.toBeInTheDocument()
		expect(screen.queryByTestId("temperature-control")).not.toBeInTheDocument()
		expect(screen.queryByTestId("rate-limit-seconds-control")).not.toBeInTheDocument()
	})

	it("renders LiteLLM provider fields when litellm is selected", () => {
		renderApiOptions({
			apiConfiguration: {
				apiProvider: "litellm",
			},
		})

		expect(screen.getByTestId("litellm-provider")).toBeInTheDocument()
		expect(screen.getByTestId("litellm-base-url")).toBeInTheDocument()
		expect(screen.getByTestId("litellm-api-key")).toBeInTheDocument()
		expect(screen.getByTestId("litellm-refresh-models")).toBeInTheDocument()
	})

	it("updates LiteLLM fields when values change", () => {
		const setApiConfigurationField = jest.fn()
		renderApiOptions({
			apiConfiguration: {
				apiProvider: "litellm",
				litellmBaseUrl: "http://localhost:4000",
				litellmApiKey: "test-key",
			},
			setApiConfigurationField,
		})

		const baseUrlInput = screen.getByTestId("litellm-base-url") as HTMLInputElement
		const apiKeyInput = screen.getByTestId("litellm-api-key") as HTMLInputElement

		// Check initial values
		expect(baseUrlInput.value).toBe("http://localhost:4000")
		expect(apiKeyInput.value).toBe("test-key")

		// Update values
		fireEvent.change(baseUrlInput, { target: { value: "http://localhost:5000" } })
		fireEvent.change(apiKeyInput, { target: { value: "new-key" } })

		expect(setApiConfigurationField).toHaveBeenCalledWith("litellmBaseUrl", "http://localhost:5000")
		expect(setApiConfigurationField).toHaveBeenCalledWith("litellmApiKey", "new-key")
	})
})