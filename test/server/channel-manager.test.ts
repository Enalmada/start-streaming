import type { Channel, Session } from "better-sse";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSSEChannelManager } from "../../src/server/channel-manager";

// Mock better-sse
vi.mock("better-sse", () => {
	const createMockChannel = (): Channel<any> => {
		const sessions: Session<any>[] = [];
		return {
			activeSessions: sessions,
			register: vi.fn((session: Session<any>) => {
				sessions.push(session);
			}),
			deregister: vi.fn((session: Session<any>) => {
				const index = sessions.indexOf(session);
				if (index > -1) sessions.splice(index, 1);
			}),
			broadcast: vi.fn(),
			state: {},
		} as any;
	};

	return {
		createChannel: vi.fn(() => createMockChannel()),
	};
});

type TestEvent = {
	type: "test-event";
	data: string;
	timestamp: number;
};

describe("createSSEChannelManager", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Channel Creation and Management", () => {
		it("should create a channel manager with default config", () => {
			const manager = createSSEChannelManager<TestEvent>();

			expect(manager).toBeDefined();
			expect(manager.getChannel).toBeTypeOf("function");
			expect(manager.publish).toBeTypeOf("function");
			expect(manager.getSessionCount).toBeTypeOf("function");
			expect(manager.cleanupIfEmpty).toBeTypeOf("function");
		});

		it("should create channels with keyPrefix and keySuffix", () => {
			const manager = createSSEChannelManager<TestEvent>({
				keyPrefix: "discussion",
				keySuffix: "comments",
			});

			const channel1 = manager.getChannel("123");
			const channel2 = manager.getChannel("456");

			expect(channel1).toBeDefined();
			expect(channel2).toBeDefined();
			expect(channel1).not.toBe(channel2); // Different resource IDs = different channels
		});

		it("should create channels with only keyPrefix", () => {
			const manager = createSSEChannelManager<TestEvent>({
				keyPrefix: "user",
			});

			const channel = manager.getChannel("user-123");
			expect(channel).toBeDefined();
		});

		it("should create channels with only keySuffix", () => {
			const manager = createSSEChannelManager<TestEvent>({
				keySuffix: "events",
			});

			const channel = manager.getChannel("resource-123");
			expect(channel).toBeDefined();
		});

		it("should reuse existing channels for same resource ID", () => {
			const manager = createSSEChannelManager<TestEvent>();

			const channel1 = manager.getChannel("test-resource");
			const channel2 = manager.getChannel("test-resource");

			expect(channel1).toBe(channel2); // Same instance
		});

		it("should create separate channels for different resource IDs", () => {
			const manager = createSSEChannelManager<TestEvent>();

			const channel1 = manager.getChannel("resource-1");
			const channel2 = manager.getChannel("resource-2");

			expect(channel1).not.toBe(channel2);
		});
	});

	describe("Event Publishing", () => {
		it("should publish events to the correct channel", () => {
			const manager = createSSEChannelManager<TestEvent>();
			const resourceId = "test-123";

			const event: TestEvent = {
				type: "test-event",
				data: "hello world",
				timestamp: Date.now(),
			};

			manager.publish(resourceId, event);

			const channel = manager.getChannel(resourceId);
			expect(channel.broadcast).toHaveBeenCalledWith(event, "message");
		});

		it("should publish multiple events to the same channel", () => {
			const manager = createSSEChannelManager<TestEvent>();
			const resourceId = "test-123";

			const event1: TestEvent = { type: "test-event", data: "first", timestamp: Date.now() };
			const event2: TestEvent = { type: "test-event", data: "second", timestamp: Date.now() };

			manager.publish(resourceId, event1);
			manager.publish(resourceId, event2);

			const channel = manager.getChannel(resourceId);
			expect(channel.broadcast).toHaveBeenCalledTimes(2);
			expect(channel.broadcast).toHaveBeenNthCalledWith(1, event1, "message");
			expect(channel.broadcast).toHaveBeenNthCalledWith(2, event2, "message");
		});

		it("should publish events to different channels independently", () => {
			const manager = createSSEChannelManager<TestEvent>();

			const event1: TestEvent = { type: "test-event", data: "channel1", timestamp: Date.now() };
			const event2: TestEvent = { type: "test-event", data: "channel2", timestamp: Date.now() };

			manager.publish("resource-1", event1);
			manager.publish("resource-2", event2);

			const channel1 = manager.getChannel("resource-1");
			const channel2 = manager.getChannel("resource-2");

			expect(channel1.broadcast).toHaveBeenCalledWith(event1, "message");
			expect(channel2.broadcast).toHaveBeenCalledWith(event2, "message");
		});
	});

	describe("Session Count Tracking", () => {
		it("should return 0 for non-existent channels", () => {
			const manager = createSSEChannelManager<TestEvent>();
			expect(manager.getSessionCount("non-existent")).toBe(0);
		});

		it("should return 0 for channels with no sessions", () => {
			const manager = createSSEChannelManager<TestEvent>();
			manager.getChannel("test-123"); // Create channel but don't add sessions

			expect(manager.getSessionCount("test-123")).toBe(0);
		});

		it("should track session count correctly", () => {
			const manager = createSSEChannelManager<TestEvent>();
			const channel = manager.getChannel("test-123");

			// Simulate adding sessions
			const mockSession1 = { id: "session-1" } as Session<TestEvent>;
			const mockSession2 = { id: "session-2" } as Session<TestEvent>;

			channel.register(mockSession1);
			expect(manager.getSessionCount("test-123")).toBe(1);

			channel.register(mockSession2);
			expect(manager.getSessionCount("test-123")).toBe(2);

			channel.deregister(mockSession1);
			expect(manager.getSessionCount("test-123")).toBe(1);

			channel.deregister(mockSession2);
			expect(manager.getSessionCount("test-123")).toBe(0);
		});

		it("should track sessions across multiple channels", () => {
			const manager = createSSEChannelManager<TestEvent>();

			const channel1 = manager.getChannel("resource-1");
			const channel2 = manager.getChannel("resource-2");

			const session1 = { id: "session-1" } as Session<TestEvent>;
			const session2 = { id: "session-2" } as Session<TestEvent>;

			channel1.register(session1);
			channel2.register(session2);

			expect(manager.getSessionCount("resource-1")).toBe(1);
			expect(manager.getSessionCount("resource-2")).toBe(1);
		});
	});

	describe("Channel Cleanup", () => {
		it("should remove empty channels", () => {
			const manager = createSSEChannelManager<TestEvent>();
			const channel = manager.getChannel("test-123");

			expect(manager.getSessionCount("test-123")).toBe(0);

			manager.cleanupIfEmpty("test-123");

			// After cleanup, getting the channel should create a new instance
			const newChannel = manager.getChannel("test-123");
			expect(newChannel).not.toBe(channel);
		});

		it("should NOT remove channels with active sessions", () => {
			const manager = createSSEChannelManager<TestEvent>();
			const channel = manager.getChannel("test-123");

			const mockSession = { id: "session-1" } as Session<TestEvent>;
			channel.register(mockSession);

			expect(manager.getSessionCount("test-123")).toBe(1);

			manager.cleanupIfEmpty("test-123");

			// Channel should still be the same instance
			const sameChannel = manager.getChannel("test-123");
			expect(sameChannel).toBe(channel);
			expect(manager.getSessionCount("test-123")).toBe(1);
		});

		it("should handle cleanup of non-existent channels gracefully", () => {
			const manager = createSSEChannelManager<TestEvent>();

			// Should not throw
			expect(() => {
				manager.cleanupIfEmpty("non-existent");
			}).not.toThrow();
		});

		it("should cleanup after all sessions disconnect", () => {
			const manager = createSSEChannelManager<TestEvent>();
			const channel = manager.getChannel("test-123");

			const session1 = { id: "session-1" } as Session<TestEvent>;
			const session2 = { id: "session-2" } as Session<TestEvent>;

			channel.register(session1);
			channel.register(session2);
			expect(manager.getSessionCount("test-123")).toBe(2);

			// Cleanup should not remove channel while sessions exist
			manager.cleanupIfEmpty("test-123");
			expect(manager.getSessionCount("test-123")).toBe(2);

			// Remove one session
			channel.deregister(session1);
			manager.cleanupIfEmpty("test-123");
			expect(manager.getSessionCount("test-123")).toBe(1);

			// Remove last session and cleanup
			channel.deregister(session2);
			manager.cleanupIfEmpty("test-123");

			// Channel should be removed, new instance created on next get
			const newChannel = manager.getChannel("test-123");
			expect(newChannel).not.toBe(channel);
			expect(manager.getSessionCount("test-123")).toBe(0);
		});
	});

	describe("Type Safety", () => {
		it("should enforce event type constraints", () => {
			type StrictEvent = {
				type: "comment-added";
				discussionId: string;
				count: number;
			};

			const manager = createSSEChannelManager<StrictEvent>();

			const validEvent: StrictEvent = {
				type: "comment-added",
				discussionId: "disc-123",
				count: 5,
			};

			// This should work without type errors
			manager.publish("disc-123", validEvent);

			const channel = manager.getChannel("disc-123");
			expect(channel.broadcast).toHaveBeenCalledWith(validEvent, "message");
		});

		it("should support union event types", () => {
			type UnionEvent =
				| { type: "comment-added"; count: number }
				| { type: "comment-deleted"; id: string }
				| { type: "discussion-closed"; timestamp: number };

			const manager = createSSEChannelManager<UnionEvent>();

			const event1: UnionEvent = { type: "comment-added", count: 1 };
			const event2: UnionEvent = { type: "comment-deleted", id: "comment-123" };
			const event3: UnionEvent = { type: "discussion-closed", timestamp: Date.now() };

			manager.publish("test", event1);
			manager.publish("test", event2);
			manager.publish("test", event3);

			const channel = manager.getChannel("test");
			expect(channel.broadcast).toHaveBeenCalledTimes(3);
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty string resource IDs", () => {
			const manager = createSSEChannelManager<TestEvent>();

			const channel = manager.getChannel("");
			expect(channel).toBeDefined();
			expect(manager.getSessionCount("")).toBe(0);
		});

		it("should handle special characters in resource IDs", () => {
			const manager = createSSEChannelManager<TestEvent>();

			const resourceIds = [
				"resource:with:colons",
				"resource/with/slashes",
				"resource-with-dashes",
				"resource_with_underscores",
				"resource.with.dots",
			];

			for (const id of resourceIds) {
				const channel = manager.getChannel(id);
				expect(channel).toBeDefined();

				const event: TestEvent = {
					type: "test-event",
					data: id,
					timestamp: Date.now(),
				};
				manager.publish(id, event);
				expect(channel.broadcast).toHaveBeenCalledWith(event, "message");
			}
		});

		it("should handle rapid consecutive operations", () => {
			const manager = createSSEChannelManager<TestEvent>();
			const resourceId = "rapid-test";

			// Rapidly create, publish, and cleanup
			for (let i = 0; i < 100; i++) {
				const event: TestEvent = {
					type: "test-event",
					data: `event-${i}`,
					timestamp: Date.now(),
				};
				manager.publish(resourceId, event);
			}

			const channel = manager.getChannel(resourceId);
			expect(channel.broadcast).toHaveBeenCalledTimes(100);
		});
	});
});
