import { describe, expect, it } from "vitest";
import { eventSearchSchema } from "../src/events/schemas";

describe("eventSearchSchema", () => {
	it("keeps an all-digit search, which the router reads from the URL as a number", () => {
		expect(eventSearchSchema.parse({ search: 624428 }).search).toBe("624428");
	});

	it("leaves a missing search out", () => {
		expect(eventSearchSchema.parse({}).search).toBeUndefined();
	});
});
