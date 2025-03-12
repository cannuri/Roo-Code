import { InstructionsRegistry, InstructionSection } from "../InstructionsRegistry"

describe("InstructionsRegistry", () => {
	let registry: InstructionsRegistry

	// Mock the Date.now function to control timestamps for testing
	const originalDateNow = Date.now
	let mockNow = 1000

	beforeEach(() => {
		// Reset the registry before each test
		registry = new InstructionsRegistry(1000) // 1 second cache expiration for testing

		// Mock Date.now
		Date.now = jest.fn(() => mockNow)
	})

	afterEach(() => {
		// Restore original Date.now
		Date.now = originalDateNow
	})

	describe("registerSection", () => {
		it("should register a new instruction section", () => {
			const section: InstructionSection = {
				id: "test-section",
				title: "Test Section",
				description: "A test section",
				getContent: async () => "Test content",
			}

			registry.registerSection(section)

			expect(registry.getSectionIds()).toContain("test-section")
			expect(registry.getAllSections()).toContainEqual(section)
		})

		it("should throw an error when registering a section with duplicate ID", () => {
			const section1: InstructionSection = {
				id: "duplicate-id",
				title: "Section 1",
				description: "First section",
				getContent: async () => "Content 1",
			}

			const section2: InstructionSection = {
				id: "duplicate-id",
				title: "Section 2",
				description: "Second section",
				getContent: async () => "Content 2",
			}

			registry.registerSection(section1)

			expect(() => {
				registry.registerSection(section2)
			}).toThrow("Instruction section with ID 'duplicate-id' is already registered")
		})
	})

	describe("getSection", () => {
		it("should return null for non-existent section", async () => {
			const result = await registry.getSection("non-existent", {})
			expect(result).toBeNull()
		})

		it("should retrieve section content", async () => {
			const mockGetContent = jest.fn().mockResolvedValue("Dynamic content")

			const section: InstructionSection = {
				id: "dynamic-section",
				title: "Dynamic Section",
				description: "A section with dynamic content",
				getContent: mockGetContent,
			}

			registry.registerSection(section)

			const context = { user: "test-user" }
			const result = await registry.getSection("dynamic-section", context)

			expect(result).toBe("Dynamic content")
			expect(mockGetContent).toHaveBeenCalledWith(context)
		})

		it("should handle errors in getContent", async () => {
			const mockGetContent = jest.fn().mockRejectedValue(new Error("Content error"))

			const section: InstructionSection = {
				id: "error-section",
				title: "Error Section",
				description: "A section that throws an error",
				getContent: mockGetContent,
			}

			registry.registerSection(section)

			// Spy on console.error
			const consoleSpy = jest.spyOn(console, "error").mockImplementation()

			const result = await registry.getSection("error-section", {})

			expect(result).toBeNull()
			expect(consoleSpy).toHaveBeenCalled()

			// Restore console.error
			consoleSpy.mockRestore()
		})
	})

	describe("caching", () => {
		it("should cache section content", async () => {
			const mockGetContent = jest.fn().mockResolvedValue("Cached content")

			const section: InstructionSection = {
				id: "cache-section",
				title: "Cache Section",
				description: "A section that tests caching",
				getContent: mockGetContent,
			}

			registry.registerSection(section)

			// First call should fetch content
			await registry.getSection("cache-section", {})
			expect(mockGetContent).toHaveBeenCalledTimes(1)

			// Second call should use cache
			await registry.getSection("cache-section", {})
			expect(mockGetContent).toHaveBeenCalledTimes(1) // Still only called once
		})

		it("should refresh cache when expired", async () => {
			const mockGetContent = jest.fn().mockResolvedValue("Refreshed content")

			const section: InstructionSection = {
				id: "expire-section",
				title: "Expire Section",
				description: "A section that tests cache expiration",
				getContent: mockGetContent,
			}

			registry.registerSection(section)

			// First call should fetch content
			await registry.getSection("expire-section", {})
			expect(mockGetContent).toHaveBeenCalledTimes(1)

			// Advance time beyond cache expiration
			mockNow += 1500 // 1.5 seconds (beyond our 1 second expiration)

			// Second call should refresh cache
			await registry.getSection("expire-section", {})
			expect(mockGetContent).toHaveBeenCalledTimes(2)
		})

		it("should refresh cache when context changes", async () => {
			const mockGetContent = jest.fn().mockResolvedValue("Context-specific content")

			const section: InstructionSection = {
				id: "context-section",
				title: "Context Section",
				description: "A section that tests context changes",
				getContent: mockGetContent,
			}

			registry.registerSection(section)

			// First call with context A
			await registry.getSection("context-section", { user: "user-a" })
			expect(mockGetContent).toHaveBeenCalledTimes(1)

			// Second call with different context B
			await registry.getSection("context-section", { user: "user-b" })
			expect(mockGetContent).toHaveBeenCalledTimes(2)

			// Third call with context A again
			await registry.getSection("context-section", { user: "user-a" })
			expect(mockGetContent).toHaveBeenCalledTimes(3)
		})

		it("should clear cache for specific section", async () => {
			const mockGetContent = jest.fn().mockResolvedValue("Clear cache content")

			const section: InstructionSection = {
				id: "clear-section",
				title: "Clear Section",
				description: "A section that tests cache clearing",
				getContent: mockGetContent,
			}

			registry.registerSection(section)

			// First call should fetch content
			await registry.getSection("clear-section", {})
			expect(mockGetContent).toHaveBeenCalledTimes(1)

			// Clear cache for this section
			registry.clearSectionCache("clear-section")

			// Second call should fetch content again
			await registry.getSection("clear-section", {})
			expect(mockGetContent).toHaveBeenCalledTimes(2)
		})

		it("should clear entire cache", async () => {
			const mockGetContent1 = jest.fn().mockResolvedValue("Content 1")
			const mockGetContent2 = jest.fn().mockResolvedValue("Content 2")

			const section1: InstructionSection = {
				id: "section-1",
				title: "Section 1",
				description: "First section",
				getContent: mockGetContent1,
			}

			const section2: InstructionSection = {
				id: "section-2",
				title: "Section 2",
				description: "Second section",
				getContent: mockGetContent2,
			}

			registry.registerSection(section1)
			registry.registerSection(section2)

			// First calls should fetch content
			await registry.getSection("section-1", {})
			await registry.getSection("section-2", {})
			expect(mockGetContent1).toHaveBeenCalledTimes(1)
			expect(mockGetContent2).toHaveBeenCalledTimes(1)

			// Clear entire cache
			registry.clearCache()

			// Second calls should fetch content again
			await registry.getSection("section-1", {})
			await registry.getSection("section-2", {})
			expect(mockGetContent1).toHaveBeenCalledTimes(2)
			expect(mockGetContent2).toHaveBeenCalledTimes(2)
		})
	})

	describe("edge cases", () => {
		it("should handle non-serializable context", async () => {
			const mockGetContent = jest.fn().mockResolvedValue("Non-serializable content")

			const section: InstructionSection = {
				id: "complex-context",
				title: "Complex Context",
				description: "A section with non-serializable context",
				getContent: mockGetContent,
			}

			registry.registerSection(section)

			// Create a circular reference
			const circularContext: any = { name: "circular" }
			circularContext.self = circularContext

			// First call with circular context
			await registry.getSection("complex-context", circularContext)
			expect(mockGetContent).toHaveBeenCalledTimes(1)

			// Second call with same circular context
			// Should not use cache due to serialization failure
			await registry.getSection("complex-context", circularContext)
			expect(mockGetContent).toHaveBeenCalledTimes(2)

			// Spy on console.warn for cloneContext failure
			const warnSpy = jest.spyOn(console, "warn").mockImplementation()

			// Third call to trigger cloneContext warning
			await registry.getSection("complex-context", circularContext)

			expect(warnSpy).toHaveBeenCalled()
			warnSpy.mockRestore()
		})
	})
})
