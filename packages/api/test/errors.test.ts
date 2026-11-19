import { DomainError } from "@repo/db/queries/domain-errors";
import { describe, expect, it } from "vitest";
import { appError, withDomainErrors } from "../src/errors";

describe("appError", () => {
	it.each([
		["UNAUTHORIZED", 401],
		["FORBIDDEN", 403],
		["NOT_GROUP_OWNER", 403],
		["NOT_FOUND", 404],
		["EVENT_NOT_FOUND", 404],
		["RATE_LIMITED", 429],
		["CAPTCHA_FAILED", 400],
		["END_BEFORE_START", 400],
		["ALREADY_REGISTERED", 409],
		["EVENT_WAITLISTED", 409],
		["EVENT_ENDED", 409],
	] as const)("%s carries HTTP status %i and the code as its message", (code, status) => {
		const error = appError(code);
		expect(error.message).toBe(code);
		expect(error).toMatchObject({ status });
	});
});

describe("withDomainErrors", () => {
	it("rethrows a domain error as an app error with its status", async () => {
		const failing = withDomainErrors(async () => {
			throw new DomainError("ITEM_FULL");
		});
		await expect(failing).rejects.toMatchObject({ message: "ITEM_FULL", status: 409 });
	});

	it("leaves unexpected errors alone (they stay 500)", async () => {
		const boom = new Error("db down");
		await expect(withDomainErrors(async () => Promise.reject(boom))).rejects.toBe(boom);
	});
});
