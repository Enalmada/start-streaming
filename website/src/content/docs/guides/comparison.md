---
title: Technology Comparison
description: Detailed comparison of streaming solutions for real-time web applications
---

# Technology Comparison

This guide helps you choose the right real-time technology for your project.

## Quick Decision Tree

```
Are you using TanStack Start?
├─ Yes → Use @enalmada/start-streaming ✅
│  └─ (Native, type-safe, zero dependencies)
│
└─ No → What do you need?
   ├─ One-way updates → Use SSE
   │  ├─ Need standard protocol → better-sse
   │  └─ Need enhanced features → fetch-event-source
   │
   └─ Bi-directional → Use WebSockets
      ├─ Simple chat → Socket.IO
      └─ Advanced → ws or uWebSockets
```

## Detailed Comparison Table

| Feature | @enalmada/start-streaming | better-sse | fetch-event-source | WebSockets | Polling |
|---------|---------------------------|------------|-------------------|------------|---------|
| **Framework** | TanStack Start | Any | Any | Any | Any |
| **Type Safety** | ✅ Full end-to-end | ⚠️ Strings only | ⚠️ Strings only | ⚠️ Partial | ✅ Full |
| **Latency** | <100ms | <100ms | <100ms | <10ms | 0-2s |
| **Auto-Reconnect** | ✅ Custom (backoff+jitter) | ⚠️ Browser default | ✅ Custom | ⚠️ Manual | N/A |
| **Page Visibility** | ✅ Built-in | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **Dependencies** | 0 | 1 | 1 | 2+ | 0 |
| **React Query** | ✅ Built-in helper | ⚠️ Manual | ⚠️ Manual | ⚠️ Manual | ✅ Native |
| **Setup Complexity** | ⭐ Simple | ⭐⭐ Easy | ⭐⭐ Easy | ⭐⭐⭐ Moderate | ⭐ Trivial |
| **Direction** | One-way | One-way | One-way | Bi-directional | One-way |
| **Firewall Friendly** | ✅ Yes (HTTP) | ✅ Yes (HTTP) | ✅ Yes (HTTP) | ⚠️ Sometimes | ✅ Yes |
| **Best For** | TanStack Start | Standard SSE | Enhanced SSE | Chat/Gaming | Simple cases |

## 1. @enalmada/start-streaming

**The best choice for TanStack Start applications.**

### Strengths

✅ **Native TanStack Start integration**
- Uses `createServerFn()` with async generators
- Zero external dependencies
- Feels like native framework code

✅ **Full TypeScript type safety**
```typescript
// Server defines the type
type CommentEvent = {
  type: 'comment-added';
  commentCount: number;
};

// Client automatically knows the type
onData: (event) => {
  event.commentCount // TypeScript knows this exists!
}
```

✅ **Production-ready reconnection**
- Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (max)
- Jitter (±25%) prevents thundering herd
- Page Visibility API integration (pauses when tab hidden)

✅ **React Query integration**
```typescript
useStreamInvalidation({
  streamFn: watchComments,
  params: { discussionId },
  invalidate: (event, qc) => {
    qc.invalidateQueries(['comments', discussionId]);
  },
});
```

### Limitations

❌ **TanStack Start only**
- Won't work with Next.js, Remix, or vanilla React
- Requires TanStack Start's server function infrastructure

❌ **One-way only**
- No bi-directional communication
- For chat/gaming, use WebSockets instead

### When to use

✅ You're building with TanStack Start
✅ You need one-way server-to-client updates
✅ You want zero external dependencies
✅ You value type safety and native integration

## 2. Server-Sent Events (SSE)

### Option A: better-sse

**Best SSE library for Node.js/TypeScript.**

#### Strengths

✅ **Standard SSE protocol**
- Works with any SSE client
- Compatible with existing SSE infrastructure

✅ **Zero dependencies**
- Lightweight and focused
- TypeScript-first

✅ **Browser auto-reconnection**
- Reconnection handled by browser
- Less code to maintain

#### Example

```typescript
// Server (TanStack Start)
import { createSession } from 'better-sse';

export const GET = async ({ request }) => {
  const session = await createSession(request);

  for await (const event of events) {
    await session.push({
      event: 'update',
      data: JSON.stringify(event), // Manual serialization
    });
  }

  return session.response;
};

// Client
const eventSource = new EventSource('/api/events');
eventSource.addEventListener('update', (e) => {
  const data = JSON.parse(e.data); // Manual parsing
  // No type safety here!
});
```

#### Limitations

❌ **Text-only (strings)**
- Must manually serialize/deserialize JSON
- No TypeScript inference

❌ **Browser-controlled reconnection**
- Can't customize backoff strategy
- No jitter support
- Black box reconnection logic

### Option B: fetch-event-source

**Microsoft's enhanced EventSource with better reconnection.**

#### Strengths

✅ **Custom reconnection**
- Control over retry logic
- Better error handling

✅ **Page Visibility API**
- Pauses when tab hidden
- Battery saving

✅ **Fetch-based**
- More control than native EventSource
- Can send headers, credentials

#### Example

```typescript
import { fetchEventSource } from '@microsoft/fetch-event-source';

await fetchEventSource('/api/events', {
  onmessage(event) {
    const data = JSON.parse(event.data); // Manual parsing
  },
  onclose() {
    // Reconnection handled automatically
  },
  openWhenHidden: false, // Page visibility support
});
```

#### Limitations

❌ **Still string-based**
- No type safety
- Manual JSON parsing

❌ **Requires SSE endpoint**
- Server must implement SSE protocol
- More complex than TanStack Start streaming

### When to use SSE

✅ Need standard SSE protocol compatibility
✅ Connecting to external SSE endpoints
✅ Not using TanStack Start
✅ Want simpler browser-managed reconnection

## 3. WebSockets

**Best for bi-directional communication.**

### Strengths

✅ **Bi-directional**
- Client can send to server
- Server can send to client

✅ **Very low latency**
- <10ms possible
- Perfect for real-time interactions

✅ **Multiple protocols**
- Text and binary data
- Flexible for different use cases

### Popular Libraries

**Socket.IO** (Most popular)
```typescript
// Server
io.on('connection', (socket) => {
  socket.on('message', (data) => {
    io.emit('broadcast', data);
  });
});

// Client
const socket = io('http://localhost:3000');
socket.on('broadcast', (data) => {
  console.log(data);
});
```

**ws** (Lightweight)
```typescript
const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    ws.send('response');
  });
});
```

### Limitations

❌ **Complex setup**
- Requires WebSocket server
- More infrastructure to maintain

❌ **Firewall issues**
- Some corporate firewalls block WebSockets
- Need fallback strategy

❌ **No auto-reconnection**
- Must implement yourself
- More client-side code

### When to use WebSockets

✅ Need bi-directional communication (chat, gaming)
✅ Need very low latency (<10ms)
✅ Building collaborative features (docs, whiteboards)
✅ Real-time multiplayer games

## 4. Polling

**The simplest approach.**

### Example

```typescript
const { data } = useQuery({
  queryKey: ['comments', discussionId],
  queryFn: fetchComments,
  refetchInterval: 2000, // Poll every 2 seconds
});
```

### Strengths

✅ **Dead simple**
- Just add `refetchInterval`
- No streaming infrastructure

✅ **Works everywhere**
- No special server support
- Just HTTP requests

### Limitations

❌ **High latency**
- 0-2 second delay on average
- Can feel laggy

❌ **Inefficient**
- ~30 requests per minute
- Wastes bandwidth

❌ **Battery drain**
- Constant requests even when idle
- No page visibility integration

### When to use polling

✅ Prototyping/MVP
✅ Updates can be delayed 2-5 seconds
✅ Very low traffic
✅ Want simplest possible solution

## Real-World Use Cases

### News Feed / Social Media

**Best: @enalmada/start-streaming** (if using TanStack Start)
- Fast updates (<100ms)
- One-way communication
- Battery-efficient with page visibility

**Alternative: better-sse**
- If not using TanStack Start
- Simple implementation

### Chat Application

**Best: WebSockets (Socket.IO)**
- Bi-directional required
- Very low latency needed
- Typing indicators, presence

### Live Dashboard

**Best: @enalmada/start-streaming** (TanStack Start)
- One-way updates
- React Query integration
- Auto-reconnection

**Alternative: fetch-event-source**
- If not using TanStack Start
- Need page visibility support

### Stock Ticker / Live Scores

**Best: @enalmada/start-streaming** (TanStack Start)
- Frequent updates
- One-way
- Type-safe data

**Alternative: WebSockets**
- If need sub-10ms latency
- Very high frequency updates

### Collaborative Editing

**Best: WebSockets**
- Bi-directional required
- Operational transforms
- Presence awareness

### Notification System

**Best: @enalmada/start-streaming** (TanStack Start)
- Infrequent updates
- One-way
- Battery-efficient

**Alternative: better-sse**
- Universal compatibility
- Simple implementation

## Migration Paths

### From Polling → start-streaming

1. Remove `refetchInterval`
2. Add streaming server function
3. Add `useStreamInvalidation`
4. Enjoy 10-20x faster updates

### From SSE → start-streaming

1. Replace EventSource with server function
2. Replace event listeners with `useStreamInvalidation`
3. Get type safety for free
4. Remove JSON parsing code

### From WebSockets → start-streaming

Only if you don't need bi-directional:
1. Simplify to one-way streaming
2. Remove WebSocket server
3. Use HTTP infrastructure
4. Reduce complexity

## Performance Comparison

Based on real-world testing:

| Solution | Latency | Bandwidth | Battery Impact | Complexity |
|----------|---------|-----------|----------------|------------|
| **start-streaming** | <100ms | ~5KB/min | Low | Low |
| **better-sse** | <100ms | ~5KB/min | Medium | Low |
| **fetch-event-source** | <100ms | ~5KB/min | Low | Medium |
| **WebSockets** | <10ms | ~10KB/min | Medium | High |
| **Polling (2s)** | 0-2s | ~150KB/min | High | Very Low |

## Conclusion

Choose based on your stack and requirements:

1. **TanStack Start?** → Use `@enalmada/start-streaming` ✅
2. **Need SSE protocol?** → Use `better-sse` or `fetch-event-source`
3. **Need bi-directional?** → Use WebSockets (Socket.IO)
4. **Prototyping?** → Start with polling, upgrade later

The best technology is the one that fits your stack and requirements. Don't overthink it—start with the simplest solution that works, then optimize if needed.
