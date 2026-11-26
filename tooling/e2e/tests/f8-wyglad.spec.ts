import { expect, type Page, test } from "@playwright/test";
import { signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
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

/** Every animation that starts on the page from now on, by name and slot. */
async function recordAnimations(page: Page): Promise<() => Promise<string[]>> {
	await page.evaluate(() => {
		const started: string[] = [];
		(window as unknown as { started: string[] }).started = started;
		document.addEventListener(
			"animationstart",
			(event) => {
				const slot = (event.target as Element).getAttribute("data-slot");
				started.push(`${event.animationName} (${slot ?? "?"})`);
			},
			true,
		);
	});
	return () =>
		page.evaluate(() => (window as unknown as { started: string[] }).started);
}

test("[F8] nowy wygląd: ograniczony ruch wyłącza animacje okien i menu @uczestnik", async ({
	browser,
}, testInfo) => {
	const context = await browser.newContext({ reducedMotion: "reduce" });
	const page = await context.newPage();
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	await signInByEmail(page, email);

	await open(page, "/pl/account?tab=privacy");
	const started = await recordAnimations(page);
	await page.getByRole("button", { name: "Usuń konto", exact: true }).click();
	await expect(page.getByRole("alertdialog")).toBeVisible();
	await page.keyboard.press("Escape");
	// Radix waits for an exit animation before it unmounts: with none, the dialog leaves at once.
	await expect(page.locator("[data-slot=alert-dialog-content]")).toHaveCount(0);
	await expect(page.locator("[data-slot=alert-dialog-overlay]")).toHaveCount(0);
	expect(await started()).toEqual([]);

	await open(page, "/pl");
	const startedOnHome = await recordAnimations(page);
	const toggle = page.getByRole("button", { name: "Filtry" });
	if (await toggle.isVisible()) await toggle.click();
	await page.getByRole("combobox").filter({ hasText: "Wydział" }).click();
	await expect(page.getByRole("listbox")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("listbox")).toHaveCount(0);
	expect(await startedOnHome()).toEqual([]);

	// The skeleton shows only while data loads: hold the class itself to the guard.
	const pulse = await page.evaluate(() => {
		const element = document.createElement("div");
		element.className = "animate-pulse";
		document.body.append(element);
		const name = getComputedStyle(element).animationName;
		element.remove();
		return name;
	});
	expect(pulse).toBe("none");
	await context.close();
});
