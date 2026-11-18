import { describe, expect, it } from "vitest";
import { parseEmailList } from "../src/groups/parse-email-list";

describe("parseEmailList", () => {
	it("splits on commas, semicolons, spaces and newlines", () => {
		expect(parseEmailList("a@x.pl, b@x.pl;c@x.pl\nd@x.pl  e@x.pl").valid).toEqual([
			"a@x.pl",
			"b@x.pl",
			"c@x.pl",
			"d@x.pl",
			"e@x.pl",
		]);
	});

	it("lowercases and removes duplicates", () => {
		expect(parseEmailList("A@X.pl a@x.pl\nA@x.PL").valid).toEqual(["a@x.pl"]);
	});

	it("keeps invalid entries apart", () => {
		expect(parseEmailList("ok@x.pl nope, @x.pl, also-bad@")).toEqual({
			valid: ["ok@x.pl"],
			invalid: ["nope", "@x.pl", "also-bad@"],
		});
	});

	it("empty input → empty lists", () => {
		expect(parseEmailList("  \n ,; ")).toEqual({ valid: [], invalid: [] });
	});
});
