/**
 * Client-side utilities for SSE streaming
 *
 * @packageDocumentation
 */

export type {
	QueryInvalidationOptions,
	SSEConnectionOptions,
} from "../types/index.js";
export { useSSEConnection } from "./hooks/useSSEConnection.js";
export { useSSEQueryInvalidation } from "./hooks/useSSEQueryInvalidation.js";
