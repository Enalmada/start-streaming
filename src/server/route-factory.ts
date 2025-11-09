/**
 * SSE Route Factory
 *
 * Helper to create type-safe SSE route handlers for TanStack Start
 */

import type { Channel } from "better-sse";
import { createResponse } from "better-sse";
import type { SSEEvent } from "../types/index.js";

/**
 * Configuration for SSE route handler
 */
export interface SSERouteHandlerConfig<TParams extends Record<string, unknown>, TEvent extends SSEEvent> {
	/**
	 * Get the channel for this connection
	 */
	getChannel: (params: TParams) => Channel<TEvent>;

	/**
	 * Validate route parameters
	 * Should throw or return false if invalid
	 */
	validateParams?: (params: TParams) => boolean;

	/**
	 * Get initial event to send on connection
	 * Optional - if not provided, no initial event is sent
	 */
	getInitialEvent?: (params: TParams) => TEvent;

	/**
	 * Cleanup callback when session disconnects
	 */
	onDisconnect?: (params: TParams) => void;
}

/**
 * Create a type-safe SSE route handler for TanStack Start
 *
 * @example
 * ```typescript
 * // src/routes/api/sse/comments.$discussionId.ts
 * import { createFileRoute } from '@tanstack/react-router';
 * import { createSSERouteHandler } from '@enalmada/start-streaming/server';
 *
 * export const Route = createFileRoute('/api/sse/comments/$discussionId' as any)({
 *   server: {
 *     handlers: {
 *       GET: createSSERouteHandler({
 *         getChannel: (params) => commentChannels.getChannel(params.discussionId),
 *         validateParams: (params) => !!params.discussionId,
 *         getInitialEvent: (params) => ({
 *           type: 'comment-added' as const,
 *           discussionId: params.discussionId,
 *           commentCount: 0,
 *           timestamp: Date.now()
 *         }),
 *         onDisconnect: (params) => {
 *           commentChannels.cleanupIfEmpty(params.discussionId)
 *         }
 *       })
 *     }
 *   }
 * });
 * ```
 *
 * @param config - SSE route handler configuration
 * @returns Request handler function
 */
export function createSSERouteHandler<TParams extends Record<string, unknown>, TEvent extends SSEEvent>(
	config: SSERouteHandlerConfig<TParams, TEvent>,
) {
	const { getChannel, validateParams, getInitialEvent, onDisconnect } = config;

	return async ({ request, params }: { request: Request; params: TParams }) => {
		try {
			// Validate parameters if validator provided
			if (validateParams && !validateParams(params)) {
				return new Response("Invalid parameters", {
					status: 400,
				});
			}

			// Create SSE response using better-sse's Fetch API helper
			return createResponse(request, (session) => {
				// Get the channel for this connection
				const channel = getChannel(params);

				// Register session to the channel
				// All events sent to the channel will be forwarded to this session
				channel.register(session);

				// Send initial event if configured
				if (getInitialEvent) {
					const initialEvent = getInitialEvent(params);
					session.push(initialEvent, "message");
				}

				// Handle cleanup when client disconnects
				session.once("disconnected", () => {
					channel.deregister(session);

					// Call custom disconnect handler if provided
					if (onDisconnect) {
						onDisconnect(params);
					}
				});
			});
		} catch (error) {
			return new Response(
				`Failed to establish SSE connection: ${error instanceof Error ? error.message : String(error)}`,
				{
					status: 500,
				},
			);
		}
	};
}
