import { randomBytes } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { adminUrl, signInAsAdmin, signInByEmail } from "../fixtures/auth";
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
		.locator(
			".animate-marquee, .animate-pixel-reveal, .animate-pixel-flip, .animate-checker-reveal",
		)
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

test("[F8] nowy wygląd: licznik w panelu pokazuje nową liczbę po dodaniu osoby @organizator", async ({
	page,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(`org-${base}`, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({
		maxSeats: 5,
		organizerId: organizer.id,
	});
	const pEmail = `p-${base}`;
	await createTestUser(pEmail);

	await signInAsAdmin(page, `org-${base}`, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	const registered = page.locator(
		"div:has(> dt:text-is('Zapisanych')) [data-slot=number-ticker]",
	);
	const left = page.locator(
		"div:has(> dt:text-is('Wolne miejsca')) [data-slot=number-ticker]",
	);
	// The number alone is the text: assistive technology never gets a second copy.
	await expect(registered).toHaveText("0");
	await expect(left).toHaveText("5");
	const started = await recordAnimations(page);

	const list = page.getByRole("region", { name: /Zapisani/ });
	await list.getByRole("button", { name: "Dodaj osobę" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("E-mail").fill(pEmail);
	await dialog.getByRole("button", { name: "Dodaj" }).click();
	await expect(dialog).toBeHidden();

	await expect(registered).toHaveText("1");
	await expect(left).toHaveText("4");
	// Each changed number steps once; refetches with the same value do not move it.
	const ticks = (await started()).filter((name) =>
		name.startsWith("number-tick"),
	);
	expect(ticks).toEqual([
		"number-tick (number-ticker)",
		"number-tick (number-ticker)",
	]);
});

test("[F8] nowy wygląd: lista wydarzeń to siatka ze wspólnymi liniami @uczestnik", async ({
	page,
}) => {
	const tag = `Siatka ${crypto.randomUUID().slice(0, 6)}`;
	for (let index = 0; index < 7; index++) {
		await createTestEvent({
			title: `${tag} A${index}`,
			startsInDays: 10 + index,
		});
	}
	await createTestEvent({ title: `${tag} B0`, startsInDays: 20 });
	await open(page, `/pl?search=${encodeURIComponent(`${tag} A`)}`);
	const cards = page.locator("#wydarzenia article[data-slot=card]");
	await expect(cards).toHaveCount(7);
	// The interactive list replaces the server-rendered one; focus would be lost in the swap.
	await expect(page.locator("[data-live-list]")).toBeVisible();

	// Neighbours share one line: no gap between their layout boxes (the scroll reveal's
	// transform aside), on one column or two.
	const apart = await cards.evaluateAll((elements) => {
		const [first, second] = elements as HTMLElement[];
		return Math.max(
			second.offsetLeft - (first.offsetLeft + first.offsetWidth),
			second.offsetTop - (first.offsetTop + first.offsetHeight),
		);
	});
	expect(Math.abs(apart)).toBeLessThanOrEqual(1);

	// The filter controls sit in cells with 1 px navy lines, on a desktop and in the phone panel.
	const toggle = page.getByRole("button", { name: /^Filtry/ });
	if (await toggle.isVisible()) await toggle.click();
	const filterCells = page
		.locator("#wydarzenia")
		.getByRole("combobox")
		.locator("xpath=..");
	await expect(filterCells).toHaveCount(6);
	for (const side of ["right", "bottom"]) {
		await expect(filterCells.first()).toHaveCSS(`border-${side}-width`, "1px");
		await expect(filterCells.first()).toHaveCSS(
			`border-${side}-color`,
			"rgb(21, 42, 50)",
		);
	}

	// A focused or hovered card lifts above its neighbours with the hard shadow
	// (touch screens have no hover).
	await cards.nth(0).getByRole("link").first().focus();
	await expect(cards.nth(0)).toHaveCSS("box-shadow", /6px 6px 0px/);
	await expect(cards.nth(0)).toHaveCSS("z-index", "10");
	if (await page.evaluate(() => matchMedia("(hover: hover)").matches)) {
		await cards.nth(1).hover();
		await expect(cards.nth(1)).toHaveCSS("box-shadow", /6px 6px 0px/);
		await expect(cards.nth(1)).toHaveCSS("z-index", "10");
	}

	// The first six cards stagger in; later cards keep the scroll reveal instead.
	const staggers = (index: number) =>
		cards.nth(index).evaluate((card) =>
			card
				.getAnimations({ subtree: true })
				.filter(
					(animation) =>
						(animation as CSSAnimation).animationName === "stagger-in",
				)
				.map((animation) => animation.playState),
		);
	expect(await staggers(5)).toHaveLength(1);
	expect(await staggers(6)).toEqual([]);
	await expect(cards.nth(6).locator(".scroll-reveal")).toHaveCount(1);
	// The contents move inside the cell; the cell itself stays put, so its lines never part.
	const cellsMoving = await cards.evaluateAll(
		(elements) =>
			elements.filter((element) =>
				element
					.getAnimations()
					.some((animation) => animation instanceof CSSAnimation),
			).length,
	);
	expect(cellsMoving).toBe(0);
	await expect.poll(() => staggers(0)).toEqual(["finished"]);

	// New cards after a filter change do not replay it.
	await page.getByPlaceholder("Wyszukaj wydarzenie...").fill(`${tag} B`);
	await expect(cards).toHaveCount(1);
	await expect(cards.nth(0)).toContainText(`${tag} B0`);
	expect(await staggers(0)).not.toContain("running");
});

test("[F8] nowy wygląd: karta przechodzi płynnie w stronę wydarzenia @uczestnik", async ({
	browser,
}) => {
	const event = await createTestEvent({});
	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		const context = await browser.newContext({ reducedMotion });
		const page = await context.newPage();
		// Counts the view-transition animations of every transition the page starts.
		await page.addInitScript(() => {
			const record: number[] = [];
			(window as unknown as { transitions: number[] }).transitions = record;
			const start = document.startViewTransition?.bind(document);
			if (!start) return;
			document.startViewTransition = ((update: Parameters<typeof start>[0]) => {
				const transition = start(update);
				transition.ready.then(
					() =>
						record.push(
							document
								.getAnimations()
								.filter((animation) =>
									(
										animation.effect as KeyframeEffect | null
									)?.pseudoElement?.startsWith("::view-transition"),
								).length,
						),
					() => record.push(-1),
				);
				return transition;
			}) as typeof document.startViewTransition;
		});
		await open(page, `/pl?search=${encodeURIComponent(event.title)}`);
		await page
			.getByRole("heading", { level: 3, name: event.title })
			.getByRole("link")
			.click();
		await expect(page).toHaveURL(new RegExp(`/events/${event.id}`));
		await expect(
			page.getByRole("heading", { level: 1, name: event.title }),
		).toBeVisible();
		const transitions = () =>
			page.evaluate(
				() => (window as unknown as { transitions: number[] }).transitions,
			);
		if (reducedMotion === "reduce") {
			expect((await transitions()).filter((count) => count !== 0)).toEqual([]);
		} else {
			await expect.poll(transitions).toHaveLength(1);
			expect((await transitions())[0]).toBeGreaterThan(0);
		}
		await context.close();
	}
});
