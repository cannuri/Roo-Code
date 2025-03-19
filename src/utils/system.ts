import * as os from "os"

/**
 * Gets the current system memory usage as a percentage
 * @returns Percentage of memory used (0-100)
 */
export function getSystemMemoryUsage(): number {
	const totalMemory = os.totalmem()
	const freeMemory = os.freemem()
	const usedMemory = totalMemory - freeMemory
	return (usedMemory / totalMemory) * 100
}

/**
 * Gets detailed memory usage information
 * @returns Object containing memory usage details
 */
export function getDetailedMemoryInfo() {
	const totalMemory = os.totalmem()
	const freeMemory = os.freemem()
	const usedMemory = totalMemory - freeMemory

	return {
		total: totalMemory,
		free: freeMemory,
		used: usedMemory,
		percentUsed: (usedMemory / totalMemory) * 100,
		processUsage: process.memoryUsage(),
	}
}

/**
 * Checks if the system is under high memory pressure
 * @param threshold Percentage threshold to consider high pressure (default: 85)
 * @returns Whether system is under high memory pressure
 */
export function isUnderHighMemoryPressure(threshold: number = 85): boolean {
	return getSystemMemoryUsage() > threshold
}
