import { describe, expect, it } from "vitest";
import { runWithHumanCheck } from "../src/human-check-run";

const rejected = (code: string) => Object.assign(new Error("odmowa"), { code });

describe("runWithHumanCheck", () => {
	it("runs the action with a token", async () => {
		const result = await runWithHumanCheck(
			async () => "t1",
			async (token) => `ok:${token}`,
		);
		expect(result).toBe("ok:t1");
	});

	it("tries once more with a fresh token when the server rejects the proof", async () => {
		const tokens = ["t1", "t2"];
		const seen: (string | undefined)[] = [];
		const result = await runWithHumanCheck(
			async () => tokens.shift(),
			async (token) => {
				seen.push(token);
				if (token === "t1") throw rejected("VERIFICATION_FAILED");
				return "ok";
			},
		);
		expect(result).toBe("ok");
		expect(seen).toEqual(["t1", "t2"]);
	});

	it("does not retry other errors, and retries a rejection only once", async () => {
		let calls = 0;
		await expect(
			runWithHumanCheck(
				async () => "t",
				async () => {
					calls += 1;
					throw new Error("INVALID_EMAIL_OR_PASSWORD");
				},
			),
		).rejects.toThrow("INVALID_EMAIL_OR_PASSWORD");
		expect(calls).toBe(1);
		calls = 0;
		await expect(
			runWithHumanCheck(
				async () => "t",
				async () => {
					calls += 1;
					throw rejected("CAPTCHA_FAILED");
				},
			),
		).rejects.toMatchObject({ code: "CAPTCHA_FAILED" });
		expect(calls).toBe(2);
	});

	it("reports a check that could not run (blocked script, widget error) without calling the action", async () => {
		let called = false;
		const error = await runWithHumanCheck(
			async () => {
				throw new Error("Timeout");
			},
			async () => {
				called = true;
			},
		).catch((caught: unknown) => caught);
		expect(called).toBe(false);
		expect(error).toMatchObject({ code: "CAPTCHA_UNAVAILABLE" });
	});

	it("passes on a cancelled check as it is", async () => {
		const cancelled = Object.assign(new Error("przerwano"), {
			code: "CAPTCHA_CANCELLED",
		});
		await expect(
			runWithHumanCheck(
				async () => {
					throw cancelled;
				},
				async () => "never",
			),
		).rejects.toBe(cancelled);
	});
});
