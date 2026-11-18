import { FetchError } from "@electric-sql/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleShapeError } from "../src/shape-errors";

afterEach(() => {
	vi.restoreAllMocks();
});

const fetchError = (status: number) =>
	new FetchError(status, "error", undefined, {}, "http://app.test/api/electric/x");

describe("handleShapeError", () => {
	it("retries rate limiting and timeouts", () => {
		expect(handleShapeError(fetchError(429))).toEqual({});
		expect(handleShapeError(fetchError(408))).toEqual({});
	});

	it("stops and reports permanent errors instead of retrying forever", () => {
		const report = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(handleShapeError(fetchError(400))).toBeUndefined();
		expect(handleShapeError(new TypeError("Invalid URL"))).toBeUndefined();
		expect(report).toHaveBeenCalledTimes(2);
	});
});
