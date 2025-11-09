/**
 * TanStack Query integration for SSE
 *
 * Auto-invalidates queries when SSE events are received
 */

import { useQueryClient } from "@tanstack/react-query";
import type { QueryInvalidationOptions, SSEConnectionOptions, SSEEvent } from "../../types/index.js";
import { useSSEConnection } from "./useSSEConnection.js";

/**
 * Connect to SSE endpoint and automatically invalidate TanStack Query queries
 *
 * @example
 * ```typescript
 * function DiscussionView({ discussionId }) {
 *   const queryClient = useQueryClient();
 *
 *   // Simple: invalidate specific query keys
 *   useSSEQueryInvalidation({
 *     endpoint: `/api/sse/comments/${discussionId}`,
 *     queryKeys: [['infiniteComments', discussionId]]
 *   });
 *
 *   // Advanced: dynamic query keys based on event
 *   useSSEQueryInvalidation({
 *     endpoint: `/api/sse/comments/${discussionId}`,
 *     queryKeys: (event) => [
 *       ['infiniteComments', event.discussionId],
 *       ['discussion', 'counts', event.discussionId]
 *     ]
 *   });
 * }
 * ```
 *
 * @param options - Query invalidation options
 * @returns Connection state
 */
export function useSSEQueryInvalidation<TEvent extends SSEEvent>(options: QueryInvalidationOptions<TEvent>) {
	const { endpoint, queryKeys, onConnectionChange, onError, enabled = true } = options;

	// SSR-safe: disable during server-side rendering
	const isClient = typeof window !== "undefined";
	const queryClient = useQueryClient();

	// Build connection options with proper optional handling
	const connectionOptions: SSEConnectionOptions<TEvent> = {
		endpoint,
		enabled: enabled && isClient, // Only enable on client-side
		onEvent: (event) => {
			// Guard against SSR (shouldn't happen due to enabled check, but defensive)
			if (!isClient) return;

			// Get query keys to invalidate
			const keysToInvalidate = typeof queryKeys === "function" ? queryKeys(event) : queryKeys;

			// Do nothing if no keys are provided (prevents invalidating entire cache)
			if (!keysToInvalidate || keysToInvalidate.length === 0) {
				return;
			}

			// Handle single key or array of keys
			const keyArray = Array.isArray(keysToInvalidate[0])
				? (keysToInvalidate as unknown[][])
				: [keysToInvalidate as unknown[]];

			// Invalidate all specified queries
			for (const queryKey of keyArray) {
				queryClient.invalidateQueries({ queryKey });
			}
		},
	};

	// Only add optional callbacks if they exist
	if (onConnectionChange) {
		connectionOptions.onConnectionChange = onConnectionChange;
	}
	if (onError) {
		connectionOptions.onError = onError;
	}

	const { connected } = useSSEConnection<TEvent>(connectionOptions);

	return { connected };
}
