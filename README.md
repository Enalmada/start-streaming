# @enalmada/start-streaming

Production-ready real-time streaming infrastructure for TanStack Start. Type-safe async generator streaming with auto-reconnection, exponential backoff, React Query integration, and page visibility API. <100ms latency, zero runtime dependencies.

[![npm version](https://badge.fury.io/js/@enalmada%2Fstart-streaming.svg)](https://www.npmjs.com/package/@enalmada/start-streaming)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- ✅ **Auto-reconnection** with exponential backoff and jitter
- ✅ **Page Visibility API** integration (pause when tab is hidden)
- ✅ **Full TypeScript** type safety end-to-end
- ✅ **React Query** integration out of the box
- ✅ **Production-ready** error handling
- ✅ **Zero runtime dependencies** (uses TanStack Start native streaming)
- ✅ **EventEmitter** for development, **Redis** ready for production

## Installation

```bash
bun add @enalmada/start-streaming
# or
npm install @enalmada/start-streaming
# or
pnpm add @enalmada/start-streaming
```

## Quick Start

### 1. Create Event Broadcaster (Server)

```typescript
// src/server/lib/events.ts
import { createEventBroadcaster } from '@enalmada/start-streaming/server';

export const broadcaster = createEventBroadcaster({
  type: process.env.NODE_ENV === 'production' ? 'redis' : 'memory',
  // For production:
  // redis: {
  //   url: process.env.UPSTASH_REDIS_URL!,
  //   token: process.env.UPSTASH_REDIS_TOKEN!,
  // }
});

// Define your domain-specific event type
export type CommentEvent = {
  type: 'comment-added';
  discussionId: string;
  commentCount: number;
  timestamp: number;
};

// Domain-specific functions
export async function* subscribeToCommentEvents(discussionId: string) {
  const channel = `discussion:${discussionId}:comments`;
  yield* broadcaster.subscribe<CommentEvent>(channel);
}

export function publishCommentEvent(discussionId: string, commentCount: number) {
  const event: CommentEvent = {
    type: 'comment-added',
    discussionId,
    commentCount,
    timestamp: Date.now()
  };
  broadcaster.publish(`discussion:${discussionId}:comments`, event);
}
```

### 2. Create Server Function (Server)

```typescript
// src/server/functions/watchComments.ts
import { createServerFn } from '@tanstack/react-start';
import { subscribeToCommentEvents } from '../lib/events';

function validateInput(data: unknown): { discussionId: string } {
  if (!data || typeof data !== 'object') throw new Error('Invalid input');
  const { discussionId } = data as Record<string, unknown>;
  if (typeof discussionId !== 'string') throw new Error('discussionId required');
  return { discussionId };
}

async function* handleWatchComments({ data }: { data: { discussionId: string } }) {
  const subscription = subscribeToCommentEvents(data.discussionId);
  for await (const event of subscription) {
    yield event;
  }
}

export const watchComments = createServerFn({ method: 'POST' })
  .inputValidator(validateInput)
  .handler(handleWatchComments);
```

### 3. Use in Component (Client)

```typescript
// src/components/DiscussionView.tsx
import { useStreamInvalidation } from '@enalmada/start-streaming/client';
import { watchComments } from '~/server/functions/watchComments';

export function DiscussionView({ discussionId }) {
  const queryClient = useQueryClient();

  // Set up real-time streaming
  useStreamInvalidation({
    streamFn: (params) => watchComments({ data: params }),
    params: { discussionId },
    pauseOnHidden: true, // Save battery when tab is hidden

    // Invalidate queries when new events arrive
    invalidate: async (event, qc) => {
      await qc.invalidateQueries({ queryKey: ['comments', discussionId] });
      await qc.invalidateQueries({ queryKey: ['counts', discussionId] });
    },

    maxRetries: 10,
    baseDelay: 1000,
    maxDelay: 30000,
  });

  // Your component JSX...
}
```

### 4. Publish Events (Server)

```typescript
// Wherever you create comments
import { publishCommentEvent } from '~/server/lib/events';

async function createComment(discussionId: string, content: string) {
  // Save comment to database
  await db.insert(comments).values({ discussionId, content });

  // Get updated count
  const count = await db.select({ count: count() })
    .from(comments)
    .where(eq(comments.discussionId, discussionId));

  // Publish event to all subscribers
  publishCommentEvent(discussionId, count[0].count);
}
```

## Documentation

Full documentation available at: https://start-streaming.vercel.app

### Key Concepts

- [Getting Started](https://start-streaming.vercel.app/guides/getting-started)
- [Technology Comparison](https://start-streaming.vercel.app/guides/comparison) - When to use this vs alternatives
- [Technical Architecture](https://start-streaming.vercel.app/technologies/architecture) - How it works under the hood
- [React Query Integration](https://start-streaming.vercel.app/guides/react-query)
- [Event Broadcasting](https://start-streaming.vercel.app/guides/event-broadcasting)
- [Production Deployment](https://start-streaming.vercel.app/guides/production)

## API Overview

### Client Exports

```typescript
import {
  // Hooks
  useAutoReconnectStream,
  useStreamInvalidation,
  usePageVisibility,

  // Types
  UseAutoReconnectStreamOptions,
  UseAutoReconnectStreamReturn,
  UseStreamInvalidationOptions,
} from '@enalmada/start-streaming/client';
```

### Server Exports

```typescript
import {
  // Factory
  createEventBroadcaster,

  // Types
  EventBroadcaster,
  BroadcasterConfig,
  MemoryBroadcasterConfig,
  RedisBroadcasterConfig,
} from '@enalmada/start-streaming/server';
```

### Utility Exports

```typescript
import {
  calculateBackoff,
  addJitter,
  calculateBackoffWithJitter,
} from '@enalmada/start-streaming/utils';
```

## Architecture

```
┌─────────────────────────────────────────┐
│     Client Component                     │
│  (useStreamInvalidation hook)            │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│     TanStack Server Function             │
│  (watchComments - async generator)      │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│     Event Broadcasting                   │
│  (EventEmitter / Redis Pub/Sub)          │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│     Your Service Layer                   │
│  (publishes events on data changes)      │
└─────────────────────────────────────────┘
```

## Features in Detail

### Auto-Reconnection

Automatically reconnects with exponential backoff and jitter to prevent thundering herd:

- Attempt 0: ~1s delay
- Attempt 1: ~2s delay
- Attempt 2: ~4s delay
- Max: 30s delay (configurable)

Jitter (±25%) prevents all clients from reconnecting simultaneously.

### Page Visibility Integration

Automatically pauses streaming when the browser tab is hidden and resumes when visible:

- Saves battery on mobile devices
- Reduces server load
- Improves performance

### Connection State

```typescript
const stream = useStreamInvalidation({...});

stream.isConnected      // boolean
stream.isReconnecting   // boolean
stream.reconnectAttempt // number
stream.error            // Error | null
stream.reconnect()      // Manual reconnect function
```

### Type Safety

Full end-to-end type safety from server to client. Your event types are inferred automatically.

## Production Deployment

### Redis Setup (Multi-Server)

For production deployments with multiple servers, switch to Redis:

```typescript
// Install Redis client
bun add @upstash/redis

// Configure broadcaster
import { createEventBroadcaster } from '@enalmada/start-streaming/server';

export const broadcaster = createEventBroadcaster({
  type: 'redis',
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});
```

Get free Redis from [Upstash](https://upstash.com/).

## Performance

- **Latency**: <100ms from server event to client update (vs 0-2s with polling)
- **Efficiency**: 1 persistent connection vs ~30 requests/minute with polling
- **Battery**: Page Visibility API integration saves battery when tab is hidden

## When to Use This vs Alternatives

### ✅ Use `@enalmada/start-streaming` if:

- You're building with **TanStack Start**
- You want **full type safety** end-to-end (server to client)
- You need **custom reconnection logic** (exponential backoff, jitter)
- You want **zero external dependencies**
- You prefer **native stack integration** over external libraries

### ❌ Consider alternatives if:

- **Not using TanStack Start** → Use SSE libraries or WebSockets
- **Need bi-directional communication** → Use WebSockets
- **Need standard SSE protocol** for third-party compatibility → Use `better-sse`

## Comparison with Other Solutions

| Feature | @enalmada/start-streaming | SSE (better-sse) | fetch-event-source | WebSockets |
|---------|---------------------------|------------------|-------------------|------------|
| **Type Safety** | ✅ Full end-to-end | ⚠️ Strings only | ⚠️ Strings only | ⚠️ Partial |
| **TanStack Integration** | ✅ Native | ⚠️ External lib | ⚠️ External lib | ❌ Complex |
| **Auto-Reconnect** | ✅ Custom (backoff+jitter) | ⚠️ Browser default | ✅ Custom | ⚠️ Manual |
| **Page Visibility** | ✅ Built-in | ❌ No | ✅ Yes | ❌ No |
| **Dependencies** | ✅ Zero | ⚠️ 1 package | ⚠️ 1 package | ⚠️ Multiple |
| **React Query Integration** | ✅ Built-in helper | ⚠️ Manual | ⚠️ Manual | ⚠️ Manual |
| **Direction** | One-way | One-way | One-way | Bi-directional |
| **Best For** | TanStack Start | Standard SSE | Enhanced SSE | Chat, gaming |

### vs Server-Sent Events (SSE)

**SSE with `better-sse`** is a solid choice if you need the standard SSE protocol:

**When to use SSE instead:**
- You need compatibility with existing SSE infrastructure
- You're not using TanStack Start
- You want browser-managed reconnection (less control, but simpler)

**Why start-streaming is better for TanStack Start:**
- ✅ **Type-safe**: Events are fully typed, not strings
- ✅ **Custom reconnection**: Full control with exponential backoff and jitter
- ✅ **Zero dependencies**: No external libraries needed
- ✅ **React Query integration**: Built-in `useStreamInvalidation` hook
- ✅ **Page visibility**: Automatically pauses when tab is hidden

### vs fetch-event-source

Microsoft's `fetch-event-source` enhances the native EventSource API with better reconnection and page visibility support.

**We learned from fetch-event-source:**
- Page Visibility API integration (battery saving)
- Custom reconnection logic
- Exponential backoff patterns

**Why start-streaming is better:**
- ✅ **TanStack Start native**: No need for EventSource at all
- ✅ **Type-safe**: Full TypeScript from server to client
- ✅ **React Query integration**: Built-in helpers
- ✅ **Zero dependencies**: Everything included

**When to use fetch-event-source instead:**
- You need to connect to external SSE endpoints you don't control
- You're not using TanStack Start

### vs WebSockets

WebSockets are excellent for **bi-directional** communication (chat, gaming, collaborative editing).

**When to use WebSockets instead:**
- You need **bi-directional** real-time communication
- You need very low latency (<10ms)
- You're building chat, gaming, or collaborative features

**Why start-streaming is better for one-way updates:**
- ✅ **Simpler**: No WebSocket server setup needed
- ✅ **HTTP-based**: Works through corporate firewalls
- ✅ **Less overhead**: No WebSocket handshake
- ✅ **Type-safe**: Built into TanStack Start
- ✅ **Easier to debug**: Standard HTTP tools work

### vs Polling

**When polling is acceptable:**
- Updates can be delayed 2-5 seconds
- Very simple to implement
- You don't want any streaming infrastructure

**Why start-streaming is better:**
- ✅ **10-20x faster**: <100ms vs 0-2s latency
- ✅ **More efficient**: 1 connection vs ~30 requests/minute
- ✅ **Better UX**: Instant updates feel more responsive

## Technical Details: How It Works Under The Hood

This library uses **TanStack Start's native async generator streaming**, not EventSource or Server-Sent Events (SSE).

### The Technology Stack

**HTTP Transport:**
- Native `fetch()` API with `ReadableStream`
- NDJSON format (Newline-Delimited JSON): each line is a complete JSON object separated by `\n`
- Headers: `Accept: application/x-ndjson, application/json`
- Content-Type: `application/x-ndjson` for streaming responses

**Serialization:**
- [Seroval](https://github.com/lxsmnsyc/seroval) library handles type detection and serialization
- Automatically detects async generators via `toCrossJSONStream()`
- Preserves JavaScript types (Date, Error, Map, Set) across the wire
- Handles circular references

**Architecture Pattern:**
- **Fire-and-forget**: First NDJSON line returned synchronously, remaining lines processed asynchronously in background
- Server creates `ReadableStream` when async generator detected
- Client uses `TextDecoderStream` to convert bytes to text
- Each line parsed as separate JSON object and deserialized

### Example Flow

```typescript
// 1. You write this server function:
export const getData = createServerFn().handler(async function* () {
  yield { status: 'loading' }
  const data = await fetch()
  yield data
})

// 2. TanStack Router detects async generator and creates ReadableStream
// 3. Each yield becomes one NDJSON line:
//    {"status":"loading"}\n
//    {"id":1,"name":"Alice"}\n

// 4. Client calls function:
const result = await getData()
// result = { status: 'loading' } (first yield returned immediately)
// remaining values processed asynchronously in background
```

### Why This Matters

- ✅ **Type-safe events**: Your event types are inferred automatically (Seroval preserves types)
- ✅ **Better integration**: Native to TanStack Start ecosystem
- ✅ **More control**: Custom reconnection, error handling, retry logic
- ✅ **Cleaner API**: Async generators are more modern than EventSource listeners
- ✅ **Better performance**: Fire-and-forget pattern means instant first response

### Key Differences from SSE

| Feature | start-streaming (NDJSON) | Server-Sent Events (SSE) |
|---------|--------------------------|--------------------------|
| Protocol | HTTP with ReadableStream | SSE protocol |
| Format | NDJSON (JSON per line) | text/event-stream |
| Type Safety | ✅ Full (Seroval) | ❌ Strings only |
| Library | Native to TanStack Start | Requires EventSource API |
| Reconnection | Custom (you control) | Browser-controlled |

**References:**
- [TanStack Start Streaming Docs](https://tanstack.com/start/latest/docs/framework/react/guide/streaming-data-from-server-functions)
- [Seroval Library](https://github.com/lxsmnsyc/seroval) - Serialization powering the type safety
- [TanStack Query + WebSockets Pattern](https://tkdodo.eu/blog/using-web-sockets-with-react-query) - Inspiration for React Query integration
- [NDJSON Specification](http://ndjson.org/) - Data format used for streaming

## License

MIT © [Adam Lane](https://github.com/Enalmada)

## Contributing

Contributions welcome! Please read the [contributing guidelines](CONTRIBUTING.md) first.

## Support

- [Documentation](https://start-streaming.vercel.app)
- [GitHub Issues](https://github.com/Enalmada/start-streaming/issues)
- [Discussions](https://github.com/Enalmada/start-streaming/discussions)
