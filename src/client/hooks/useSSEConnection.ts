/**
 * Basic SSE connection hook
 *
 * Manages EventSource connection lifecycle with auto-cleanup
 */

import { useEffect, useRef, useState } from "react";
import type { SSEConnectionOptions, SSEEvent } from "../../types/index.js";

/**
 * Connect to an SSE endpoint with auto-reconnection
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { connected } = useSSEConnection({
 *     endpoint: `/api/sse/comments/${discussionId}`,
 *     onEvent: (event) => {
 *       console.log('Received event:', event);
 *     },
 *     onConnectionChange: (connected) => {
 *       console.log('Connection status:', connected);
 *     }
 *   });
 *
 *   return <div>Status: {connected ? 'Connected' : 'Disconnected'}</div>;
 * }
 * ```
 *
 * @param options - SSE connection options
 * @returns Connection state
 */
export function useSSEConnection<TEvent extends SSEEvent>(options: SSEConnectionOptions<TEvent>) {
	const { endpoint, onEvent, onConnectionChange, onError, enabled = true } = options;

	const [connected, setConnected] = useState(false);
	const eventSourceRef = useRef<EventSource | null>(null);

	// Store callbacks in refs to avoid recreating EventSource on every callback change
	const onEventRef = useRef(onEvent);
	const onConnectionChangeRef = useRef(onConnectionChange);
	const onErrorRef = useRef(onError);

	// Update refs when callbacks change
	useEffect(() => {
		onEventRef.current = onEvent;
		onConnectionChangeRef.current = onConnectionChange;
		onErrorRef.current = onError;
	}, [onEvent, onConnectionChange, onError]);

	useEffect(() => {
		// Only run on client-side
		if (typeof window === "undefined" || !enabled) return;

		// Create EventSource connection
		const eventSource = new EventSource(endpoint);
		eventSourceRef.current = eventSource;

		// Connection opened
		eventSource.onopen = () => {
			setConnected(true);
			onConnectionChangeRef.current?.(true);
		};

		// Message received
		eventSource.onmessage = (event) => {
			try {
				const parsedEvent = JSON.parse(event.data) as TEvent;
				onEventRef.current(parsedEvent);
			} catch (err) {
				console.error("Failed to parse SSE event:", err);
			}
		};

		// Error occurred (auto-reconnects)
		eventSource.onerror = (error) => {
			setConnected(false);
			onConnectionChangeRef.current?.(false);
			onErrorRef.current?.(error);
			// EventSource automatically attempts to reconnect
		};

		// Cleanup on unmount or when endpoint/enabled changes
		return () => {
			eventSource.close();
			eventSourceRef.current = null;
			setConnected(false);
		};
	}, [endpoint, enabled]);

	return { connected };
}
