import { describe, expect, it } from "vitest";
import { fitLines } from "../src/certificates/layout";

/** Every character is half the font size wide. */
const width = (text: string, size: number) => text.length * size * 0.5;

describe("fitLines", () => {
	it("keeps short text at the largest size on one line", () => {
		expect(fitLines("Ala Kot", width, 400, [26, 20], 1)).toEqual({
			size: 26,
			lines: ["Ala Kot"],
		});
	});

	it("shrinks a long name to fit one line", () => {
		const name = "Aleksandra Konstancja Wiśniewska-Brzęczyszczykiewicz";
		const result = fitLines(name, width, 600, [26, 20, 16, 13], 1);
		expect(result.lines).toEqual([name]);
		expect(width(name, result.size)).toBeLessThanOrEqual(600);
	});

	it("never goes past the line limit, shortening the last line with an ellipsis", () => {
		const title = "słowo ".repeat(120).trim();
		const result = fitLines(title, width, 600, [20, 16, 13], 3);
		expect(result.lines.length).toBeLessThanOrEqual(3);
		expect(result.lines.at(-1)?.endsWith("…")).toBe(true);
		for (const line of result.lines) {
			expect(width(line, result.size)).toBeLessThanOrEqual(600);
		}
	});

	it("breaks a single word that is too long", () => {
		const result = fitLines("x".repeat(300), width, 600, [20], 3);
		for (const line of result.lines) {
			expect(width(line, result.size)).toBeLessThanOrEqual(600);
		}
	});
});
