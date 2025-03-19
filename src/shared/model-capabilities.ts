import { ApiConfiguration, ModelInfo } from "./api"

/**
 * Supported capability types in the system.
 * Add new capabilities here as they are introduced.
 */
export type Capability = "computerUse" | "imageAnalysis"

/**
 * Indicates how advanced a model's implementation of a capability is.
 */
export type CapabilityStrength = "basic" | "advanced"

/**
 * Detailed capability information for a model
 */
export interface CapabilityInfo {
	version: string
	strength: CapabilityStrength
}

/**
 * Complete capabilities configuration for a model
 */
export interface ModelCapabilityConfig {
	capabilities: Capability[]
	info: Record<Capability, CapabilityInfo>
}

/**
 * Type for the model capabilities configuration object
 */
type ModelCapabilitiesConfig = {
	[K: string]: {
		capabilities: Capability[]
		info: Partial<Record<Capability, CapabilityInfo>>
	}
}

/**
 * Structured capability definitions for supported models.
 * @readonly Use as const to prevent accidental mutations
 */
export const MODEL_CAPABILITIES: ModelCapabilitiesConfig = {
	"claude-3": {
		capabilities: ["computerUse", "imageAnalysis"],
		info: {
			computerUse: { version: "2.0", strength: "advanced" },
			imageAnalysis: { version: "1.0", strength: "advanced" },
		},
	},
	"gpt-4": {
		capabilities: ["computerUse"],
		info: {
			computerUse: { version: "1.0", strength: "basic" },
		},
	},
	"gpt-4o": {
		capabilities: ["computerUse"],
		info: {
			computerUse: { version: "1.0", strength: "basic" },
		},
	},
} as const

/**
 * Result of capability determination
 */
export interface ModelCapabilities {
	/** Set of all supported capabilities */
	supportedCapabilities: Set<Capability>
	/** Version information for each supported capability */
	capabilityVersions: Record<Capability, string>
	/** Strength level of each supported capability */
	capabilityStrength: Record<Capability, CapabilityStrength>
}

/**
 * Parameters for capability determination
 */
export interface CapabilityParams {
	/** Model info from API if available */
	apiModel?: ModelInfo
	/** API configuration for model ID fallback */
	apiConfiguration: ApiConfiguration
	/** Browser tool enabled setting */
	browserToolEnabled?: boolean
}

/**
 * Validates a model ID string
 * @param modelId The model ID to validate
 * @throws Error if model ID is invalid
 */
function validateModelId(modelId: string): asserts modelId is string {
	if (!modelId?.trim()) {
		throw new Error("Invalid model ID provided")
	}
}

/**
 * Validates an API model object
 * @param apiModel The API model object to validate
 * @returns True if the model object is valid
 */
function isValidApiModel(apiModel: unknown): apiModel is ModelInfo {
	if (!apiModel || typeof apiModel !== "object") return false
	return typeof (apiModel as ModelInfo)?.contextWindow === "number"
}

/**
 * Gets the base model ID from a full model ID
 * @param modelId Full model ID (e.g., "claude-3-opus")
 * @returns Base model ID (e.g., "claude-3")
 */
function getBaseModelId(modelId: string): string {
	for (const baseId of Object.keys(MODEL_CAPABILITIES)) {
		if (modelId === baseId || modelId.startsWith(`${baseId}-`)) {
			return baseId
		}
	}
	return modelId
}

/**
 * Creates empty capability records
 * @returns Empty capability records
 */
function createEmptyCapabilityRecords(): ModelCapabilities {
	return {
		supportedCapabilities: new Set(),
		capabilityVersions: {} as Record<Capability, string>,
		capabilityStrength: {} as Record<Capability, CapabilityStrength>,
	}
}

/**
 * Determines model capabilities including browser/computer use support.
 * Provides a single source of truth for capability detection across the application.
 *
 * @param params Configuration parameters for capability detection
 * @returns ModelCapabilities object indicating supported features
 * @throws Error if invalid parameters are provided
 */
export function determineModelCapabilities(params: CapabilityParams): ModelCapabilities {
	const { apiModel, apiConfiguration, browserToolEnabled = true } = params

	// Initialize empty capability records
	const capabilities = createEmptyCapabilityRecords()

	// Early return if browser tool is disabled by user
	if (!browserToolEnabled) {
		return capabilities
	}

	try {
		// First try API-based detection if model info is available
		if (apiModel) {
			if (!isValidApiModel(apiModel)) {
				throw new Error("Malformed API model object")
			}

			if (apiModel.supportsComputerUse) {
				capabilities.supportedCapabilities.add("computerUse")
				capabilities.capabilityVersions.computerUse = "1.0" // Default version for API-reported capabilities
				capabilities.capabilityStrength.computerUse = "basic" // Default strength for API-reported capabilities
				return capabilities
			}
		}

		// Fall back to model ID detection
		const modelId = apiConfiguration.apiModelId || apiConfiguration.openRouterModelId || ""
		validateModelId(modelId)

		const baseModelId = getBaseModelId(modelId)
		const modelConfig = MODEL_CAPABILITIES[baseModelId]

		if (modelConfig) {
			capabilities.supportedCapabilities = new Set(modelConfig.capabilities)
			modelConfig.capabilities.forEach((capability) => {
				const info = modelConfig.info[capability]
				if (info) {
					capabilities.capabilityVersions[capability] = info.version
					capabilities.capabilityStrength[capability] = info.strength
				}
			})
		}

		return capabilities
	} catch (error) {
		// Log error for debugging but return safe default
		console.error("Error determining model capabilities:", error)
		return capabilities
	}
}

/**
 * Helper function to check if a model supports a specific capability
 * @param capabilities The model's capabilities
 * @param capability The capability to check for
 * @returns True if the capability is supported
 */
export function hasCapability(capabilities: ModelCapabilities, capability: Capability): boolean {
	return capabilities.supportedCapabilities.has(capability)
}

/**
 * Helper function to check if a model supports computer use
 * This maintains backward compatibility with the previous API
 * @param capabilities The model's capabilities
 * @returns True if computer use is supported
 */
export function supportsComputerUse(capabilities: ModelCapabilities): boolean {
	return hasCapability(capabilities, "computerUse")
}
