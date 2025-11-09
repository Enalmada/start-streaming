import { describe, expect, it } from "vitest";
import { addJitter, calculateBackoffWithJitter } from "../../src/utils/jitter";

describe("addJitter", () => {
	it("should add jitter within expected range", () => {
		const delay = 1000;
		const jitterPercent = 0.25; // ±25%

		// Run multiple times to test randomness
		for (let i = 0; i < 100; i++) {
			const result = addJitter(delay, jitterPercent);

			// Should be between 750 and 1250 (±25% of 1000)
			expect(result).toBeGreaterThanOrEqual(750);
			expect(result).toBeLessThanOrEqual(1250);
		}
	});

	it("should return integer values", () => {
		const delay = 1000;
		const jitterPercent = 0.25;

		for (let i = 0; i < 100; i++) {
			const result = addJitter(delay, jitterPercent);
			expect(Number.isInteger(result)).toBe(true);
		}
	});

	it("should handle different jitter percentages", () => {
		const delay = 1000;

		// 10% jitter: 900-1100
		for (let i = 0; i < 50; i++) {
			const result = addJitter(delay, 0.1);
			expect(result).toBeGreaterThanOrEqual(900);
			expect(result).toBeLessThanOrEqual(1100);
		}

		// 50% jitter: 500-1500
		for (let i = 0; i < 50; i++) {
			const result = addJitter(delay, 0.5);
			expect(result).toBeGreaterThanOrEqual(500);
			expect(result).toBeLessThanOrEqual(1500);
		}
	});

	it("should handle zero jitter", () => {
		const delay = 1000;
		const result = addJitter(delay, 0);
		expect(result).toBe(1000);
	});
});

describe("calculateBackoffWithJitter", () => {
	it("should combine exponential backoff with jitter", () => {
		const baseDelay = 1000;
		const maxDelay = 30000;
		const jitterPercent = 0.25;

		// Attempt 0: ~1000ms (750-1250)
		for (let i = 0; i < 50; i++) {
			const result = calculateBackoffWithJitter({
				attempt: 0,
				baseDelay,
				maxDelay,
				jitterPercent,
			});
			expect(result).toBeGreaterThanOrEqual(750);
			expect(result).toBeLessThanOrEqual(1250);
		}

		// Attempt 1: ~2000ms (1500-2500)
		for (let i = 0; i < 50; i++) {
			const result = calculateBackoffWithJitter({
				attempt: 1,
				baseDelay,
				maxDelay,
				jitterPercent,
			});
			expect(result).toBeGreaterThanOrEqual(1500);
			expect(result).toBeLessThanOrEqual(2500);
		}
	});

	it("should cap at maxDelay including jitter", () => {
		const baseDelay = 1000;
		const maxDelay = 10000;
		const jitterPercent = 0.25;

		// Attempt 10 should be capped at 10000 before jitter
		// So with ±25% jitter: 7500-12500
		for (let i = 0; i < 50; i++) {
			const result = calculateBackoffWithJitter({
				attempt: 10,
				baseDelay,
				maxDelay,
				jitterPercent,
			});
			expect(result).toBeGreaterThanOrEqual(7500);
			expect(result).toBeLessThanOrEqual(12500);
		}
	});

	it("should use default jitterPercent of 0.25", () => {
		const baseDelay = 1000;
		const maxDelay = 30000;

		// Should use default 25% jitter
		for (let i = 0; i < 50; i++) {
			const result = calculateBackoffWithJitter({
				attempt: 0,
				baseDelay,
				maxDelay,
			});
			expect(result).toBeGreaterThanOrEqual(750);
			expect(result).toBeLessThanOrEqual(1250);
		}
	});

	it("should return integer values", () => {
		const baseDelay = 1000;
		const maxDelay = 30000;

		for (let i = 0; i < 100; i++) {
			const result = calculateBackoffWithJitter({
				attempt: i % 10,
				baseDelay,
				maxDelay,
			});
			expect(Number.isInteger(result)).toBe(true);
		}
	});
});
