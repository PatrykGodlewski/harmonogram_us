import { afterEach, describe, expect, it, vi } from "vitest";
import { shapeUrl } from "../src/shape-url";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("shapeUrl", () => {
	it("returns an absolute URL on the page origin in the browser", () => {
		vi.stubGlobal("window", { location: { origin: "https://events.example.edu" } });
		const url = shapeUrl("/api/electric/event-seat-counts");
		expect(url).toBe("https://events.example.edu/api/electric/event-seat-counts");
		expect(() => new URL(url)).not.toThrow();
	});

	it("keeps the path unchanged on the server", () => {
		expect(shapeUrl("/api/electric/event-seat-counts")).toBe(
			"/api/electric/event-seat-counts",
		);
	});
});
