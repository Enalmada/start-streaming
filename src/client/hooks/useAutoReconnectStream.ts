/**
 * Auto-Reconnecting Stream Hook
 *
 * Production-ready hook for TanStack Start async generator streaming with:
 * - Automatic reconnection with exponential backoff and jitter
 * - Page Visibility API integration (pause when tab hidden)
 * - Full TypeScript type safety
 * - Connection state management
 * - Custom retry logic
 * - Proper cleanup
 *
 * Based on patterns from:
 * - TkDodo's React Query + WebSocket integration
 * - Microsoft's fetch-event-source
 * - Industry best practices for streaming
 */

import { useEffect, useRef, useState } from "react";
import { calculateBackoffWithJitter } from "../../utils/jitter";
import { usePageVisibility } from "./usePageVisibility";

/**
 * Options for useAutoReconnectStream hook
 */
export type UseAutoReconnectStreamOptions<TData, TEvent> = {
	/** The server function that returns an async generator (or a promise that resolves to one) */
	streamFn: (params: TData) => AsyncGenerator<TEvent> | Promise<AsyncGenerator<TEvent>>;

	/** Parameters to pass to the stream function */
	params: TData;

	/** Called when a new event is received */
	onData: (event: TEvent, meta: { reconnectAttempt: number }) => void;

	/** Called when successfully connected */
	onConnect?: () => void;

	/** Called when disconnected (before retry) */
	onDisconnect?: () => void;

	/** Called when an error occurs (before retry) */
	onError?: (error: Error, reconnectAttempt: number) => void;

	/** Called when max retries are exhausted */
	onMaxRetriesReached?: (error: Error) => void;

	/** Maximum number of reconnection attempts (default: Infinity) */
	maxRetries?: number;

	/** Base delay for exponential backoff in ms (default: 1000) */
	baseDelay?: number;

	/** Maximum delay between retries in ms (default: 30000) */
	maxDelay?: number;

	/** Whether to enable the stream (default: true) */
	enabled?: boolean;

	/** Pause streaming when browser tab is hidden (default: true) */
	pauseOnHidden?: boolean;

	/** Custom retry logic - return false to stop retrying */
	shouldRetry?: (error: Error, attempt: number) => boolean;

	/** External abort signal */
	signal?: AbortSignal;
};

/**
 * Return value from useAutoReconnectStream
 */
export type UseAutoReconnectStreamReturn = {
	/** Whether currently connected to stream */
	isConnected: boolean;

	/** Whether currently attempting to reconnect */
	isReconnecting: boolean;

	/** Current reconnection attempt number (0 = first connection) */
	reconnectAttempt: number;

	/** Last error that occurred (null if no error) */
	error: Error | null;

	/** Manually trigger a reconnection (resets attempt counter) */
	reconnect: () => void;
};

/**
 * Hook for auto-reconnecting streaming with TanStack Start async generators
 *
 * @example
 * const stream = useAutoReconnectStream({
 *   streamFn: (params) => watchAIComments({ data: params }),
 *   params: { discussionId: '123' },
 *   onData: (update) => {
 *     console.log('New comment!', update);
 *   },
 *   onError: (error, attempt) => {
 *     console.error(`Connection error (attempt ${attempt}):`, error);
 *   },
 * });
 *
 * // Show connection status in UI
 * {stream.isReconnecting && <Banner>Reconnecting...</Banner>}
 */
export function useAutoReconnectStream<TData, TEvent>({
	streamFn,
	params,
	onData,
	onConnect,
	onDisconnect,
	onError,
	onMaxRetriesReached,
	maxRetries = Infinity,
	baseDelay = 1000,
	maxDelay = 30000,
	enabled = true,
	pauseOnHidden = true,
	shouldRetry,
	signal: externalSignal,
}: UseAutoReconnectStreamOptions<TData, TEvent>): UseAutoReconnectStreamReturn {
	const [isConnected, setIsConnected] = useState(false);
	const [isReconnecting, setIsReconnecting] = useState(false);
	const [reconnectAttempt, setReconnectAttempt] = useState(0);
	const [error, setError] = useState<Error | null>(null);

	const abortControllerRef = useRef<AbortController | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const currentAttemptRef = useRef(0);

	const isVisible = usePageVisibility();

	// Should we be streaming right now?
	const shouldStream = enabled && (!pauseOnHidden || isVisible);

	useEffect(() => {
		let isMounted = true;

		const connectToStream = async () => {
			// Don't connect if disabled or paused
			if (!shouldStream) {
				return;
			}

			// Create new abort controller for this connection
			abortControllerRef.current = new AbortController();

			// Also listen to external abort signal
			const combinedSignal = externalSignal
				? AbortSignal.any([abortControllerRef.current.signal, externalSignal])
				: abortControllerRef.current.signal;

			try {
				setIsConnected(false);
				setError(null);

				// Start streaming (handle both direct generators and promises)
				const streamResult = streamFn(params);
				const stream = streamResult instanceof Promise ? await streamResult : streamResult;

				setIsConnected(true);
				setIsReconnecting(false);
				setReconnectAttempt(currentAttemptRef.current);
				onConnect?.();

				// Consume the stream
				for await (const event of stream) {
					// Check if we should still be consuming
					if (!isMounted || combinedSignal.aborted) {
						break;
					}

					onData(event, { reconnectAttempt: currentAttemptRef.current });
				}

				// Stream ended gracefully (server closed connection)
				// This is normal for some streams, try to reconnect
				if (isMounted && !combinedSignal.aborted && shouldStream) {
					setIsConnected(false);
					onDisconnect?.();
					scheduleReconnect();
				}
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));

				// Don't handle errors if we've unmounted or been aborted
				if (!isMounted || combinedSignal.aborted) {
					return;
				}

				setError(error);
				setIsConnected(false);
				onDisconnect?.();
				onError?.(error, currentAttemptRef.current);

				// Check if we should retry
				const customShouldRetry = shouldRetry?.(error, currentAttemptRef.current) ?? true;
				const belowMaxRetries = currentAttemptRef.current < maxRetries;

				if (customShouldRetry && belowMaxRetries && shouldStream) {
					scheduleReconnect();
				} else if (!belowMaxRetries) {
					// Max retries reached
					onMaxRetriesReached?.(error);
				}
			}
		};

		const scheduleReconnect = () => {
			setIsReconnecting(true);
			currentAttemptRef.current++;

			const delay = calculateBackoffWithJitter({
				attempt: currentAttemptRef.current,
				baseDelay,
				maxDelay,
				jitterPercent: 0.25, // ±25% jitter
			});

			reconnectTimeoutRef.current = setTimeout(() => {
				if (isMounted && shouldStream) {
					connectToStream();
				}
			}, delay);
		};

		// Initial connection
		if (shouldStream) {
			connectToStream();
		} else {
			// If we shouldn't be streaming, clean up any active connection
			setIsConnected(false);
			setIsReconnecting(false);
			abortControllerRef.current?.abort();
		}

		// Cleanup
		return () => {
			isMounted = false;

			// Abort current stream
			abortControllerRef.current?.abort();

			// Cancel pending reconnection
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
		};
	}, [
		shouldStream,
		baseDelay,
		externalSignal,
		maxDelay,
		maxRetries,
		onConnect,
		onData,
		onDisconnect,
		onError,
		onMaxRetriesReached,
		params,
		shouldRetry,
		streamFn,
	]);

	// Manual reconnect function
	const reconnect = () => {
		// Abort current connection
		abortControllerRef.current?.abort();

		// Cancel pending reconnection
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
		}

		// Reset attempt counter
		currentAttemptRef.current = 0;
		setReconnectAttempt(0);
		setError(null);

		// Effect will restart automatically due to dependencies
	};

	return {
		isConnected,
		isReconnecting,
		reconnectAttempt,
		error,
		reconnect,
	};
}
