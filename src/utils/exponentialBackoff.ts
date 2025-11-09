/**
 * Calculate exponential backoff delay
 *
 * Formula: min(baseDelay * 2^attempt, maxDelay)
 *
 * @param attempt - Current retry attempt (0-indexed)
 * @param baseDelay - Initial delay in milliseconds
 * @param maxDelay - Maximum delay cap in milliseconds
 * @returns Delay in milliseconds
 *
 * @example
 * calculateBackoff({ attempt: 0, baseDelay: 1000, maxDelay: 30000 }) // 1000ms
 * calculateBackoff({ attempt: 1, baseDelay: 1000, maxDelay: 30000 }) // 2000ms
 * calculateBackoff({ attempt: 2, baseDelay: 1000, maxDelay: 30000 }) // 4000ms
 * calculateBackoff({ attempt: 10, baseDelay: 1000, maxDelay: 30000 }) // 30000ms (capped)
 */
export function calculateBackoff({
	attempt,
	baseDelay,
	maxDelay,
}: {
	attempt: number;
	baseDelay: number;
	maxDelay: number;
}): number {
	const delay = baseDelay * 2 ** attempt;
	return Math.min(delay, maxDelay);
}
