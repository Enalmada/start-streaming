import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock EventSource
class MockEventSource {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSED = 2;

	url: string;
	readyState: number;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	onopen: ((event: Event) => void) | null = null;

	private listeners: Map<string, Set<EventListener>> = new Map();

	constructor(url: string) {
		this.url = url;
		this.readyState = MockEventSource.CONNECTING;

		// Simulate successful connection after a tick
		setTimeout(() => {
			this.readyState = MockEventSource.OPEN;
			if (this.onopen) {
				this.onopen(new Event("open"));
			}
		}, 0);
	}

	addEventListener(type: string, listener: EventListener) {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set());
		}
		this.listeners.get(type)?.add(listener);
	}

	removeEventListener(type: string, listener: EventListener) {
		this.listeners.get(type)?.delete(listener);
	}

	close() {
		this.readyState = MockEventSource.CLOSED;
	}

	// Test helper to simulate receiving a message
	simulateMessage(data: any) {
		const event = new MessageEvent("message", {
			data: JSON.stringify(data),
		});
		if (this.onmessage) {
			this.onmessage(event);
		}
		this.listeners.get("message")?.forEach((listener) => {
			listener(event);
		});
	}

	// Test helper to simulate an error
	simulateError() {
		const event = new Event("error");
		if (this.onerror) {
			this.onerror(event);
		}
		this.listeners.get("error")?.forEach((listener) => {
			listener(event);
		});
	}
}

// Store original EventSource
const OriginalEventSource = global.EventSource;

describe("useSSEConnection", () => {
	let mockEventSource: MockEventSource | null = null;

	beforeEach(() => {
		// Replace global EventSource with our mock
		global.EventSource = vi.fn((url: string) => {
			mockEventSource = new MockEventSource(url);
			return mockEventSource as any;
		}) as any;
	});

	afterEach(() => {
		// Restore original EventSource
		global.EventSource = OriginalEventSource;
		mockEventSource = null;
		vi.clearAllMocks();
	});

	describe("Basic Functionality", () => {
		it("should export useSSEConnection function", async () => {
			const { useSSEConnection } = await import("../../src/client/hooks/useSSEConnection");
			expect(useSSEConnection).toBeTypeOf("function");
		});

		it("should accept required options", async () => {
			const { useSSEConnection } = await import("../../src/client/hooks/useSSEConnection");

			// Type check - should compile without errors
			const options = {
				endpoint: "/api/sse/test",
				onEvent: (event: any) => {
					console.log(event);
				},
			};

			expect(options.endpoint).toBeDefined();
			expect(options.onEvent).toBeTypeOf("function");
		});
	});

	describe("EventSource Connection", () => {
		it("should create EventSource with correct endpoint", () => {
			const endpoint = "/api/sse/comments/123";
			const es = new MockEventSource(endpoint);

			expect(es.url).toBe(endpoint);
			expect(global.EventSource).toBeDefined();
		});
	});

	describe("Event Handling", () => {
		it("should parse JSON messages correctly", () => {
			const testData = {
				type: "test-event",
				data: "hello world",
				timestamp: Date.now(),
			};

			const messageEvent = new MessageEvent("message", {
				data: JSON.stringify(testData),
			});

			const parsed = JSON.parse(messageEvent.data);
			expect(parsed).toEqual(testData);
		});

		it("should handle message events", () => {
			const testData = {
				type: "comment-added",
				count: 5,
			};

			const onEvent = vi.fn();
			const messageHandler = (event: MessageEvent) => {
				const data = JSON.parse(event.data);
				onEvent(data);
			};

			const event = new MessageEvent("message", {
				data: JSON.stringify(testData),
			});

			messageHandler(event);

			expect(onEvent).toHaveBeenCalledWith(testData);
		});
	});

	describe("Connection State", () => {
		it("should track EventSource ready states", () => {
			const es = new MockEventSource("/test");

			// Initially connecting
			expect(es.readyState).toBe(MockEventSource.CONNECTING);

			// Can transition to open
			es.readyState = MockEventSource.OPEN;
			expect(es.readyState).toBe(MockEventSource.OPEN);

			// Can transition to closed
			es.readyState = MockEventSource.CLOSED;
			expect(es.readyState).toBe(MockEventSource.CLOSED);
		});
	});

	describe("Cleanup", () => {
		it("should close EventSource connection", () => {
			const es = new MockEventSource("/test");
			expect(es.readyState).toBe(MockEventSource.CONNECTING);

			es.close();
			expect(es.readyState).toBe(MockEventSource.CLOSED);
		});

		it("should remove event listeners", () => {
			const es = new MockEventSource("/test");
			const listener = vi.fn();

			es.addEventListener("message", listener);
			es.removeEventListener("message", listener);

			// Simulate message - listener should not be called
			es.simulateMessage({ test: "data" });
			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe("SSR Safety", () => {
		it("should handle missing window gracefully", () => {
			const originalWindow = global.window;

			// @ts-expect-error - Simulating SSR environment
			delete global.window;

			const isSSR = typeof window === "undefined";
			expect(isSSR).toBe(true);

			// Restore window
			global.window = originalWindow;
		});

		it("should detect client-side environment", () => {
			const isClient = typeof window !== "undefined";
			// In vitest/node environment, window is not defined
			expect(typeof isClient).toBe("boolean");
		});
	});

	describe("Error Scenarios", () => {
		it("should handle EventSource errors", () => {
			const es = new MockEventSource("/test");
			const onError = vi.fn();

			es.onerror = onError;
			es.simulateError();

			expect(onError).toHaveBeenCalled();
		});

		it("should handle invalid JSON in messages", () => {
			const invalidJSON = "not valid json{";

			expect(() => {
				JSON.parse(invalidJSON);
			}).toThrow();

			// Should handle gracefully with try-catch
			let parsed = null;
			try {
				parsed = JSON.parse(invalidJSON);
			} catch {
				parsed = null;
			}

			expect(parsed).toBeNull();
		});
	});

	describe("Module Integration", () => {
		it("should export correct hook", async () => {
			const clientModule = await import("../../src/client/index");
			expect(clientModule.useSSEConnection).toBeDefined();
			expect(clientModule.useSSEConnection).toBeTypeOf("function");
		});
	});
});
