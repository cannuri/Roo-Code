/**
 * InstructionsRegistry service
 *
 * Manages registration and retrieval of instruction sections for dynamic prompt loading.
 * Includes caching mechanism to optimize performance.
 */

/**
 * Interface for instruction section
 */
export interface InstructionSection {
	/** Unique identifier for the section */
	id: string
	/** Human-readable title */
	title: string
	/** Description of what this instruction section contains */
	description: string
	/** Function to retrieve the content of the section based on context */
	getContent: (context: any) => Promise<string>
}

/**
 * Interface for cached instruction
 */
interface CachedInstruction {
	/** The content of the instruction */
	content: string
	/** Timestamp when the instruction was cached */
	timestamp: number
	/** Context used to generate this instruction */
	context: any
}

/**
 * Default cache expiration time in milliseconds (5 minutes)
 */
const DEFAULT_CACHE_EXPIRATION = 5 * 60 * 1000

/**
 * Service for managing instruction sections
 */
export class InstructionsRegistry {
	/** Map of registered instruction sections */
	private instructionSections: Map<string, InstructionSection> = new Map()
	/** Cache of retrieved instruction contents */
	private cache: Map<string, CachedInstruction> = new Map()
	/** Cache expiration time in milliseconds */
	private cacheExpirationTime: number

	/**
	 * Creates a new InstructionsRegistry
	 * @param cacheExpirationTime Optional custom cache expiration time in milliseconds
	 */
	constructor(cacheExpirationTime: number = DEFAULT_CACHE_EXPIRATION) {
		this.cacheExpirationTime = cacheExpirationTime
	}

	/**
	 * Register a new instruction section
	 * @param section The instruction section to register
	 * @throws Error if a section with the same ID is already registered
	 */
	registerSection(section: InstructionSection): void {
		if (this.instructionSections.has(section.id)) {
			throw new Error(`Instruction section with ID '${section.id}' is already registered`)
		}
		this.instructionSections.set(section.id, section)
	}

	/**
	 * Get an instruction section by ID
	 * @param sectionId The ID of the section to retrieve
	 * @param context The context to use for generating the section content
	 * @returns The section content or null if not found
	 */
	async getSection(sectionId: string, context: any): Promise<string | null> {
		try {
			// Check if section exists
			const section = this.instructionSections.get(sectionId)
			if (!section) {
				return null
			}

			// Check cache first
			const cachedInstruction = this.cache.get(sectionId)
			if (cachedInstruction && this.isCacheValid(cachedInstruction, context)) {
				return cachedInstruction.content
			}

			// Get fresh content
			const content = await section.getContent(context)

			// Cache the result
			this.cache.set(sectionId, {
				content,
				timestamp: Date.now(),
				context: this.cloneContext(context),
			})

			return content
		} catch (error) {
			console.error(`Error retrieving instruction section '${sectionId}':`, error)
			return null
		}
	}

	/**
	 * Get all registered section IDs
	 * @returns Array of section IDs
	 */
	getSectionIds(): string[] {
		return Array.from(this.instructionSections.keys())
	}

	/**
	 * Get all registered sections
	 * @returns Array of instruction sections
	 */
	getAllSections(): InstructionSection[] {
		return Array.from(this.instructionSections.values())
	}

	/**
	 * Clear the cache for a specific section
	 * @param sectionId The ID of the section to clear from cache
	 */
	clearSectionCache(sectionId: string): void {
		this.cache.delete(sectionId)
	}

	/**
	 * Clear the entire cache
	 */
	clearCache(): void {
		this.cache.clear()
	}

	/**
	 * Check if a cached instruction is still valid
	 * @param cachedInstruction The cached instruction to check
	 * @param currentContext The current context to compare against
	 * @returns True if the cache is valid, false otherwise
	 */
	private isCacheValid(cachedInstruction: CachedInstruction | undefined, currentContext: any): boolean {
		if (!cachedInstruction) {
			return false
		}

		// Check if cache has expired
		const now = Date.now()
		if (now - cachedInstruction.timestamp > this.cacheExpirationTime) {
			return false
		}

		// Check if context has changed significantly
		return this.isContextEquivalent(cachedInstruction.context, currentContext)
	}

	/**
	 * Check if two contexts are equivalent for caching purposes
	 * This is a simple implementation that can be extended for more complex context comparison
	 * @param cachedContext The cached context
	 * @param currentContext The current context
	 * @returns True if contexts are equivalent, false otherwise
	 */
	private isContextEquivalent(cachedContext: any, currentContext: any): boolean {
		// Simple JSON comparison - can be enhanced for more sophisticated context comparison
		try {
			return JSON.stringify(cachedContext) === JSON.stringify(currentContext)
		} catch (error) {
			// If contexts can't be stringified, consider them different
			return false
		}
	}

	/**
	 * Create a deep clone of the context object
	 * @param context The context to clone
	 * @returns Cloned context
	 */
	private cloneContext(context: any): any {
		try {
			return JSON.parse(JSON.stringify(context))
		} catch (error) {
			// If context can't be cloned, return a new empty object
			console.warn("Failed to clone context for caching:", error)
			return {}
		}
	}
}
