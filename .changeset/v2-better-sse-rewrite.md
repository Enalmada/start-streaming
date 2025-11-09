---
"@enalmada/start-streaming": major
---

v2.0.0: Complete rewrite using better-sse for standards-compliant SSE

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
