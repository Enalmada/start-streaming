/**
 * Event Broadcasting System
 *
 * Generic factory for creating event broadcasters.
 * Supports both in-memory EventEmitter (development/single-server)
 * and Redis Pub/Sub (production/multi-server).
 *
 * This is framework-agnostic server code that can be used with any Node.js application.
 */

import { EventEmitter } from "node:events";

/**
 * Event broadcaster instance interface
 */
export interface EventBroadcaster {
	/**
	 * Subscribe to events on a channel
	 * Returns an async generator that yields events as they occur
	 */
	subscribe<T>(channel: string): AsyncGenerator<T>;

	/**
	 * Publish an event to a channel
	 */
	publish(channel: string, data: unknown): void | Promise<void>;

	/**
	 * Get current listener count for a channel (for debugging)
	 */
	getListenerCount(channel: string): number;
}

/**
 * Configuration for EventEmitter-based broadcaster
 */
export type MemoryBroadcasterConfig = {
	type: "memory";
	maxListeners?: number;
};

/**
 * Configuration for Redis-based broadcaster
 */
export type RedisBroadcasterConfig = {
	type: "redis";
	url: string;
	token: string;
};

/**
 * Broadcaster configuration
 */
export type BroadcasterConfig = MemoryBroadcasterConfig | RedisBroadcasterConfig;

/**
 * Create an in-memory event broadcaster using Node.js EventEmitter
 *
 * Good for:
 * - Development
 * - Single-server deployments
 * - Testing
 *
 * Not suitable for:
 * - Multi-server production deployments (events don't cross server boundaries)
 */
function createMemoryBroadcaster(config: MemoryBroadcasterConfig): EventBroadcaster {
	const emitter = new EventEmitter();

	// Increase max listeners for channels with many active connections
	emitter.setMaxListeners(config.maxListeners ?? 100);

	return {
		async *subscribe<T>(channel: string): AsyncGenerator<T> {
			const queue: T[] = [];
			let resolveNext: (() => void) | null = null;

			// Listener pushes events to queue and resolves pending promise
			const listener = (data: T) => {
				queue.push(data);
				if (resolveNext) {
					resolveNext();
					resolveNext = null;
				}
			};

			emitter.on(channel, listener);

			try {
				while (true) {
					// If queue has events, yield them
					if (queue.length > 0) {
						const event = queue.shift();
						if (event) {
							yield event;
						}
					} else {
						// Wait for next event
						await new Promise<void>((resolve) => {
							resolveNext = resolve;
							// Timeout to prevent hanging forever
							setTimeout(resolve, 30000); // 30s keep-alive
						});
					}
				}
			} finally {
				// Cleanup listener when generator is closed
				emitter.off(channel, listener);
			}
		},

		publish(channel: string, data: unknown): void {
			emitter.emit(channel, data);
		},

		getListenerCount(channel: string): number {
			return emitter.listenerCount(channel);
		},
	};
}

/**
 * Create a Redis-based event broadcaster using Upstash Redis
 *
 * Good for:
 * - Multi-server production deployments
 * - Distributed systems
 * - High availability setups
 *
 * Requires:
 * - `@upstash/redis` package installed
 * - Redis URL and token from Upstash (or compatible Redis provider)
 *
 * @example
 * // Install: bun add @upstash/redis
 * const broadcaster = createEventBroadcaster({
 *   type: 'redis',
 *   url: process.env.UPSTASH_REDIS_URL!,
 *   token: process.env.UPSTASH_REDIS_TOKEN!,
 * });
 */
function createRedisBroadcaster(_config: RedisBroadcasterConfig): EventBroadcaster {
	// Note: This is intentionally not importing @upstash/redis here
	// to keep it as an optional peer dependency
	throw new Error(
		"Redis broadcaster not yet implemented. Install @upstash/redis and implement using the pattern from the documentation.",
	);

	// Implementation guide (for reference):
	// import { Redis } from '@upstash/redis';
	//
	// const redis = new Redis({
	//   url: config.url,
	//   token: config.token,
	// });
	//
	// return {
	//   async *subscribe<T>(channel: string): AsyncGenerator<T> {
	//     const subscriber = redis.duplicate();
	//     await subscriber.subscribe(channel);
	//
	//     try {
	//       for await (const message of subscriber.messagesIterator()) {
	//         yield JSON.parse(message) as T;
	//       }
	//     } finally {
	//       await subscriber.unsubscribe(channel);
	//     }
	//   },
	//
	//   async publish(channel: string, data: unknown): Promise<void> {
	//     await redis.publish(channel, JSON.stringify(data));
	//   },
	//
	//   getListenerCount(channel: string): number {
	//     // Redis doesn't expose listener count easily
	//     return 0;
	//   },
	// };
}

/**
 * Create an event broadcaster instance
 *
 * @example
 * // Development (in-memory)
 * const broadcaster = createEventBroadcaster({
 *   type: 'memory',
 *   maxListeners: 100,
 * });
 *
 * @example
 * // Production (Redis)
 * const broadcaster = createEventBroadcaster({
 *   type: 'redis',
 *   url: process.env.UPSTASH_REDIS_URL!,
 *   token: process.env.UPSTASH_REDIS_TOKEN!,
 * });
 *
 * @example
 * // Environment-based selection
 * const broadcaster = createEventBroadcaster(
 *   process.env.NODE_ENV === 'production'
 *     ? { type: 'redis', url: process.env.REDIS_URL!, token: process.env.REDIS_TOKEN! }
 *     : { type: 'memory' }
 * );
 */
export function createEventBroadcaster(config: BroadcasterConfig): EventBroadcaster {
	switch (config.type) {
		case "memory":
			return createMemoryBroadcaster(config);
		case "redis":
			return createRedisBroadcaster(config);
		default:
			throw new Error(`Unknown broadcaster type: ${(config as { type: string }).type}`);
	}
}
