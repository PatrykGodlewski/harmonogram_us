import { expect, test } from "@playwright/test";
import { createTestEvent } from "../fixtures/data";
import { open } from "../fixtures/navigation";

test("[F8] nowy wygląd: pasek skrótów zatrzymuje się i filtruje listę @uczestnik", async ({
	page,
}) => {
	await createTestEvent({ startsInDays: 2 });
	await open(page, "/pl");

	const band = page.getByRole("navigation", { name: "Najbliższe wydarzenia" });
	await expect(band).toBeVisible();
	// Moving content can be paused (WCAG 2.2.2).
	const pause = band.getByRole("button", { name: "Zatrzymaj pasek" });
	await pause.click();
	await expect(pause).toHaveAttribute("aria-pressed", "true");
	// Only the first copy of the loop is reachable; it filters the list.
	await band.getByRole("link", { name: /Najbliższe 7 dni/ }).click();
	await expect(page).toHaveURL(/whenFilter=7d/);
	await expect(
		page.getByRole("heading", { level: 2, name: "Wydarzenia" }),
	).toBeVisible();
});

test("[F8] nowy wygląd: ograniczony ruch zatrzymuje animacje @uczestnik", async ({
	browser,
}) => {
	const context = await browser.newContext({ reducedMotion: "reduce" });
	const page = await context.newPage();
	await open(page, "/pl");

	const band = page.getByRole("navigation", { name: "Najbliższe wydarzenia" });
	await expect(band).toBeVisible();
	await expect(
		band.getByRole("button", { name: "Zatrzymaj pasek" }),
	).toBeHidden();
	const moving = await page
		.locator(".animate-marquee, .animate-pixel-reveal, .animate-pixel-flip")
		.evaluateAll(
			(elements) =>
				elements.filter(
					(element) => getComputedStyle(element).animationName !== "none",
				).length,
		);
	expect(moving).toBe(0);
	await context.close();
});
