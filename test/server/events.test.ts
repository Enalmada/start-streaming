import { describe, expect, it } from "vitest";
import { createEventBroadcaster } from "../../src/server/events";

describe("createEventBroadcaster (memory)", () => {
	it("should create a memory broadcaster", () => {
		const broadcaster = createEventBroadcaster({ type: "memory" });

		expect(broadcaster).toBeDefined();
		expect(broadcaster.subscribe).toBeTypeOf("function");
		expect(broadcaster.publish).toBeTypeOf("function");
		expect(broadcaster.getListenerCount).toBeTypeOf("function");
	});

	it("should publish and subscribe to events", async () => {
		const broadcaster = createEventBroadcaster({ type: "memory" });
		const channel = "test-channel";
		const testData = { message: "hello", timestamp: Date.now() };

		// Start subscription
		const subscription = broadcaster.subscribe<typeof testData>(channel);
		const subscriptionPromise = subscription.next();

		// Publish event
		broadcaster.publish(channel, testData);

		// Should receive the event
		const result = await Promise.race([
			subscriptionPromise,
			new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000)),
		]);

		expect(result.done).toBe(false);
		expect(result.value).toEqual(testData);

		// Cleanup
		await subscription.return?.();
	});

	it("should support multiple subscribers on same channel", async () => {
		const broadcaster = createEventBroadcaster({ type: "memory" });
		const channel = "test-channel";
		const testData = { count: 42 };

		// Create two subscribers
		const sub1 = broadcaster.subscribe<typeof testData>(channel);
		const sub2 = broadcaster.subscribe<typeof testData>(channel);

		const promise1 = sub1.next();
		const promise2 = sub2.next();

		// Publish once
		broadcaster.publish(channel, testData);

		// Both should receive
		const [result1, result2] = await Promise.all([promise1, promise2]);

		expect(result1.value).toEqual(testData);
		expect(result2.value).toEqual(testData);

		// Cleanup
		await sub1.return?.();
		await sub2.return?.();
	});

	it("should support multiple channels", async () => {
		const broadcaster = createEventBroadcaster({ type: "memory" });
		const channel1 = "channel-1";
		const channel2 = "channel-2";

		const sub1 = broadcaster.subscribe<{ data: string }>(channel1);
		const sub2 = broadcaster.subscribe<{ data: string }>(channel2);

		const promise1 = sub1.next();
		const promise2 = sub2.next();

		// Publish to different channels
		broadcaster.publish(channel1, { data: "channel-1-data" });
		broadcaster.publish(channel2, { data: "channel-2-data" });

		const [result1, result2] = await Promise.all([promise1, promise2]);

		expect(result1.value?.data).toBe("channel-1-data");
		expect(result2.value?.data).toBe("channel-2-data");

		// Cleanup
		await sub1.return?.();
		await sub2.return?.();
	});

	it("should track listener count", async () => {
		const broadcaster = createEventBroadcaster({ type: "memory" });
		const channel = "test-channel";

		expect(broadcaster.getListenerCount(channel)).toBe(0);

		// Add subscribers - need to start consuming to register listeners
		const sub1 = broadcaster.subscribe(channel);
		const promise1 = sub1.next(); // Start consuming
		// Small delay to ensure listener is registered
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(broadcaster.getListenerCount(channel)).toBe(1);

		const sub2 = broadcaster.subscribe(channel);
		const promise2 = sub2.next(); // Start consuming
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(broadcaster.getListenerCount(channel)).toBe(2);

		// Publish events to resolve the pending promises so we can cleanup
		broadcaster.publish(channel, { test: 1 });
		broadcaster.publish(channel, { test: 2 });

		// Wait for promises to resolve
		await promise1;
		await promise2;

		// Cleanup
		await sub1.return?.();
		await sub2.return?.();

		// After cleanup, count should be 0
		expect(broadcaster.getListenerCount(channel)).toBe(0);
	});

	it("should handle custom maxListeners", () => {
		const broadcaster = createEventBroadcaster({
			type: "memory",
			maxListeners: 50,
		});

		expect(broadcaster).toBeDefined();
		// Can't directly test maxListeners value, but verifies it accepts the config
	});

	it("should receive multiple events in order", async () => {
		const broadcaster = createEventBroadcaster({ type: "memory" });
		const channel = "test-channel";

		const subscription = broadcaster.subscribe<{ count: number }>(channel);

		// Start consuming first event (this registers the listener)
		const promise1 = subscription.next();

		// Small delay to ensure listener is registered
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Now publish events
		broadcaster.publish(channel, { count: 1 });

		// Wait for first event
		const result1 = await promise1;
		expect(result1.value).toEqual({ count: 1 });

		// Continue with more events
		const promise2 = subscription.next();
		broadcaster.publish(channel, { count: 2 });
		const result2 = await promise2;
		expect(result2.value).toEqual({ count: 2 });

		const promise3 = subscription.next();
		broadcaster.publish(channel, { count: 3 });
		const result3 = await promise3;
		expect(result3.value).toEqual({ count: 3 });

		// Cleanup
		await subscription.return?.();
	});
});

describe("createEventBroadcaster (redis)", () => {
	it("should throw error for unimplemented redis broadcaster", () => {
		expect(() =>
			createEventBroadcaster({
				type: "redis",
				url: "redis://test",
				token: "test-token",
			}),
		).toThrow("Redis broadcaster not yet implemented");
	});
});

describe("createEventBroadcaster (validation)", () => {
	it("should throw error for unknown broadcaster type", () => {
		expect(() =>
			createEventBroadcaster({
				// @ts-expect-error - testing invalid type
				type: "invalid",
			}),
		).toThrow("Unknown broadcaster type");
	});
});
