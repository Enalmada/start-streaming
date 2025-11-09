# Changelog

## 2.0.0

### Major Changes

- e16e768: v2.0.0: Complete rewrite using better-sse for standards-compliant SSE

  **Breaking Changes:**

  - Completely new architecture based on better-sse instead of async generators
  - `useStreamInvalidation` → `useSSEQueryInvalidation` (renamed hook)
  - `createServerFn()` approach replaced with SSE route handlers
  - Requires better-sse as peer dependency: `bun add better-sse`
  - Server implementation now uses `createSSERouteHandler` and channel managers
  - Different event publishing pattern (channel-based broadcasting)

  **New Features:**

  - Standards-compliant Server-Sent Events (EventSource API)
  - Built-in auto-reconnection via browser EventSource
  - Channel-based broadcasting for efficient multi-client updates
  - SSR-safe hooks with client-side checks
  - beforeunload cleanup to reduce console noise during page reloads
  - Memory management with automatic channel cleanup
  - Production-ready for multi-server deployment (Redis pub/sub ready)

  **Migration Required:**

  See README.md for complete migration guide from v1 to v2. The two versions are architecturally incompatible and require code changes.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-11-09

### 🎉 Major Rewrite

Complete architectural redesign from custom async generators to standards-compliant Server-Sent Events (SSE).

### Added

- **better-sse integration** - Standards-compliant SSE implementation
- **`createSSEChannelManager()`** - Type-safe channel-based broadcasting
- **`createSSERouteHandler()`** - Helper for creating SSE route handlers
- **`useSSEConnection()`** - Basic SSE connection hook
- **`useSSEQueryInvalidation()`** - TanStack Query integration hook
- **Automatic memory cleanup** - Channels removed when all sessions disconnect
- **Dynamic query keys** - Support for event-driven query key selection
- **Conditional connections** - `enabled` prop to control connection lifecycle

### Changed

- **BREAKING**: Replaced async generator API with EventSource-based API
- **BREAKING**: Changed from NDJSON streaming to SSE protocol
- **BREAKING**: New function names and signatures throughout
- **BREAKING**: Requires `better-sse` as peer dependency

### Removed

- **BREAKING**: Removed v1 async generator infrastructure
- **BREAKING**: Removed `useStreamInvalidation` (replaced with `useSSEQueryInvalidation`)
- **BREAKING**: Removed `createEventBroadcaster` (replaced with `createSSEChannelManager`)

### Why v2?

**v1** used custom async generators with NDJSON streaming. While functional, it had reliability issues and required custom reconnection logic.

**v2** uses browser-native EventSource API with better-sse backend. Benefits:

- ✅ Standards-compliant SSE protocol
- ✅ Auto-reconnection built into EventSource
- ✅ Production-proven reliability
- ✅ Simpler implementation
- ✅ Better TypeScript support
- ✅ Lower complexity

### Migration Guide

v1 and v2 are completely different architectures. To migrate:

1. **Server-side:**

   ```typescript
   // v1
   export const broadcaster = createEventBroadcaster({ ... });

   // v2
   export const commentChannels = createSSEChannelManager<CommentEvent>({ ... });
   ```

2. **Routes:**

   ```typescript
   // v1 - Async generator server function
   export const watchComments = createServerFn({ method: "POST" }).handler(
     async function* ({ data }) {
       for await (const event of subscribeToComments(data.id)) {
         yield event;
       }
     }
   );

   // v2 - SSE route handler
   export const Route = createFileRoute("/api/sse/comments/$id" as any)({
     server: {
       handlers: {
         GET: createSSERouteHandler({
           getChannel: (params) => commentChannels.getChannel(params.id),
         }),
       },
     },
   });
   ```

3. **Client-side:**

   ```typescript
   // v1
   useStreamInvalidation({
     serverFn: watchComments,
     input: { id: discussionId },
     queryKeys: [["comments", discussionId]],
   });

   // v2
   useSSEQueryInvalidation({
     endpoint: `/api/sse/comments/${discussionId}`,
     queryKeys: [["comments", discussionId]],
   });
   ```

For v1 reference, see the `v1-deprecated` branch.

## [1.0.0] - 2024-11-08

### Added

- Initial release with async generator streaming
- `createEventBroadcaster()` for event management
- `useStreamInvalidation()` for TanStack Query integration
- In-memory and Redis pub/sub support
- Page visibility API integration
- Exponential backoff reconnection

**Note:** v1 is deprecated. Please use v2 for new projects.
