/**
 * Custom error types for capability-related failures
 */
export class CapabilityError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly details?: unknown,
	) {
		super(message)
		this.name = "CapabilityError"
		Error.captureStackTrace(this, this.constructor)
	}

	/**
	 * Creates a sanitized error message safe for production logging
	 */
	public toSafeString(): string {
		return `${this.name}[${this.code}]: ${this.message.replace(/[^\w\s-]/g, "")}`
	}
}

export class InvalidModelError extends CapabilityError {
	constructor(message: string, details?: unknown) {
		super(message, "INVALID_MODEL", details)
	}
}

export class InvalidCapabilityError extends CapabilityError {
	constructor(message: string, details?: unknown) {
		super(message, "INVALID_CAPABILITY", details)
	}
}

export class ValidationError extends CapabilityError {
	constructor(message: string, details?: unknown) {
		super(message, "VALIDATION_ERROR", details)
	}
}

export class RateLimitError extends CapabilityError {
	constructor(message: string, details?: unknown) {
		super(message, "RATE_LIMIT_EXCEEDED", details)
	}
}

export class TimeoutError extends CapabilityError {
	constructor(message: string, details?: unknown) {
		super(message, "OPERATION_TIMEOUT", details)
	}
}
