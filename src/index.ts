/**
 * @enalmada/start-streaming
 *
 * Production-ready Server-Sent Events (SSE) for TanStack Start
 *
 * @packageDocumentation
 */

export {
	useSSEConnection,
	useSSEQueryInvalidation,
} from "./client/index.js";
// Root exports for convenience
// Users can also import from /server or /client subpaths
export {
	createSSEChannelManager,
	createSSERouteHandler,
} from "./server/index.js";
export type { SSERouteHandlerConfig } from "./server/route-factory.js";
// Re-export all types
export type {
	ChannelManager,
	ChannelManagerConfig,
	QueryInvalidationOptions,
	SSEConnectionOptions,
	SSEEvent,
} from "./types/index.js";
