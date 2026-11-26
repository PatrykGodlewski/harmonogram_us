import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Fold } from "../src/composed/brand/fold";
import { NumberTicker } from "../src/composed/brand/number-ticker";
import { PixelHeading } from "../src/composed/brand/pixel-heading";
import { SectionCard } from "../src/composed/brand/section-card";

/** The selectors the theme's reduced-motion block switches off. */
function reducedMotionBlock(): string {
	const css = readFileSync(new URL("../tailwind.css", import.meta.url), "utf8");
	const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
	return css.slice(start);
}

describe("NumberTicker", () => {
	it("renders the number alone, with no animation on the first paint", () => {
		const html = renderToString(<NumberTicker value={12} />);
		expect(html).toBe(
			'<span data-slot="number-ticker" class="inline-block tabular-nums">12</span>',
		);
	});

	it("steps through a class that reduced motion switches off", () => {
		expect(reducedMotionBlock()).toContain(".animate-number-tick");
	});
});

describe("Fold", () => {
	it("makes closed content inert", () => {
		const html = renderToString(
			<Fold id="f" open={false}>
				<a href="/x">link</a>
			</Fold>,
		);
		expect(html).toMatch(/<div id="f"[^>]* inert=""/);
		expect(html).toContain('data-state="closed"');
	});

	it("leaves open content reachable", () => {
		const html = renderToString(
			<Fold id="f" open>
				<a href="/x">link</a>
			</Fold>,
		);
		expect(html).not.toContain("inert");
		expect(html).toContain('data-state="open"');
	});

	it("folds through a transition that reduced motion cuts short", () => {
		const html = renderToString(<Fold id="f" open />);
		expect(html).toContain("transition-[grid-template-rows]");
		expect(reducedMotionBlock()).toMatch(/transition-duration: 0\.01ms/);
	});
});

describe("SectionCard", () => {
	it("is a region named by the heading in its strip", () => {
		const html = renderToString(
			<SectionCard heading="Zapisani (3)" level={2} action={<button type="button">Dodaj</button>}>
				body
			</SectionCard>,
		);
		const id = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
		expect(id).toBeTruthy();
		expect(html).toMatch(/^<section aria-labelledby="[^"]+" data-slot="card"/);
		expect(html).toContain('data-slot="card-header"');
		expect(html).toMatch(new RegExp(`<h2 id="${id}" class="[^"]*font-mono[^"]*">Zapisani \\(3\\)</h2>`));
		expect(html).toContain("<button");
	});

	it("uses the heading level it is given", () => {
		const html = renderToString(<SectionCard heading="Pytania" level={3} />);
		expect(html).toContain("<h3 ");
	});
});

describe("PixelHeading", () => {
	it("keeps its level and text and reveals in steps", () => {
		const html = renderToString(<PixelHeading level={1}>Wydarzenia</PixelHeading>);
		expect(html).toMatch(/^<h1 class="animate-pixel-reveal[^"]*">Wydarzenia<\/h1>$/);
	});
});
