import { compress, decompress } from "../compression"

describe("Compression Utils", () => {
	const testData = {
		simple: "Hello, World!",
		long: "x".repeat(1000),
		json: JSON.stringify({ key: "value", nested: { array: [1, 2, 3] } }),
		unicode: "你好，世界！",
		special: "!@#$%^&*()_+-=[]{}|;:,.<>?",
	}

	describe("compress", () => {
		it("should compress strings", () => {
			Object.entries(testData).forEach(([type, data]) => {
				const compressed = compress(data)
				expect(compressed).toBeDefined()
				expect(typeof compressed).toBe("string")
				expect(compressed.length).toBeLessThan(data.length * 2) // Base64 encoding can increase size
			})
		})

		it("should handle empty string", () => {
			const compressed = compress("")
			expect(compressed).toBeDefined()
			expect(typeof compressed).toBe("string")
		})

		it("should throw on invalid input", () => {
			expect(() => compress(null as any)).toThrow()
			expect(() => compress(undefined as any)).toThrow()
		})
	})

	describe("decompress", () => {
		it("should decompress to original string", () => {
			Object.entries(testData).forEach(([type, data]) => {
				const compressed = compress(data)
				const decompressed = decompress(compressed)
				expect(decompressed).toBe(data)
			})
		})

		it("should handle empty string", () => {
			const compressed = compress("")
			const decompressed = decompress(compressed)
			expect(decompressed).toBe("")
		})

		it("should throw on invalid input", () => {
			expect(() => decompress("invalid base64!")).toThrow()
			expect(() => decompress("")).toThrow()
			expect(() => decompress(null as any)).toThrow()
			expect(() => decompress(undefined as any)).toThrow()
		})
	})

	describe("roundtrip", () => {
		it("should handle large strings", () => {
			const largeData = "x".repeat(100000)
			const compressed = compress(largeData)
			const decompressed = decompress(compressed)
			expect(decompressed).toBe(largeData)
			expect(compressed.length).toBeLessThan(largeData.length)
		})

		it("should handle repeated compression/decompression", () => {
			let data = JSON.stringify({ key: "value" })
			for (let i = 0; i < 10; i++) {
				const compressed = compress(data)
				const decompressed = decompress(compressed)
				expect(decompressed).toBe(data)
				data = compressed // Use compressed data as input for next iteration
			}
		})

		it("should preserve all characters", () => {
			const allChars = Array.from({ length: 128 }, (_, i) => String.fromCharCode(i)).join("")
			const compressed = compress(allChars)
			const decompressed = decompress(compressed)
			expect(decompressed).toBe(allChars)
		})
	})

	describe("error handling", () => {
		it("should provide meaningful error messages", () => {
			expect(() => decompress("invalid")).toThrow("Decompression failed")
			expect(() => compress(null as any)).toThrow("Compression failed")
		})

		it("should handle malformed compressed data", () => {
			const validCompressed = compress("test")
			const malformed = validCompressed.slice(0, -10) // Truncate the data
			expect(() => decompress(malformed)).toThrow()
		})
	})

	describe("performance", () => {
		it("should compress efficiently", () => {
			const repeatingData = "abc".repeat(1000)
			const compressed = compress(repeatingData)
			expect(compressed.length).toBeLessThan(repeatingData.length / 2)
		})

		it("should handle compression of varied content", () => {
			const mixedData = {
				text: "Sample text",
				numbers: Array.from({ length: 1000 }, (_, i) => i),
				binary: Buffer.from("binary data").toString("base64"),
				nested: {
					deep: {
						deeper: {
							deepest: "content",
						},
					},
				},
			}

			const stringified = JSON.stringify(mixedData)
			const compressed = compress(stringified)
			const decompressed = decompress(compressed)
			expect(JSON.parse(decompressed)).toEqual(mixedData)
		})
	})
})
