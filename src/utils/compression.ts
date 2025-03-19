import { deflateSync, inflateSync } from "zlib"

/**
 * Compresses a string using zlib deflate
 * @param data String to compress
 * @returns Base64 encoded compressed data
 */
export function compress(data: string): string {
	try {
		const buffer = Buffer.from(data, "utf8")
		const compressed = deflateSync(buffer)
		return compressed.toString("base64")
	} catch (error) {
		throw new Error(`Compression failed: ${error instanceof Error ? error.message : String(error)}`)
	}
}

/**
 * Decompresses a base64 encoded compressed string
 * @param data Base64 encoded compressed data
 * @returns Original string
 */
export function decompress(data: string): string {
	try {
		const buffer = Buffer.from(data, "base64")
		const decompressed = inflateSync(buffer)
		return decompressed.toString("utf8")
	} catch (error) {
		throw new Error(`Decompression failed: ${error instanceof Error ? error.message : String(error)}`)
	}
}
