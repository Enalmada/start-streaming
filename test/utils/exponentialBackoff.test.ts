import { describe, expect, it } from "vitest";
import { calculateBackoff } from "../../src/utils/exponentialBackoff";

describe("calculateBackoff", () => {
	it("should calculate exponential backoff correctly", () => {
		const baseDelay = 1000;
		const maxDelay = 30000;

		expect(calculateBackoff({ attempt: 0, baseDelay, maxDelay })).toBe(1000); // 1000 * 2^0
		expect(calculateBackoff({ attempt: 1, baseDelay, maxDelay })).toBe(2000); // 1000 * 2^1
		expect(calculateBackoff({ attempt: 2, baseDelay, maxDelay })).toBe(4000); // 1000 * 2^2
		expect(calculateBackoff({ attempt: 3, baseDelay, maxDelay })).toBe(8000); // 1000 * 2^3
		expect(calculateBackoff({ attempt: 4, baseDelay, maxDelay })).toBe(16000); // 1000 * 2^4
	});

	it("should cap delay at maxDelay", () => {
		const baseDelay = 1000;
		const maxDelay = 30000;

		expect(calculateBackoff({ attempt: 10, baseDelay, maxDelay })).toBe(30000); // capped
		expect(calculateBackoff({ attempt: 100, baseDelay, maxDelay })).toBe(30000); // capped
	});

	it("should handle different base delays", () => {
		const maxDelay = 60000;

		expect(calculateBackoff({ attempt: 0, baseDelay: 500, maxDelay })).toBe(500);
		expect(calculateBackoff({ attempt: 1, baseDelay: 500, maxDelay })).toBe(1000);
		expect(calculateBackoff({ attempt: 2, baseDelay: 2000, maxDelay })).toBe(8000);
	});

	it("should handle edge cases", () => {
		expect(calculateBackoff({ attempt: 0, baseDelay: 0, maxDelay: 1000 })).toBe(0);
		expect(calculateBackoff({ attempt: 0, baseDelay: 1, maxDelay: 1 })).toBe(1);
	});
});
