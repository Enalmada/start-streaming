/**
 * SSE Channel Manager
 *
 * Provides a type-safe channel manager for broadcasting SSE events.
 * Based on better-sse library for standards-compliant SSE implementation.
 */

import type { Channel } from "better-sse";
import { createChannel } from "better-sse";
import type { ChannelManager, ChannelManagerConfig, SSEEvent } from "../types/index.js";

/**
 * Create a channel manager for SSE broadcasting
 *
 * @example
 * ```typescript
 * // Define your event type
 * type CommentEvent = {
 *   type: 'comment-added';
 *   discussionId: string;
 *   commentCount: number;
 *   timestamp: number;
 * };
 *
 * // Create manager
 * const commentChannels = createSSEChannelManager<CommentEvent>({
 *   keyPrefix: 'discussion',
 *   keySuffix: 'comments'
 * });
 *
 * // Use it
 * commentChannels.publish('discussion-123', {
 *   type: 'comment-added',
 *   discussionId: 'discussion-123',
 *   commentCount: 42,
 *   timestamp: Date.now()
 * });
 * ```
 *
 * @param config - Channel manager configuration
 * @returns Channel manager instance
 */
export function createSSEChannelManager<TEvent extends SSEEvent>(
	config: ChannelManagerConfig = {},
): ChannelManager<TEvent> {
	const { keyPrefix = "", keySuffix = "" } = config;

	// Map of resource-specific channels
	// Key format: "{keyPrefix}:{resourceId}:{keySuffix}"
	const channels = new Map<string, Channel<TEvent>>();

	/**
	 * Build channel key from resource ID
	 */
	function buildChannelKey(resourceId: string): string {
		const parts = [keyPrefix, resourceId, keySuffix].filter(Boolean);
		return parts.join(":");
	}

	/**
	 * Get or create a channel for a specific resource
	 */
	function getChannel(resourceId: string): Channel<TEvent> {
		const channelKey = buildChannelKey(resourceId);

		let channel = channels.get(channelKey);
		if (!channel) {
			channel = createChannel<TEvent>();
			channels.set(channelKey, channel);
		}

		return channel;
	}

	/**
	 * Publish an event to a specific resource's channel
	 */
	function publish(resourceId: string, event: TEvent): void {
		const channel = getChannel(resourceId);
		channel.broadcast(event, "message");
	}

	/**
	 * Get the current session count for a resource
	 */
	function getSessionCount(resourceId: string): number {
		const channelKey = buildChannelKey(resourceId);
		const channel = channels.get(channelKey);
		return channel?.activeSessions.length ?? 0;
	}

	/**
	 * Clean up a channel if it has no active sessions
	 * Prevents memory leaks by removing empty channels from the map
	 */
	function cleanupIfEmpty(resourceId: string): void {
		const channelKey = buildChannelKey(resourceId);
		const channel = channels.get(channelKey);

		if (channel && channel.activeSessions.length === 0) {
			channels.delete(channelKey);
		}
	}

	return {
		getChannel,
		publish,
		getSessionCount,
		cleanupIfEmpty,
	};
}
