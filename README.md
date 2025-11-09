# @enalmada/start-streaming

> Production-ready Server-Sent Events (SSE) for TanStack Start

[![npm version](https://badge.fury.io/js/@enalmada%2Fstart-streaming.svg)](https://www.npmjs.com/package/@enalmada/start-streaming)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why v2?

**v1** attempted a custom TanStack Start native streaming solution using async generators. While functional, it had reliability issues and didn't leverage browser-native APIs.

**v2** uses [better-sse](https://github.com/MatthewWid/better-sse) (standards-compliant SSE) with thin TanStack Start/Query wrappers. This provides:

✅ **Standards-compliant** - Uses browser-native EventSource API
✅ **Auto-reconnection** - Built into EventSource, no custom logic
✅ **Type-safe** - Full TypeScript support end-to-end
✅ **Zero lock-in** - Just better-sse + helpers, easy to customize
✅ **TanStack Query integration** - Auto-invalidate queries on events
✅ **Production-ready** - Scalable to multi-server with Redis pub/sub

## Installation

```bash
bun add @enalmada/start-streaming better-sse
# or
npm install @enalmada/start-streaming better-sse
# or
pnpm add @enalmada/start-streaming better-sse
```

## Quick Start

### 1. Define Your Event Type

```typescript
// src/server/lib/comment-events.ts
import { createSSEChannelManager } from '@enalmada/start-streaming/server';

// Define your domain-specific event type
export type CommentEvent = {
  type: 'comment-added';
  discussionId: string;
  commentCount: number;
  timestamp: number;
};

// Create channel manager
export const commentChannels = createSSEChannelManager<CommentEvent>({
  keyPrefix: 'discussion',
  keySuffix: 'comments'
});
```

### 2. Create SSE Route (Server)

```typescript
// src/routes/api/sse/comments.$discussionId.ts
import { createFileRoute } from '@tanstack/react-router';
import { createSSERouteHandler } from '@enalmada/start-streaming/server';
import { commentChannels } from '~/server/lib/comment-events';

export const Route = createFileRoute('/api/sse/comments/$discussionId' as any)({
  server: {
    handlers: {
      GET: createSSERouteHandler({
        getChannel: (params) => commentChannels.getChannel(params.discussionId),
        validateParams: (params) => !!params.discussionId,
        getInitialEvent: (params) => ({
          type: 'comment-added' as const,
          discussionId: params.discussionId,
          commentCount: 0,
          timestamp: Date.now()
        }),
        onDisconnect: (params) => {
          commentChannels.cleanupIfEmpty(params.discussionId);
        }
      })
    }
  }
});
```

### 3. Publish Events (Server)

```typescript
// src/server/services/createComments.ts
import { commentChannels } from '~/server/lib/comment-events';

export async function createComment(discussionId: string) {
  // ... create comment in database ...

  // Get updated count
  const commentCount = await getCommentCount(discussionId);

  // Publish event to all connected clients
  commentChannels.publish(discussionId, {
    type: 'comment-added',
    discussionId,
    commentCount,
    timestamp: Date.now()
  });
}
```

### 4. Connect from Client

**Option A: With TanStack Query Integration**

```typescript
// src/components/DiscussionView.tsx
import { useQueryClient } from '@tanstack/react-query';
import { useSSEQueryInvalidation } from '@enalmada/start-streaming/client';

export function DiscussionView({ discussionId }: Props) {
  // Auto-invalidate queries when events arrive
  useSSEQueryInvalidation({
    endpoint: `/api/sse/comments/${discussionId}`,
    queryKeys: [
      ['infiniteComments', discussionId],
      ['discussion', 'counts', discussionId]
    ]
  });

  // Your component renders normally
  // Queries auto-refetch when SSE events arrive
}
```

**Option B: With Custom Handler**

```typescript
import { useSSEConnection } from '@enalmada/start-streaming/client';

export function DiscussionView({ discussionId }: Props) {
  const { connected } = useSSEConnection({
    endpoint: `/api/sse/comments/${discussionId}`,
    onEvent: (event) => {
      console.log('New comment!', event);
      // Handle event however you want
    },
    onConnectionChange: (connected) => {
      console.log('SSE', connected ? 'connected' : 'disconnected');
    }
  });

  return <div>Status: {connected ? '🟢' : '🔴'}</div>;
}
```

**Option C: Dynamic Query Keys**

```typescript
useSSEQueryInvalidation({
  endpoint: `/api/sse/comments/${discussionId}`,
  // Function receives event, returns keys to invalidate
  queryKeys: (event) => [
    ['infiniteComments', event.discussionId],
    ['discussion', 'counts', event.discussionId]
  ]
});
```

## Architecture

### Channel-Based Broadcasting

```
AI generates comments
  ↓
publishEvent('discussion-123', event)
  ↓
Channel broadcasts to all sessions
  ↓
[SSE → Client 1, Client 2, Client 3, ...]
  ↓
EventSource.onmessage fires
  ↓
Query invalidation or custom handler
  ↓
UI auto-updates
```

### Memory Management

Channels are automatically cleaned up when all sessions disconnect:

```typescript
// Built-in cleanup on disconnect
onDisconnect: (params) => {
  commentChannels.cleanupIfEmpty(params.discussionId);
}
```

## Advanced Usage

### Multiple Event Types per Channel

```typescript
type DiscussionEvent =
  | { type: 'comment-added'; commentCount: number; timestamp: number }
  | { type: 'vote-changed'; votes: { yes: number; no: number }; timestamp: number }
  | { type: 'discussion-closed'; timestamp: number };

const discussionChannels = createSSEChannelManager<DiscussionEvent>({
  keyPrefix: 'discussion',
  keySuffix: 'events'
});

// Client can handle different event types
useSSEConnection({
  endpoint: `/api/sse/discussion/${id}`,
  onEvent: (event) => {
    switch (event.type) {
      case 'comment-added':
        // Handle comment
        break;
      case 'vote-changed':
        // Handle vote
        break;
      case 'discussion-closed':
        // Handle closure
        break;
    }
  }
});
```

### Conditional Connection

```typescript
// Only connect when user is authenticated
const { user } = useAuth();

useSSEQueryInvalidation({
  endpoint: `/api/sse/comments/${discussionId}`,
  queryKeys: [['comments', discussionId]],
  enabled: !!user  // Only connect if logged in
});
```

### Session Count Monitoring

```typescript
// Get active connection count for a resource
const sessionCount = commentChannels.getSessionCount('discussion-123');
console.log(`${sessionCount} users watching this discussion`);
```

## Production Deployment

### Single Server (Current Implementation)

Works out of the box with in-memory channels. Perfect for:
- Development
- Single-server deployments
- Serverless with sticky sessions

### Multi-Server (Redis Pub/Sub)

For horizontal scaling across multiple servers, you'll need to add Redis pub/sub. The channel manager is designed to make this transition easy:

**Future Implementation Pattern:**

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!
});

// In your publish function:
export function publishCommentEvent(discussionId: string, event: CommentEvent) {
  // 1. Broadcast to local in-memory channel (current server's connections)
  const channel = commentChannels.getChannel(discussionId);
  channel.broadcast(event, 'message');

  // 2. Publish to Redis (for other servers' connections)
  await redis.publish(
    `discussion:${discussionId}:comments`,
    JSON.stringify(event)
  );
}

// On each server, subscribe to Redis:
const subscriber = redis.duplicate();
await subscriber.subscribe('discussion:*:comments', (message, channel) => {
  const event = JSON.parse(message) as CommentEvent;
  const discussionId = channel.split(':')[1];

  // Broadcast to this server's local connections
  const localChannel = commentChannels.getChannel(discussionId);
  localChannel.broadcast(event, 'message');
});
```

## API Reference

### Server

#### `createSSEChannelManager<TEvent>(config)`

Creates a channel manager for broadcasting events.

**Parameters:**
- `config.keyPrefix` (optional): Prefix for channel keys (e.g., "discussion")
- `config.keySuffix` (optional): Suffix for channel keys (e.g., "comments")

**Returns:** `ChannelManager<TEvent>`

**Methods:**
- `getChannel(resourceId)`: Get or create channel for resource
- `publish(resourceId, event)`: Broadcast event to all sessions
- `getSessionCount(resourceId)`: Get active connection count
- `cleanupIfEmpty(resourceId)`: Remove channel if no sessions

#### `createSSERouteHandler(config)`

Creates an SSE route handler for TanStack Start.

**Parameters:**
- `config.getChannel(params)`: Function that returns the channel
- `config.validateParams(params)` (optional): Validate route params
- `config.getInitialEvent(params)` (optional): Send initial event on connect
- `config.onDisconnect(params)` (optional): Cleanup when client disconnects

**Returns:** Route handler function

### Client

#### `useSSEConnection(options)`

Basic SSE connection hook.

**Parameters:**
- `options.endpoint`: SSE endpoint URL
- `options.onEvent`: Callback when event received
- `options.onConnectionChange` (optional): Connection state callback
- `options.onError` (optional): Error callback
- `options.enabled` (optional): Whether to connect (default: true)

**Returns:** `{ connected: boolean }`

#### `useSSEQueryInvalidation(options)`

TanStack Query integration hook.

**Parameters:**
- `options.endpoint`: SSE endpoint URL
- `options.queryKeys`: Keys to invalidate (array or function)
- `options.onConnectionChange` (optional): Connection state callback
- `options.onError` (optional): Error callback
- `options.enabled` (optional): Whether to connect (default: true)

**Returns:** `{ connected: boolean }`

## Comparison: v1 vs v2

| Feature | v1 (Async Generators) | v2 (better-sse) |
|---------|----------------------|-----------------|
| **Protocol** | Custom NDJSON | Standards-compliant SSE |
| **Browser API** | Custom fetch stream | Native EventSource |
| **Reconnection** | Custom logic | Built into EventSource |
| **Type Safety** | ✓ | ✓ |
| **TanStack Query** | ✓ | ✓ |
| **Complexity** | High | Low |
| **Reliability** | Issues | Production-proven |
| **Bundle Size** | ~3KB | ~5KB (better-sse) |

## Why EventSource Over WebSockets?

1. **Simpler**: Unidirectional server→client (perfect for notifications)
2. **Auto-reconnects**: Built into the browser API
3. **HTTP/2 friendly**: Works over standard HTTP
4. **Firewall friendly**: Just HTTP, no special protocols
5. **Fallback ready**: Gracefully degrades

If you need bidirectional communication, use WebSockets. For server→client updates (notifications, live data), SSE is perfect.

## Examples

See the source repository for complete examples:
- Comment system with real-time updates
- Live vote counts
- Presence indicators ("5 users viewing")

## Migration from v1

v1 and v2 are **completely different architectures**. To migrate:

1. Replace async generator server functions with SSE routes
2. Replace `useStreamInvalidation` with `useSSEQueryInvalidation`
3. Update event publishing to use channel manager

See `v1-deprecated` branch for old implementation.

## Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT © [Adam Lane](https://github.com/Enalmada)

## Links

- [GitHub](https://github.com/Enalmada/start-streaming)
- [npm](https://www.npmjs.com/package/@enalmada/start-streaming)
- [better-sse](https://github.com/MatthewWid/better-sse)
- [TanStack Start](https://tanstack.com/start)
- [TanStack Query](https://tanstack.com/query)
