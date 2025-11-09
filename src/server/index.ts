/**
 * Server-side utilities for SSE streaming
 *
 * @packageDocumentation
 */

export type { ChannelManager, ChannelManagerConfig } from "../types/index.js";
export { createSSEChannelManager } from "./channel-manager.js";
export {
	createSSERouteHandler,
	type SSERouteHandlerConfig,
} from "./route-factory.js";
