import { describe, expect, it } from "vitest";
import { languageName } from "../src/languages";

describe("languageName", () => {
	it("names the language in the reader's language", () => {
		expect(languageName("pl", "pl")).toBe("polski");
		expect(languageName("pl", "en")).toBe("Polish");
		expect(languageName("uk", "pl")).toBe("ukraiński");
	});
});
