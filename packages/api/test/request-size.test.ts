import { describe, expect, it } from "vitest";
import { MAX_REQUEST_BYTES, oversizedRequestResponse } from "../src/request-size-middleware";

const post = (path: string, headers: Record<string, string> = {}) =>
	new Request(`https://app.example${path}`, { method: "POST", headers });

describe("oversizedRequestResponse", () => {
	it("refuses server-function bodies over the limit before they are read", () => {
		const response = oversizedRequestResponse(
			post("/_serverFn/abc", { "content-length": String(MAX_REQUEST_BYTES + 1) }),
		);
		expect(response?.status).toBe(413);
	});

	it("refuses server-function posts that do not say how big they are", () => {
		expect(oversizedRequestResponse(post("/_serverFn/abc"))?.status).toBe(411);
		expect(
			oversizedRequestResponse(post("/_serverFn/abc", { "content-length": "abc" }))?.status,
		).toBe(411);
	});

	it("lets through a 25 MB upload with its form overhead, GETs and other routes", () => {
		expect(
			oversizedRequestResponse(
				post("/_serverFn/abc", { "content-length": String(25 * 1024 * 1024 + 4096) }),
			),
		).toBeNull();
		expect(oversizedRequestResponse(new Request("https://app.example/_serverFn/abc"))).toBeNull();
		expect(oversizedRequestResponse(post("/api/auth/sign-in/email"))).toBeNull();
	});
});
