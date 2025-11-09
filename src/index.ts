/**
 * @enalmada/start-streaming
 *
 * Production-ready real-time streaming for TanStack Start with auto-reconnection,
 * exponential backoff, React Query integration, and page visibility API.
 *
 * @see https://github.com/Enalmada/start-streaming
 */

// Client exports (React hooks and integrations)
export {
	type UseAutoReconnectStreamOptions,
	type UseAutoReconnectStreamReturn,
	useAutoReconnectStream,
	usePageVisibility,
} from "./client/hooks";

export {
	type UseStreamInvalidationOptions,
	useStreamInvalidation,
} from "./client/integrations";

// Server exports (event broadcasting)
export {
	type BroadcasterConfig,
	createEventBroadcaster,
	type EventBroadcaster,
	type MemoryBroadcasterConfig,
	type RedisBroadcasterConfig,
} from "./server";
// Type exports
export type { StreamEvent } from "./types";
// Utility exports
export {
	addJitter,
	calculateBackoff,
	calculateBackoffWithJitter,
} from "./utils";
