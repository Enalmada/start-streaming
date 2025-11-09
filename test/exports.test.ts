import { describe, expect, it } from "vitest";

describe("Module exports", () => {
	it("should export server utilities", async () => {
		const serverModule = await import("../src/server/index.js");

		expect(serverModule.createSSEChannelManager).toBeTypeOf("function");
		expect(serverModule.createSSERouteHandler).toBeTypeOf("function");
	});

	it("should export client hooks", async () => {
		const clientModule = await import("../src/client/index.js");

		expect(clientModule.useSSEConnection).toBeTypeOf("function");
		expect(clientModule.useSSEQueryInvalidation).toBeTypeOf("function");
	});

	it("should export types", async () => {
		const typesModule = await import("../src/types/index.js");

		// Type exports are compile-time only, just verify module loads
		expect(typesModule).toBeDefined();
	});
});
