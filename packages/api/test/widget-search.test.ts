import { describe, expect, it } from "vitest";
import { widgetSearchSchema } from "../src/public/widget";

describe("widget search schema", () => {
	// The router parses `?faculty=123` as JSON, so the schema sees the number 123.
	it("keeps digits as the string they were typed as", () => {
		expect(widgetSearchSchema.parse({ faculty: 123, type: 2024 })).toMatchObject({
			faculty: "123",
			type: "2024",
		});
		expect(widgetSearchSchema.parse({ faculty: "123" }).faculty).toBe("123");
	});

	it("still falls back to the defaults for bad values", () => {
		expect(
			widgetSearchSchema.parse({ limit: 99, faculty: "", type: { a: 1 } }),
		).toEqual({ limit: 5, faculty: undefined, type: undefined });
	});
});
