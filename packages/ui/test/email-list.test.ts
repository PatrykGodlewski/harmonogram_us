import { describe, expect, it } from "vitest";
import { parseEmailList } from "../src/email-list";

describe("parseEmailList", () => {
	it("splits on new lines, commas, semicolons and spaces, lower-cases and drops repeats", () => {
		expect(parseEmailList("Ala@X.test\nola@x.test, ala@x.test; ela@x.test  ")).toEqual({
			valid: ["ala@x.test", "ola@x.test", "ela@x.test"],
			invalid: [],
		});
	});

	it("reports what is not an address", () => {
		expect(parseEmailList("ala@x.test nie-adres")).toEqual({
			valid: ["ala@x.test"],
			invalid: ["nie-adres"],
		});
	});
});
