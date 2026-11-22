import { describe, expect, it } from "vitest";
import { formatFileSize } from "../src/file-size";

describe("formatFileSize", () => {
	it("uses kB below a megabyte and MB with one decimal above, in the reader's language", () => {
		expect(formatFileSize(2050, "en")).toBe("2 kB");
		expect(formatFileSize(300, "en")).toBe("1 kB");
		expect(formatFileSize(1.5 * 1024 * 1024, "en")).toBe("1.5 MB");
		expect(formatFileSize(1.5 * 1024 * 1024, "pl")).toBe("1,5 MB");
	});
});
