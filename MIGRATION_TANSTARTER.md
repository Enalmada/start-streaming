# Migration Plan: tanstarter → @enalmada/start-streaming v2

## Project Context

**tanstarter** is the production-ready boilerplate for TanStack Start projects.
**gell-v2** uses a working better-sse implementation that has now been extracted to `@enalmada/start-streaming` v2.

## Migration Tasks

### 1. Update tanstarter Dependencies

```bash
cd C:\Users\enalm\code\open\tanstarter
bun add @enalmada/start-streaming@^2.0.0 better-sse@^0.15.0
```

### 2. Add Example SSE Implementation

Create example files in tanstarter to demonstrate SSE usage:

**Server-side: `src/server/lib/example-sse-channel.ts`**
```typescript
import { createSSEChannelManager } from '@enalmada/start-streaming/server';

export type ExampleEvent = {
  type: 'data-updated';
  resourceId: string;
  timestamp: number;
};

export const exampleChannels = createSSEChannelManager<ExampleEvent>({
  keyPrefix: 'example',
  keySuffix: 'events'
});
```

**Route: `src/routes/api/sse/example.$resourceId.ts`**
```typescript
import { createFileRoute } from '@tanstack/react-router';
import { createSSERouteHandler } from '@enalmada/start-streaming/server';
import { exampleChannels } from '~/server/lib/example-sse-channel';

export const Route = createFileRoute('/api/sse/example/$resourceId' as any)({
  server: {
    handlers: {
      GET: createSSERouteHandler({
        getChannel: (params) => exampleChannels.getChannel(params.resourceId),
        validateParams: (params) => !!params.resourceId,
        getInitialEvent: (params) => ({
          type: 'data-updated' as const,
          resourceId: params.resourceId,
          timestamp: Date.now()
        }),
        onDisconnect: (params) => {
          exampleChannels.cleanupIfEmpty(params.resourceId);
        }
      })
    }
  }
});
```

**Client: `src/components/ExampleComponent.tsx`**
```typescript
import { useSSEQueryInvalidation } from '@enalmada/start-streaming/client';

export function ExampleComponent({ resourceId }: { resourceId: string }) {
  // Auto-invalidate queries when SSE events arrive
  useSSEQueryInvalidation({
    endpoint: `/api/sse/example/${resourceId}`,
    queryKeys: [['example', resourceId]]
  });

  // Component renders normally
  // Queries auto-refetch when SSE events arrive
  return <div>Example Component</div>;
}
```

### 3. Add Documentation

Add to tanstarter's README.md:

```markdown
## Real-time Updates (SSE)

This starter includes [@enalmada/start-streaming](https://github.com/Enalmada/start-streaming) for real-time updates via Server-Sent Events.

### Quick Start

See example files:
- Server: `src/server/lib/example-sse-channel.ts`
- Route: `src/routes/api/sse/example.$resourceId.ts`
- Client: `src/components/ExampleComponent.tsx`

For full documentation, see [@enalmada/start-streaming](https://github.com/Enalmada/start-streaming).
```

### 4. Update CLAUDE.md (if applicable)

Add SSE guidance to tanstarter's development instructions:

```markdown
## Server-Sent Events (SSE)

For real-time updates, use `@enalmada/start-streaming`:

**Server:**
1. Create channel manager with `createSSEChannelManager()`
2. Create route with `createSSERouteHandler()`
3. Publish events with `channelManager.publish()`

**Client:**
1. Use `useSSEQueryInvalidation()` for TanStack Query integration
2. Or use `useSSEConnection()` for custom event handling

See example files in `src/` for implementation details.
```

## Files to Create

1. `src/server/lib/example-sse-channel.ts` - Channel manager example
2. `src/routes/api/sse/example.$resourceId.ts` - SSE route example
3. `src/components/ExampleComponent.tsx` - Client usage example
4. Update `README.md` - Add SSE section
5. Update `CLAUDE.md` (if exists) - Add SSE guidance

## Verification

After migration:
1. Build tanstarter: `bun run build`
2. Type check: `bun run check-types`
3. Verify example SSE endpoint works
4. Verify documentation is clear

## Timeline

- **Phase 1**: Update dependencies (5 min)
- **Phase 2**: Add example files (30 min)
- **Phase 3**: Update documentation (15 min)
- **Phase 4**: Test and verify (15 min)

**Total: ~1 hour**

## Notes

- This is an **additive change** - no breaking changes to existing tanstarter code
- Example files are optional - users can delete them if not needed
- SSE is now a **documented feature** of tanstarter boilerplate
- Links to full documentation in `@enalmada/start-streaming` repo

## Success Criteria

- ✅ tanstarter builds with v2 library
- ✅ Example SSE implementation works
- ✅ Documentation is clear and comprehensive
- ✅ No breaking changes to existing tanstarter projects
