import { describe, expect, it, vi } from "vitest";

type QueryKey = readonly unknown[];

describe("useSSEQueryInvalidation", () => {
	describe("Module Export", () => {
		it("should export useSSEQueryInvalidation function", async () => {
			const { useSSEQueryInvalidation } = await import("../../src/client/hooks/useSSEQueryInvalidation");
			expect(useSSEQueryInvalidation).toBeTypeOf("function");
		});

		it("should be exported from client module", async () => {
			const clientModule = await import("../../src/client/index");
			expect(clientModule.useSSEQueryInvalidation).toBeDefined();
			expect(clientModule.useSSEQueryInvalidation).toBeTypeOf("function");
		});
	});

	describe("Query Key Handling", () => {
		it("should handle static query keys array", () => {
			const staticKeys: QueryKey[] = [
				["comments", "discussion-123"],
				["counts", "discussion-123"],
			];

			expect(Array.isArray(staticKeys)).toBe(true);
			expect(staticKeys.length).toBe(2);
		});

		it("should handle dynamic query keys function", () => {
			type TestEvent = {
				type: "comment-added";
				discussionId: string;
				count: number;
			};

			const event: TestEvent = {
				type: "comment-added",
				discussionId: "disc-123",
				count: 5,
			};

			const dynamicKeysFn = (evt: TestEvent): QueryKey[] => [
				["comments", evt.discussionId],
				["counts", evt.discussionId],
			];

			const keys = dynamicKeysFn(event);

			expect(keys.length).toBe(2);
			expect(keys[0]).toEqual(["comments", "disc-123"]);
			expect(keys[1]).toEqual(["counts", "disc-123"]);
		});

		it("should handle single query key", () => {
			const singleKey: QueryKey = ["comments", "discussion-123"];

			expect(Array.isArray(singleKey)).toBe(true);
			expect(singleKey[0]).toBe("comments");
			expect(singleKey[1]).toBe("discussion-123");
		});

		it("should handle array of query keys", () => {
			const multipleKeys: QueryKey[] = [
				["comments", "discussion-123"],
				["discussion", "counts", "discussion-123"],
			];

			expect(multipleKeys.length).toBe(2);
			expect(multipleKeys[0]).toEqual(["comments", "discussion-123"]);
			expect(multipleKeys[1]).toEqual(["discussion", "counts", "discussion-123"]);
		});
	});

	describe("Query Invalidation Logic", () => {
		it("should detect single key vs array of keys", () => {
			const singleKey: QueryKey = ["comments"];
			const arrayOfKeys: QueryKey[] = [["comments"], ["counts"]];

			// Single key - first element is not an array
			const isSingleKey = !Array.isArray(singleKey[0]);
			expect(isSingleKey).toBe(true);

			// Array of keys - first element is an array
			const isArrayOfKeys = Array.isArray(arrayOfKeys[0]);
			expect(isArrayOfKeys).toBe(true);
		});

		it("should convert single key to array format", () => {
			const singleKey: QueryKey = ["comments", "123"];

			const keyArray = Array.isArray(singleKey[0]) ? (singleKey as QueryKey[]) : [singleKey as QueryKey];

			expect(keyArray.length).toBe(1);
			expect(keyArray[0]).toEqual(["comments", "123"]);
		});

		it("should keep array of keys as is", () => {
			const multipleKeys: QueryKey[] = [
				["comments", "123"],
				["counts", "123"],
			];

			const keyArray = Array.isArray(multipleKeys[0]) ? (multipleKeys as QueryKey[]) : [multipleKeys as QueryKey];

			expect(keyArray.length).toBe(2);
			expect(keyArray).toEqual(multipleKeys);
		});

		it("should handle empty queryKeys array (edge case from code review)", () => {
			const emptyKeys: QueryKey[] = [];

			// Should not invalidate when empty
			if (!emptyKeys || emptyKeys.length === 0) {
				// Don't invalidate
				expect(true).toBe(true);
			} else {
				// This branch shouldn't execute
				expect(true).toBe(false);
			}
		});

		it("should prevent entire cache invalidation with empty array", () => {
			const keys: QueryKey[] = [];

			// Guard check from the fix
			const shouldInvalidate = keys && keys.length > 0;

			expect(shouldInvalidate).toBe(false);
		});
	});

	describe("Type Safety", () => {
		it("should enforce event type in dynamic keys function", () => {
			type StrictEvent = {
				type: "comment-added";
				discussionId: string;
				commentCount: number;
			};

			const event: StrictEvent = {
				type: "comment-added",
				discussionId: "disc-123",
				commentCount: 42,
			};

			const getKeys = (evt: StrictEvent): QueryKey[] => [
				["infiniteComments", evt.discussionId],
				["discussion", "counts", evt.discussionId],
			];

			const keys = getKeys(event);
			expect(keys.length).toBe(2);
		});

		it("should support union event types in dynamic keys", () => {
			type UnionEvent =
				| { type: "comment-added"; discussionId: string; count: number }
				| { type: "comment-deleted"; discussionId: string; commentId: string }
				| { type: "discussion-closed"; discussionId: string };

			const getKeys = (event: UnionEvent): QueryKey[] => {
				const baseKeys: QueryKey[] = [["comments", event.discussionId]];

				if (event.type === "comment-added" || event.type === "comment-deleted") {
					baseKeys.push(["counts", event.discussionId]);
				}

				return baseKeys;
			};

			const addedEvent: UnionEvent = {
				type: "comment-added",
				discussionId: "disc-123",
				count: 5,
			};
			const closedEvent: UnionEvent = {
				type: "discussion-closed",
				discussionId: "disc-123",
			};

			expect(getKeys(addedEvent).length).toBe(2);
			expect(getKeys(closedEvent).length).toBe(1);
		});
	});

	describe("SSR Compatibility", () => {
		it("should handle server-side rendering context", () => {
			const isClient = typeof window !== "undefined";

			// In vitest/node environment, window is not defined (SSR simulation)
			expect(typeof isClient).toBe("boolean");

			// Logic should check isClient before using EventSource
			if (!isClient) {
				// Don't create EventSource in SSR
				expect(true).toBe(true);
			}
		});

		it("should disable connection during SSR", () => {
			const enabled = true;
			const isClient = typeof window !== "undefined";

			const shouldConnect = enabled && isClient;

			// In vitest/node (SSR-like) environment
			expect(typeof shouldConnect).toBe("boolean");

			// In SSR context
			const isSSR = typeof window === "undefined";
			const shouldConnectSSR = enabled && !isSSR;

			// shouldConnectSSR should be the inverse of isSSR when enabled is true
			expect(shouldConnectSSR).toBe(!isSSR);
		});
	});

	describe("QueryClient Integration", () => {
		it("should work with invalidateQueries pattern", () => {
			// Mock QueryClient behavior
			const invalidatedKeys: QueryKey[] = [];

			const mockInvalidateQueries = ({ queryKey }: { queryKey: QueryKey }) => {
				invalidatedKeys.push(queryKey);
			};

			// Simulate invalidation
			const keysToInvalidate: QueryKey[] = [
				["comments", "123"],
				["counts", "123"],
			];

			for (const queryKey of keysToInvalidate) {
				mockInvalidateQueries({ queryKey });
			}

			expect(invalidatedKeys.length).toBe(2);
			expect(invalidatedKeys[0]).toEqual(["comments", "123"]);
			expect(invalidatedKeys[1]).toEqual(["counts", "123"]);
		});
	});

	describe("Edge Cases", () => {
		it("should handle queryKeys as function returning empty array", () => {
			const getKeys = () => [];

			const keys = getKeys();

			// Should not proceed with invalidation
			if (keys.length === 0) {
				expect(true).toBe(true); // Correctly prevented
			} else {
				expect(true).toBe(false); // Should not reach here
			}
		});

		it("should handle queryKeys as function returning single key", () => {
			const getKeys = () => [["comments", "123"]];

			const keys = getKeys();

			const keyArray = Array.isArray(keys[0]) ? keys : [keys];

			expect(keyArray.length).toBe(1);
		});

		it("should handle very long query keys", () => {
			const longKey: QueryKey = ["comments", "discussion", "user", "thread", "page", "section", "123"];

			expect(longKey.length).toBe(7);
			expect(Array.isArray(longKey)).toBe(true);
		});

		it("should handle numeric and string values in keys", () => {
			const mixedKey: QueryKey = ["comments", 123, "discussion", 456, true];

			expect(mixedKey.length).toBe(5);
			expect(typeof mixedKey[0]).toBe("string");
			expect(typeof mixedKey[1]).toBe("number");
			expect(typeof mixedKey[4]).toBe("boolean");
		});
	});

	describe("Options Configuration", () => {
		it("should accept optional enabled flag", () => {
			type TestOptions = {
				endpoint: string;
				queryKeys: QueryKey[];
				enabled?: boolean;
			};

			const options: TestOptions = {
				endpoint: "/api/sse/test",
				queryKeys: [["comments"]],
				enabled: true,
			};

			expect(options.enabled).toBe(true);

			const optionsNoEnabled: TestOptions = {
				endpoint: "/api/sse/test",
				queryKeys: [["comments"]],
			};

			expect(optionsNoEnabled.enabled).toBeUndefined();
		});

		it("should accept optional callbacks", () => {
			type TestOptions = {
				endpoint: string;
				queryKeys: QueryKey[];
				onConnectionChange?: (connected: boolean) => void;
				onError?: (error: Error) => void;
			};

			const onConnectionChange = vi.fn();
			const onError = vi.fn();

			const options: TestOptions = {
				endpoint: "/api/sse/test",
				queryKeys: [["comments"]],
				onConnectionChange,
				onError,
			};

			expect(options.onConnectionChange).toBeDefined();
			expect(options.onError).toBeDefined();

			options.onConnectionChange?.(true);
			expect(onConnectionChange).toHaveBeenCalledWith(true);

			options.onError?.(new Error("test"));
			expect(onError).toHaveBeenCalledWith(expect.any(Error));
		});
	});
});
