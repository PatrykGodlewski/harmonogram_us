import { expect, type Page, test } from "@playwright/test";
import { createTestEvent } from "../fixtures/data";
import { open } from "../fixtures/navigation";

const ENTRY_ANIMATIONS = ["pixel-reveal", "checker-reveal", "stagger-in"];
const ENTRY_SELECTOR =
	".animate-pixel-reveal, .animate-checker-reveal, .stagger-in";

type Recorded = { starts: string[]; origin: number };

/** Records every `animationstart` by name from before the app's scripts run. */
async function recordAnimationStarts(page: Page) {
	await page.addInitScript(() => {
		const record: Recorded = { starts: [], origin: performance.timeOrigin };
		(window as unknown as { recorded: Recorded }).recorded = record;
		document.addEventListener(
			"animationstart",
			(event) => record.starts.push(event.animationName),
			true,
		);
	});
	return () =>
		page.evaluate(() => (window as unknown as { recorded: Recorded }).recorded);
}

/** On a phone the filters fold behind a button. */
async function openFilters(page: Page) {
	const toggle = page.getByRole("button", { name: /^Filtry/ });
	if (await toggle.isVisible()) await toggle.click();
}

test("[F8] animacje wejścia grają tylko przy pierwszym załadowaniu strony @uczestnik", async ({
	page,
}) => {
	const tag = `Ruch ${crypto.randomUUID().slice(0, 6)}`;
	for (let index = 0; index < 3; index++) {
		await createTestEvent({ title: `${tag} A${index}`, startsInDays: 3 });
	}
	const target = await createTestEvent({
		title: `${tag} B0`,
		startsInDays: 3,
	});
	const recorded = await recordAnimationStarts(page);
	const cards = page.locator("#wydarzenia article[data-slot=card]");

	// A full load plays all three; the idle pixel flip is not counted.
	await open(page, `/pl?search=${encodeURIComponent(tag)}`);
	await expect(cards).toHaveCount(4);
	await expect(page.locator("[data-live-list]")).toBeVisible();
	await expect
		.poll(async () => {
			const { starts } = await recorded();
			return ENTRY_ANIMATIONS.filter((name) => starts.includes(name));
		})
		.toEqual(ENTRY_ANIMATIONS);
	await expect
		.poll(() =>
			page.evaluate(
				(names) =>
					document
						.getAnimations()
						.filter(
							(animation) =>
								animation instanceof CSSAnimation &&
								names.includes(animation.animationName) &&
								animation.playState === "running",
						).length,
				ENTRY_ANIMATIONS,
			),
		)
		.toBe(0);
	const loaded = await recorded();
	const entryStarts = (starts: string[]) =>
		starts.filter((name) => ENTRY_ANIMATIONS.includes(name));
	const before = entryStarts(loaded.starts).length;

	// Whatever mounts from now on shows its final state at once.
	const expectNoEntryAnimation = async () => {
		const now = await recorded();
		expect(now.origin, "the document was not reloaded").toBe(loaded.origin);
		expect(entryStarts(now.starts)).toHaveLength(before);
		const running = await page
			.locator(ENTRY_SELECTOR)
			.evaluateAll((elements) =>
				elements
					.map((element) => getComputedStyle(element).animationName)
					.filter((name) => name !== "none"),
			);
		expect(running).toEqual([]);
	};

	await openFilters(page);
	await page.getByRole("combobox").filter({ hasText: "Każdy termin" }).click();
	await page.getByRole("option", { name: "Najbliższe 7 dni" }).click();
	await expect(page).toHaveURL(/whenFilter=7d/);
	await expect(cards).toHaveCount(4);
	await expectNoEntryAnimation();

	await page.getByPlaceholder("Wyszukaj wydarzenie...").fill(`${tag} B`);
	await expect(cards).toHaveCount(1);
	await expect(cards.nth(0)).toContainText(`${tag} B0`);
	await expectNoEntryAnimation();

	await page
		.getByRole("heading", { level: 3, name: target.title })
		.getByRole("link")
		.click();
	await expect(page).toHaveURL(new RegExp(`/events/${target.id}`));
	await expect(
		page.getByRole("heading", { level: 1, name: target.title }),
	).toBeVisible();
	await expect(page.locator(".animate-pixel-reveal").first()).toBeVisible();
	await expectNoEntryAnimation();

	await page.goBack();
	await expect(cards).toHaveCount(1);
	await expect(page.locator("[data-live-list]")).toBeVisible();
	// The elements that mounted again are there, and they carry the classes.
	await expect(page.locator(".animate-pixel-reveal").first()).toBeVisible();
	await expect(
		page.locator(".animate-checker-reveal:visible").first(),
	).toBeVisible();
	await expect(cards.nth(0).locator(".stagger-in")).toHaveCount(1);
	await expectNoEntryAnimation();
});

test("[F8] animacje wejścia są krótkie @uczestnik", async ({ page }) => {
	const tag = `Ruch ${crypto.randomUUID().slice(0, 6)}`;
	const events = [];
	for (let index = 0; index < 6; index++) {
		events.push(
			await createTestEvent({ title: `${tag} ${index}`, startsInDays: 3 }),
		);
	}
	// The group animations of every view transition the page starts, by duration.
	await page.addInitScript(() => {
		const durations: number[] = [];
		(window as unknown as { groups: number[] }).groups = durations;
		const start = document.startViewTransition?.bind(document);
		if (!start) return;
		document.startViewTransition = ((update: Parameters<typeof start>[0]) => {
			const transition = start(update);
			transition.ready.then(() => {
				for (const animation of document.getAnimations()) {
					const effect = animation.effect as KeyframeEffect | null;
					if (effect?.pseudoElement?.startsWith("::view-transition-group")) {
						durations.push(Number(effect.getTiming().duration));
					}
				}
			});
			return transition;
		}) as typeof document.startViewTransition;
	});

	await open(page, `/pl?search=${encodeURIComponent(tag)}`);
	const cards = page.locator("#wydarzenia article[data-slot=card]");
	await expect(cards).toHaveCount(6);
	await expect(page.locator("[data-live-list]")).toBeVisible();

	// Delay + duration of what runs on the element (or under it).
	const timings = (selector: string, index: number, name: string) =>
		page
			.locator(selector)
			.nth(index)
			.evaluate(
				(element, animationName) =>
					element
						.getAnimations({ subtree: true })
						.filter(
							(animation) =>
								animation instanceof CSSAnimation &&
								animation.animationName === animationName,
						)
						.map((animation) => {
							const timing = animation.effect?.getTiming();
							return {
								end: Number(timing?.delay) + Number(timing?.duration),
								duration: Number(timing?.duration),
							};
						}),
				name,
			);

	const heading = await timings(".animate-pixel-reveal", 0, "pixel-reveal");
	expect.soft(heading).toEqual([{ end: 300, duration: 300 }]);
	const board = await timings(
		".animate-checker-reveal:visible",
		0,
		"checker-reveal",
	);
	expect.soft(board).toEqual([{ end: 400, duration: 400 }]);
	const sixth = await timings(
		"#wydarzenia article[data-slot=card]",
		5,
		"stagger-in",
	);
	expect(sixth).toHaveLength(1);
	// A card that mounted while the run was on joins it, so its end may be earlier.
	expect.soft(sixth[0]?.duration).toBe(200);
	expect.soft(sixth[0]?.end).toBeLessThanOrEqual(400);

	// The view transition between the list card and the event page.
	await cards
		.filter({ hasText: `${tag} 0` })
		.getByRole("heading", { level: 3 })
		.getByRole("link")
		.click();
	await expect(page).toHaveURL(new RegExp(`/events/${events[0]?.id}`));
	await expect
		.poll(() =>
			page.evaluate(
				() => (window as unknown as { groups: number[] }).groups.length,
			),
		)
		.toBeGreaterThan(0);
	const groups = await page.evaluate(
		() => (window as unknown as { groups: number[] }).groups,
	);
	expect(new Set(groups)).toEqual(new Set([160]));
});
