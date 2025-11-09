/**
 * Streaming types
 *
 * Centralized TypeScript types for the streaming system
 */

/**
 * Base type for stream events
 *
 * @example
 * type CommentEvent = StreamEvent<"comment-added"> & {
 *   discussionId: string;
 *   commentCount: number;
 * };
 */
export type StreamEvent<T extends string = string> = {
	type: T;
	timestamp: number;
};

// Re-export types from hooks for convenience
export type {
	UseAutoReconnectStreamOptions,
	UseAutoReconnectStreamReturn,
} from "../client/hooks/useAutoReconnectStream";

export type { UseStreamInvalidationOptions } from "../client/integrations/reactQuery";
