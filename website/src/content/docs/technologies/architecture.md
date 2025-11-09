---
title: Technical Architecture
description: Deep dive into how TanStack Start streaming works under the hood
---

# Technical Architecture

This page explains the technical implementation of streaming in TanStack Start, which powers `@enalmada/start-streaming`.

## The Big Picture

TanStack Router transparently streams async generator results using **NDJSON** (Newline-Delimited JSON) format over HTTP.

```typescript
// You write this:
export const getData = createServerFn().handler(async function* () {
  yield { status: 'loading' }
  const data = await fetch()
  yield data
})

// You call this:
const result = await getData()
// result = { status: 'loading' } (first yield returned immediately)
// remaining values processed asynchronously in background
```

## Technology Stack

### 1. HTTP Transport

**Protocol:** HTTP with native `fetch()` API and `ReadableStream`

**Request Headers:**
```
GET /_serverFn/getData?payload=...
Accept: application/x-ndjson, application/json
```

**Response Headers (Streaming):**
```
HTTP/1.1 200 OK
Content-Type: application/x-ndjson
x-tss-serialized: true
```

**Response Headers (Non-Streaming):**
```
HTTP/1.1 200 OK
Content-Type: application/json
x-tss-serialized: true
```

### 2. NDJSON Format

Each yielded value becomes one JSON line:

```
{"status":"loading"}
{"id":1,"name":"Alice"}
{"id":2,"name":"Bob"}
```

Each line is a complete, valid JSON object separated by `\n`.

### 3. Serialization

**Library:** [Seroval](https://github.com/lxsmnsyc/seroval)

**Key Functions:**
- `toCrossJSONStream(value)` - Detects async generators and initiates streaming
- `fromCrossJSON(json)` - Deserializes and reconstructs JavaScript types
- `toCrossJSONAsync(error)` - Serializes errors for transmission

**Features:**
- Automatically detects async generator functions
- Preserves JavaScript types: `Date`, `Error`, `Map`, `Set`, custom classes
- Handles circular references via internal refs Map
- Extensible plugin system for custom type handling

## How It Works

### Server-Side (TanStack Router)

**File:** `packages/start-server-core/src/server-functions-handler.ts`

```typescript
// Line 201: Detection call
const { done, value } = toCrossJSONStream(result, {
  refs: new Map(),
  plugins: serovalPlugins,
  onParse(value) {
    // Called for each yielded value
    controller.enqueue(JSON.stringify(value) + '\n')  // NDJSON format!
  },
  onDone() {
    controller.close()
  },
  onError(error) {
    // Error handling
  },
})

// Line 227: Check if streaming is needed
if (!done) {
  // Line 229: Create ReadableStream for NDJSON
  const stream = new ReadableStream({
    start(controller) {
      // For each yield, onParse is called above
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' }
  })
}
```

**Key Logic:**
1. Execute server function: `result = await action(params, signal)`
2. Call `toCrossJSONStream(result)` to detect async generators
3. If `done === false`, an async generator was detected
4. Create `ReadableStream` and encode each value as NDJSON line
5. Return HTTP response with `Content-Type: application/x-ndjson`

### Client-Side (TanStack Router)

**File:** `packages/start-client-core/src/client-rpc/serverFnFetcher.ts`

```typescript
// Line 197: Content-Type detection
const contentType = response.headers.get('content-type')
const isNDJSON = contentType?.includes('application/x-ndjson')

if (isNDJSON) {
  // Line 235: Stream processing
  return processServerFnResponse(response, onMessage)
}

// Line 248: processServerFnResponse implementation
async function processServerFnResponse(response, onMessage) {
  const reader = response.body
    .pipeThrough(new TextDecoderStream())  // bytes -> text
    .getReader()

  let buffer = ''
  let firstRead = false
  let firstObject

  // Lines 254-282: Read first line SYNCHRONOUSLY
  while (!firstRead) {
    const { value, done } = await reader.read()
    if (value) buffer += value

    if (buffer.includes('\n')) {
      const lines = buffer.split('\n')
      const firstLine = lines[0]
      firstObject = JSON.parse(firstLine)
      firstRead = true
      buffer = lines.slice(1).join('\n')
    }
  }

  // Lines 285-314: Process remaining lines ASYNCHRONOUSLY (fire-and-forget!)
  ;(async () => {
    while (true) {
      const { value, done } = await reader.read()
      if (value) {
        buffer += value
        const lines = buffer.split('\n')

        for (const line of lines.slice(0, -1)) {
          if (line) {
            const parsed = JSON.parse(line)
            onMessage(parsed)
          }
        }

        buffer = lines[lines.length - 1]
      }
      if (done) break
    }
  })()

  // Return first object immediately!
  return onMessage(firstObject)
}
```

**Key Logic:**
1. Check `Content-Type` header
2. If `application/x-ndjson`, use streaming processor
3. Pipe `response.body` through `TextDecoderStream` (bytes → text)
4. Read and parse first line **synchronously**
5. Return first object to caller immediately
6. Start **fire-and-forget** async loop to process remaining lines
7. Each subsequent line triggers `onMessage()` callback

## Architecture Pattern: Fire-and-Forget

This is the key insight that makes TanStack Start streaming feel instant:

```
Caller
  |
  v
await serverFn()
  |
  v [HTTP Request]
  |
  Server returns ReadableStream with NDJSON
  |
  v [HTTP Response starts streaming]
  |
Client reads first line     <- SYNCHRONOUS
  |
  v
Parse first JSON object
  |
  v
Return to caller           <- Caller gets instant response!

Meanwhile (in background):
  Client continues reading remaining lines asynchronously
  Each line triggers onMessage() callback
```

**Benefits:**
1. **Instant response** - Caller doesn't wait for all data
2. **Progressive enhancement** - UI updates as data arrives
3. **Memory efficient** - Streaming, not buffering entire response
4. **Battery efficient** - Can pause/resume based on page visibility

## Type Safety Through Seroval

Seroval reconstructs JavaScript types automatically:

```typescript
// Server yields:
yield {
  date: new Date('2024-01-01'),
  error: new Error('Something went wrong'),
  map: new Map([['key', 'value']])
}

// Serialized as NDJSON:
{"date":"2024-01-01T00:00:00.000Z","error":"Error: Something went wrong","map":[["key","value"]]}

// Client deserializes back to actual types:
{
  date: Date object,       // instanceof Date === true
  error: Error object,     // instanceof Error === true
  map: Map object          // instanceof Map === true
}
```

This is why `@enalmada/start-streaming` has full end-to-end type safety - Seroval preserves types across the wire.

## Error Handling

Errors are caught on server, serialized with `toCrossJSONAsync()`, sent as regular JSON response (not streaming), and re-thrown on client as proper Error objects.

**Flow:**
1. Server function throws error
2. Error caught by server-functions-handler
3. Serialized: `await toCrossJSONAsync(error)`
4. Sent as `Content-Type: application/json` (not NDJSON)
5. Client deserializes and throws error
6. Your error boundary catches it

## Performance Characteristics

**Latency:**
- First value: Returned immediately (synchronous parsing)
- Subsequent values: Processed asynchronously in background
- Typical latency: <100ms from server event to client update

**Memory:**
- `ReadableStream` streams bytes, not buffered entirely in memory
- Efficient for large datasets

**Battery:**
- Page Visibility API integration pauses when tab hidden
- Reduces unnecessary network activity

**Network:**
- Single persistent HTTP connection
- ~5KB/min bandwidth (vs ~150KB/min with 2-second polling)

## Key TanStack Router Files

Understanding where the magic happens:

| File | What It Does | Key Lines |
|------|-------------|-----------|
| `packages/start-server-core/src/server-functions-handler.ts` | Server streaming detection & ReadableStream creation | 201 (detection), 229 (stream), 232 (NDJSON write) |
| `packages/start-client-core/src/client-rpc/serverFnFetcher.ts` | Client HTTP fetcher & NDJSON parsing | 235 (entry), 248 (decoder), 254-282 (first line), 285-314 (async loop) |
| `packages/start-client-core/src/constants.ts` | Header constants | X_TSS_SERIALIZED, X_TSS_RAW_RESPONSE |
| `packages/start-client-core/src/createServerFn.ts` | Server function API definition | createServerFn(), executeMiddleware() |

## Why Not EventSource/SSE?

**TanStack Start uses fetch + ReadableStream, not EventSource.**

| Feature | TanStack Start (NDJSON) | EventSource (SSE) |
|---------|-------------------------|-------------------|
| **Protocol** | HTTP with ReadableStream | Server-Sent Events protocol |
| **Format** | NDJSON (JSON per line) | text/event-stream |
| **Type Safety** | ✅ Full (Seroval) | ❌ Strings only |
| **Reconnection** | Custom (you control) | Browser-controlled (black box) |
| **Integration** | Native to TanStack Start | External API |
| **Headers** | Standard HTTP headers | SSE-specific headers |

**Advantages of TanStack Start approach:**
- Full TypeScript type inference
- More control over reconnection logic
- Cleaner async generator API
- No need for EventSource polyfills
- Works with standard HTTP debugging tools

## Debugging Tips

Add logging to see streaming in action:

```typescript
// Server side
console.log('Streaming:', done === false ? 'YES' : 'NO')

// Client side
console.log('Content-Type:', response.headers.get('content-type'))
console.log('Is NDJSON:', contentType.includes('application/x-ndjson'))
```

Use browser DevTools Network tab:
- Look for requests to `/_serverFn/*`
- Check Response headers for `content-type: application/x-ndjson`
- Response preview will show NDJSON format

## Common Questions

**Q: How does TanStack Router know if streaming is needed?**

A: `toCrossJSONStream()` from Seroval inspects the return value. If it's an async generator function, `done` is set to `false`, triggering streaming mode.

**Q: Does the caller wait for all values?**

A: No! First value returned immediately, rest processed asynchronously in background via fire-and-forget pattern.

**Q: What if there's only one yield?**

A: First value is still returned immediately, no additional processing needed. Efficient for single-value responses.

**Q: What about non-generator functions?**

A: They're detected as `done=true` and returned as regular `application/json`, no streaming.

**Q: Can I return a Response object?**

A: Yes, Response objects bypass serialization entirely (server sets `x-tss-raw` header).

## References

- [TanStack Start Streaming Documentation](https://tanstack.com/start/latest/docs/framework/react/guide/streaming-data-from-server-functions)
- [Seroval Library](https://github.com/lxsmnsyc/seroval)
- [NDJSON Specification](http://ndjson.org/)
- [ReadableStream API](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
- [TextDecoderStream API](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream)
