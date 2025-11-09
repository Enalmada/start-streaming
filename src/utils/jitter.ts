/**
 * Add jitter to a delay to prevent thundering herd problem
 *
 * Jitter prevents all clients from reconnecting at exactly the same time,
 * which can overwhelm the server. This adds randomness within a percentage range.
 *
 * @param delay - Base delay in milliseconds
 * @param jitterPercent - Percentage of jitter (0.25 = ±25%)
 * @returns Delay with jitter applied, rounded to nearest millisecond
 *
 * @example
 * addJitter(1000, 0.25) // 750-1250ms (±25% of 1000ms)
 * addJitter(5000, 0.1)  // 4500-5500ms (±10% of 5000ms)
 */
export function addJitter(delay: number, jitterPercent: number): number {
	const jitter = delay * jitterPercent * (Math.random() * 2 - 1);
	return Math.round(delay + jitter);
}

/**
 * Calculate exponential backoff with jitter
 *
 * Combines exponential backoff with jitter for optimal retry behavior.
 *
 * @param attempt - Current retry attempt (0-indexed)
 * @param baseDelay - Initial delay in milliseconds
 * @param maxDelay - Maximum delay cap in milliseconds
 * @param jitterPercent - Percentage of jitter (default: 0.25 = ±25%)
 * @returns Delay with backoff and jitter applied
 */
export function calculateBackoffWithJitter({
	attempt,
	baseDelay,
	maxDelay,
	jitterPercent = 0.25,
}: {
	attempt: number;
	baseDelay: number;
	maxDelay: number;
	jitterPercent?: number;
}): number {
	const delay = baseDelay * 2 ** attempt;
	const cappedDelay = Math.min(delay, maxDelay);
	return addJitter(cappedDelay, jitterPercent);
}
