/**
 * Core types for SSE streaming
 */

import type { Channel } from "better-sse";

/**
 * Generic SSE event type
 */
export interface SSEEvent {
	type: string;
	timestamp: number;
	[key: string]: unknown;
}

/**
 * Channel manager configuration
 */
export interface ChannelManagerConfig {
	/**
	 * Prefix for channel keys (e.g., "discussion")
	 * Used in pattern: `${keyPrefix}:${resourceId}:${keySuffix}`
	 */
	keyPrefix?: string;

	/**
	 * Suffix for channel keys (e.g., "comments")
	 * Used in pattern: `${keyPrefix}:${resourceId}:${keySuffix}`
	 */
	keySuffix?: string;

	/**
	 * Optional Redis configuration for multi-server deployments
	 * If not provided, uses in-memory channels
	 */
	redis?: {
		url: string;
		token?: string;
	};
}

/**
 * Channel manager instance
 */
export interface ChannelManager<TEvent extends SSEEvent> {
	/**
	 * Get or create a channel for a specific resource
	 */
	getChannel(resourceId: string): Channel<TEvent>;

	/**
	 * Publish an event to a specific resource's channel
	 */
	publish(resourceId: string, event: TEvent): void;

	/**
	 * Get the current session count for a resource
	 */
	getSessionCount(resourceId: string): number;

	/**
	 * Clean up a channel if it has no active sessions
	 */
	cleanupIfEmpty(resourceId: string): void;
}

/**
 * Client-side SSE connection options
 */
export interface SSEConnectionOptions<TEvent extends SSEEvent> {
	/**
	 * SSE endpoint URL
	 */
	endpoint: string;

	/**
	 * Callback when event is received
	 */
	onEvent: (event: TEvent) => void;

	/**
	 * Callback when connection state changes
	 */
	onConnectionChange?: (connected: boolean) => void;

	/**
	 * Callback when error occurs
	 */
	onError?: (error: Event) => void;

	/**
	 * Whether to enable the connection
	 * @default true
	 */
	enabled?: boolean;
}

/**
 * Query invalidation options for TanStack Query integration
 */
export interface QueryInvalidationOptions<TEvent extends SSEEvent> {
	/**
	 * SSE endpoint URL
	 */
	endpoint: string;

	/**
	 * Query keys to invalidate when event is received
	 * Can be a single key, array of keys, or function that returns keys based on event
	 */
	queryKeys: unknown[] | unknown[][] | ((event: TEvent) => unknown[] | unknown[][]);

	/**
	 * Callback when connection state changes
	 */
	onConnectionChange?: (connected: boolean) => void;

	/**
	 * Callback when error occurs
	 */
	onError?: (error: Event) => void;

	/**
	 * Whether to enable the connection
	 * @default true
	 */
	enabled?: boolean;
}
