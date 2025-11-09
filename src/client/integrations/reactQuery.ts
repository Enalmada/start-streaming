/**
 * React Query Integration for Streaming
 *
 * High-level helpers for integrating streaming with TanStack Query.
 * Based on TkDodo's WebSocket + React Query pattern.
 *
 * See: https://tkdodo.eu/blog/using-web-sockets-with-react-query
 */

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import {
	type UseAutoReconnectStreamOptions,
	type UseAutoReconnectStreamReturn,
	useAutoReconnectStream,
} from "../hooks/useAutoReconnectStream";

/**
 * Options for useStreamInvalidation hook
 */
export type UseStreamInvalidationOptions<TData, TEvent> = {
	// All streaming options except onData (we'll handle that ourselves)
	streamFn: UseAutoReconnectStreamOptions<TData, TEvent>["streamFn"];
	params: TData;
	enabled?: boolean;
	pauseOnHidden?: boolean;
	maxRetries?: number;
	baseDelay?: number;
	maxDelay?: number;
	shouldRetry?: (error: Error, attempt: number) => boolean;
	onConnect?: () => void;
	onDisconnect?: () => void;
	onError?: (error: Error, reconnectAttempt: number) => void;
	onMaxRetriesReached?: (error: Error) => void;
	signal?: AbortSignal;

	// Custom onData for manual handling (optional)
	onData?: (event: TEvent, meta: { reconnectAttempt: number }) => void;
	/**
	 * Called when an event is received, allowing you to invalidate specific queries
	 *
	 * @example
	 * invalidate: (event, queryClient) => {
	 *   queryClient.invalidateQueries(['comments', event.discussionId]);
	 * }
	 */
	invalidate?: (event: TEvent, queryClient: QueryClient) => void;

	/**
	 * Called when an event is received, allowing you to update cache directly
	 * This is more efficient for small updates vs full refetch
	 *
	 * @example
	 * updateCache: (event, queryClient) => {
	 *   queryClient.setQueryData(['counts', discussionId], (old) => ({
	 *     ...old,
	 *     commentCount: event.commentCount,
	 *   }));
	 * }
	 */
	updateCache?: (event: TEvent, queryClient: QueryClient) => void;
};

/**
 * High-level hook for streaming with automatic React Query integration
 *
 * Combines useAutoReconnectStream with React Query invalidation/updates.
 * Choose between invalidation (refetch) or cache updates (direct modification).
 *
 * @example
 * // Invalidate queries when events arrive (triggers refetch)
 * const stream = useStreamInvalidation({
 *   streamFn: watchAIComments,
 *   params: { discussionId: '123' },
 *   invalidate: (event, qc) => {
 *     qc.invalidateQueries(['comments', event.discussionId]);
 *   },
 * });
 *
 * @example
 * // Update cache directly (no refetch needed)
 * const stream = useStreamInvalidation({
 *   streamFn: watchAIComments,
 *   params: { discussionId: '123' },
 *   updateCache: (event, qc) => {
 *     qc.setQueryData(['counts', discussionId], (old) => ({
 *       ...old,
 *       commentCount: event.commentCount,
 *     }));
 *   },
 * });
 */
export function useStreamInvalidation<TData, TEvent>({
	invalidate,
	updateCache,
	...streamOptions
}: UseStreamInvalidationOptions<TData, TEvent>): UseAutoReconnectStreamReturn {
	// Get QueryClient - will be null during SSR if provider not available
	// This is safe because streaming only starts client-side when enabled=true
	const queryClient = useQueryClient();

	return useAutoReconnectStream({
		...streamOptions,
		onData: (event, meta) => {
			// Update cache directly if provided
			updateCache?.(event, queryClient);

			// Invalidate queries if provided
			// Note: This will only trigger refetch for active queries
			// React Query automatically handles this optimization
			invalidate?.(event, queryClient);

			// Also call custom onData if provided
			streamOptions.onData?.(event, meta);
		},
	});
}

/**
 * Pattern recommendation from TkDodo:
 *
 * When using streaming with React Query, set staleTime: Infinity on your queries.
 * Since the stream tells you exactly when to refetch, you don't need background refetching.
 *
 * @example
 * const { data } = useQuery({
 *   queryKey: ['comments', discussionId],
 *   queryFn: fetchComments,
 *   staleTime: Infinity, // Trust the stream for updates
 * });
 *
 * const stream = useStreamInvalidation({
 *   streamFn: watchAIComments,
 *   params: { discussionId },
 *   invalidate: (event, qc) => {
 *     qc.invalidateQueries(['comments', discussionId]);
 *   },
 * });
 */
