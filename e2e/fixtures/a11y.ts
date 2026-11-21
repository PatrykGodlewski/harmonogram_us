import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** WCAG 2.1 A/AA (EN 301 549, as F8 requires) plus the 2.2 AA additions. */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
/** WCAG 1.4.10: content reflows at 320 CSS px (400 % zoom) without sideways scrolling. */
const REFLOW_WIDTH = 320;

async function settle(page: Page) {
	// Mid-fade colours read as low contrast: check the settled page.
	await page.waitForFunction(() =>
		document
			.getAnimations()
			.every((animation) => animation.playState !== "running"),
	);
}

async function expectNoAxeViolations(page: Page, screen: string) {
	await settle(page);
	const { violations } = await new AxeBuilder({ page })
		.withTags(WCAG_TAGS)
		.analyze();
	const summary = violations.map(
		(violation) =>
			`${violation.id} (${violation.impact}): ${violation.nodes
				.slice(0, 3)
				.map((node) => node.target.join(" "))
				.join(" | ")}`,
	);
	expect(summary, `${screen}: WCAG violations`).toEqual([]);
}

async function expectReflow(page: Page, screen: string) {
	const viewport = page.viewportSize();
	if (!viewport) return;
	await page.setViewportSize({ width: REFLOW_WIDTH, height: viewport.height });
	// Widgets may re-render for the narrow width (e.g. the compact CAPTCHA).
	await expect
		.poll(
			() =>
				page.evaluate(
					() => document.documentElement.scrollWidth - window.innerWidth,
				),
			{ message: `${screen}: sideways scroll at ${REFLOW_WIDTH} px` },
		)
		.toBe(0);
	await page.setViewportSize(viewport);
}

/**
 * One screen's automated WCAG AA audit: axe, a title naming the page (2.4.2), which
 * axe only checks exists, and reflow (1.4.10).
 */
export async function expectAccessible(
	page: Page,
	screen: string,
	title: string,
): Promise<void> {
	await expect(page, `${screen}: page title`).toHaveTitle(
		new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
	);
	await expectNoAxeViolations(page, screen);
	await expectReflow(page, screen);
}

/** A dialog or menu over the page: axe and reflow (the title is the page's). */
export async function expectAccessibleOverlay(
	page: Page,
	screen: string,
): Promise<void> {
	await expectNoAxeViolations(page, screen);
	await expectReflow(page, screen);
}

/**
 * Presses Tab until the focused element's name matches (WCAG 2.1.1), checking that
 * every element on the way shows where focus is (2.4.7).
 */
export async function tabTo(
	page: Page,
	name: string,
	maxSteps = 80,
): Promise<void> {
	const visited: string[] = [];
	for (let step = 0; step < maxSteps; step++) {
		await page.keyboard.press("Tab");
		await settle(page); // focus rings fade in (transition-all)
		const focused = await page.evaluate(() => {
			const element = document.activeElement as HTMLElement | null;
			if (!element || element === document.body) return null;
			const style = getComputedStyle(element);
			const outline =
				style.outlineStyle !== "none" &&
				Number.parseFloat(style.outlineWidth) > 0;
			// A focus ring is a box-shadow with a spread and a visible colour
			// (components always carry transparent or soft shadows too).
			const ring = [
				...style.boxShadow.matchAll(
					/\w+\(([^)]*)\)\s+-?[\d.]+px\s+-?[\d.]+px\s+[\d.]+px\s+([\d.]+)px/g,
				),
			].some(([, color = "", spread = "0"]) => {
				// rgba(r, g, b, a) or oklab(l a b / a); no alpha means opaque.
				const alpha = color.includes("/")
					? color.split("/")[1]
					: color.split(",")[3];
				return Number(spread) > 0 && Number(alpha ?? 1) > 0;
			});
			return {
				name: (
					element.getAttribute("aria-label") ??
					element.innerText ??
					""
				).trim(),
				visible: outline || ring,
				html: `${element.outerHTML.slice(0, 160)} outline=${style.outlineStyle} ${style.outlineWidth} shadow=${style.boxShadow}`,
			};
		});
		if (!focused) continue;
		visited.push(focused.name);
		expect(
			focused.visible,
			`no visible focus: ${focused.html} (after ${visited.join(" → ")})`,
		).toBe(true);
		if (focused.name === name) return;
	}
	throw new Error(
		`"${name}" not reached with Tab in ${maxSteps} steps: ${visited.join(" → ")}`,
	);
}
