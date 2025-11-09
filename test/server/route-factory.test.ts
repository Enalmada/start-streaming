import type { Channel, Session } from "better-sse";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSSERouteHandler } from "../../src/server/route-factory";

// Mock better-sse
const mockSession = {
	id: "test-session-id",
	push: vi.fn(),
	once: vi.fn(),
	state: {},
} as unknown as Session<any>;

const mockChannel = {
	activeSessions: [],
	register: vi.fn(),
	deregister: vi.fn(),
	broadcast: vi.fn(),
	state: {},
} as unknown as Channel<any>;

vi.mock("better-sse", () => ({
	createResponse: vi.fn((_request: Request, init: (session: Session<any>) => void) => {
		// Call the init function with mock session
		init(mockSession);
		return new Response("mock SSE response", {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	}),
}));

type TestEvent = {
	type: "test-event";
	data: string;
	timestamp: number;
};

type TestParams = {
	discussionId: string;
};

describe("createSSERouteHandler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Basic Handler Creation", () => {
		it("should create a valid handler function", () => {
			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: () => mockChannel,
			});

			expect(handler).toBeTypeOf("function");
		});

		it("should return a Response object", async () => {
			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: () => mockChannel,
			});

			const mockRequest = new Request("http://localhost/api/sse");
			const response = await handler({
				request: mockRequest,
				params: { discussionId: "test-123" },
			});

			expect(response).toBeInstanceOf(Response);
		});
	});

	describe("Channel Registration", () => {
		it("should register session to the channel", async () => {
			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: () => mockChannel,
			});

			const mockRequest = new Request("http://localhost/api/sse");
			await handler({
				request: mockRequest,
				params: { discussionId: "test-123" },
			});

			expect(mockChannel.register).toHaveBeenCalledWith(mockSession);
		});

		it("should get channel with correct params", async () => {
			const getChannelMock = vi.fn(() => mockChannel);

			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: getChannelMock,
			});

			const params = { discussionId: "discussion-456" };
			const mockRequest = new Request("http://localhost/api/sse");

			await handler({ request: mockRequest, params });

			expect(getChannelMock).toHaveBeenCalledWith(params);
		});
	});

	describe("Parameter Validation", () => {
		it("should validate params when validator is provided", async () => {
			const validateParams = vi.fn(() => true);

			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: () => mockChannel,
				validateParams,
			});

			const params = { discussionId: "test-123" };
			const mockRequest = new Request("http://localhost/api/sse");

			await handler({ request: mockRequest, params });

			expect(validateParams).toHaveBeenCalledWith(params);
		});

		it("should return 400 when validation fails", async () => {
			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: () => mockChannel,
				validateParams: () => false,
			});

			const mockRequest = new Request("http://localhost/api/sse");
			const response = await handler({
				request: mockRequest,
				params: { discussionId: "" },
			});

			expect(response.status).toBe(400);
			const text = await response.text();
			expect(text).toBe("Invalid parameters");
		});

		it("should proceed when validation passes", async () => {
			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: () => mockChannel,
				validateParams: (params) => !!params.discussionId,
			});

			const mockRequest = new Request("http://localhost/api/sse");
			const response = await handler({
				request: mockRequest,
				params: { discussionId: "valid-id" },
			});

			expect(response.status).not.toBe(400);
			expect(mockChannel.register).toHaveBeenCalled();
		});

		it("should work without validator", async () => {
			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: () => mockChannel,
			});

			const mockRequest = new Request("http://localhost/api/sse");
			const response = await handler({
				request: mockRequest,
				params: { discussionId: "" },
			});

			// Should succeed without validator
			expect(response.status).not.toBe(400);
		});
	});

	describe("Initial Event", () => {
		it("should send initial event when configured", async () => {
			const initialEvent: TestEvent = {
				type: "test-event",
				data: "initial",
				timestamp: Date.now(),
			};

			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: () => mockChannel,
				getInitialEvent: () => initialEvent,
			});

			const mockRequest = new Request("http://localhost/api/sse");
			await handler({
				request: mockRequest,
				params: { discussionId: "test-123" },
			});

			expect(mockSession.push).toHaveBeenCalledWith(initialEvent, "message");
		});

		it("should not send initial event when not configured", async () => {
			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: () => mockChannel,
			});

			const mockRequest = new Request("http://localhost/api/sse");
			await handler({
				request: mockRequest,
				params: { discussionId: "test-123" },
			});

			expect(mockSession.push).not.toHaveBeenCalled();
		});

		it("should call getInitialEvent with params", async () => {
			const getInitialEventMock = vi.fn((params: TestParams) => ({
				type: "test-event" as const,
				data: `initial-${params.discussionId}`,
				timestamp: Date.now(),
			}));

			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: () => mockChannel,
				getInitialEvent: getInitialEventMock,
			});

			const params = { discussionId: "discussion-789" };
			const mockRequest = new Request("http://localhost/api/sse");

			await handler({ request: mockRequest, params });

			expect(getInitialEventMock).toHaveBeenCalledWith(params);
		});
	});

	describe("Disconnect Handling", () => {
		it("should deregister session on disconnect", async () => {
			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: () => mockChannel,
			});

			const mockRequest = new Request("http://localhost/api/sse");
			await handler({
				request: mockRequest,
				params: { discussionId: "test-123" },
			});

			// Verify disconnect handler was registered
			expect(mockSession.once).toHaveBeenCalledWith("disconnected", expect.any(Function));

			// Simulate disconnect
			const disconnectHandler = (mockSession.once as any).mock.calls[0][1];
			disconnectHandler();

			expect(mockChannel.deregister).toHaveBeenCalledWith(mockSession);
		});

		it("should call onDisconnect callback when provided", async () => {
			const onDisconnectMock = vi.fn();

			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: () => mockChannel,
				onDisconnect: onDisconnectMock,
			});

			const params = { discussionId: "test-123" };
			const mockRequest = new Request("http://localhost/api/sse");

			await handler({ request: mockRequest, params });

			// Simulate disconnect
			const disconnectHandler = (mockSession.once as any).mock.calls[0][1];
			disconnectHandler();

			expect(onDisconnectMock).toHaveBeenCalledWith(params);
		});

		it("should not call onDisconnect when not provided", async () => {
			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: () => mockChannel,
			});

			const mockRequest = new Request("http://localhost/api/sse");
			await handler({
				request: mockRequest,
				params: { discussionId: "test-123" },
			});

			// Simulate disconnect - should not throw
			const disconnectHandler = (mockSession.once as any).mock.calls[0][1];
			expect(() => disconnectHandler()).not.toThrow();
		});
	});

	describe("Error Handling", () => {
		it("should return 500 when getChannel throws", async () => {
			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: () => {
					throw new Error("Channel not found");
				},
			});

			const mockRequest = new Request("http://localhost/api/sse");
			const response = await handler({
				request: mockRequest,
				params: { discussionId: "test-123" },
			});

			expect(response.status).toBe(500);
			const text = await response.text();
			expect(text).toContain("Failed to establish SSE connection");
			expect(text).toContain("Channel not found");
		});

		it("should handle non-Error throws", async () => {
			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: () => {
					throw "String error";
				},
			});

			const mockRequest = new Request("http://localhost/api/sse");
			const response = await handler({
				request: mockRequest,
				params: { discussionId: "test-123" },
			});

			expect(response.status).toBe(500);
			const text = await response.text();
			expect(text).toContain("Failed to establish SSE connection");
			expect(text).toContain("String error");
		});
	});

	describe("Complete Flow", () => {
		it("should execute complete connection flow with all options", async () => {
			const validateParams = vi.fn(() => true);
			const getInitialEvent = vi.fn((params: TestParams) => ({
				type: "test-event" as const,
				data: `initial-${params.discussionId}`,
				timestamp: Date.now(),
			}));
			const onDisconnect = vi.fn();

			const handler = createSSERouteHandler<TestParams, TestEvent>({
				getChannel: () => mockChannel,
				validateParams,
				getInitialEvent,
				onDisconnect,
			});

			const params = { discussionId: "complete-flow-test" };
			const mockRequest = new Request("http://localhost/api/sse");

			const response = await handler({ request: mockRequest, params });

			// Verify entire flow
			expect(validateParams).toHaveBeenCalledWith(params);
			expect(mockChannel.register).toHaveBeenCalledWith(mockSession);
			expect(getInitialEvent).toHaveBeenCalledWith(params);
			expect(mockSession.push).toHaveBeenCalled();
			expect(mockSession.once).toHaveBeenCalledWith("disconnected", expect.any(Function));

			// Simulate disconnect
			const disconnectHandler = (mockSession.once as any).mock.calls[0][1];
			disconnectHandler();

			expect(mockChannel.deregister).toHaveBeenCalledWith(mockSession);
			expect(onDisconnect).toHaveBeenCalledWith(params);

			// Response should be successful
			expect(response.status).not.toBe(400);
			expect(response.status).not.toBe(500);
		});
	});

	describe("Type Safety", () => {
		it("should enforce param type constraints", async () => {
			type StrictParams = {
				discussionId: string;
				userId: string;
			};

			const handler = createSSERouteHandler<StrictParams, TestEvent>({
				getChannel: (params) => {
					// Params should have correct type
					expect(params.discussionId).toBeDefined();
					expect(params.userId).toBeDefined();
					return mockChannel;
				},
				validateParams: (params) => {
					return !!params.discussionId && !!params.userId;
				},
			});

			const mockRequest = new Request("http://localhost/api/sse");
			await handler({
				request: mockRequest,
				params: { discussionId: "disc-123", userId: "user-456" },
			});
		});

		it("should enforce event type constraints", async () => {
			type StrictEvent = {
				type: "comment-added";
				discussionId: string;
				count: number;
			};

			const handler = createSSERouteHandler<TestParams, StrictEvent>({
				getChannel: () => mockChannel,
				getInitialEvent: (params) => ({
					type: "comment-added",
					discussionId: params.discussionId,
					count: 0,
				}),
			});

			const mockRequest = new Request("http://localhost/api/sse");
			await handler({
				request: mockRequest,
				params: { discussionId: "test-123" },
			});

			expect(mockSession.push).toHaveBeenCalledWith(
				{
					type: "comment-added",
					discussionId: "test-123",
					count: 0,
				},
				"message",
			);
		});
	});
});
