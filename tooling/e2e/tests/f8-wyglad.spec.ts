import { randomBytes } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { db } from "@repo/db/client";
import { createAgendaItem } from "@repo/db/queries/agenda-items";
import { createAgendaSession } from "@repo/db/queries/agenda-sessions";
import { events } from "@repo/db/schema/events";
import { eq } from "drizzle-orm";
import { adminUrl, signInAsAdmin, signInByEmail } from "../fixtures/auth";
import {
	createTestEvent,
	createTestLocation,
	createTestUser,
	uniqueEmail,
} from "../fixtures/data";
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

test("[F8] nowy wygląd: fakty wydarzenia w trzech komórkach @uczestnik", async ({
	page,
}) => {
	const locationId = await createTestLocation("Aula Kopernika");
	const onsite = await createTestEvent({ maxSeats: 7 });
	await db
		.update(events)
		.set({ locationId, room: "B-204" })
		.where(eq(events.id, onsite.id));
	const online = await createTestEvent({
		attendanceMode: "online",
		onlineUrl: "https://example.com/spotkanie",
	});
	const hybrid = await createTestEvent({ attendanceMode: "hybrid" });
	await db.update(events).set({ room: "C-1" }).where(eq(events.id, hybrid.id));

	// A description list under the cover: date, place, seats, one cell each.
	const fact = (term: string) =>
		page.locator(`dl > div:has(> dt:text-is('${term}')) > dd`);

	await open(page, `/pl/events/${onsite.id}`);
	const summary = page.locator("section").first();
	await expect(page.locator("dl > div")).toHaveCount(3);
	await expect(fact("Termin")).toHaveText(/\d{4}.*\d{2}:\d{2}/);
	await expect(fact("Miejsce")).toContainText("Aula Kopernika");
	await expect(fact("Miejsce")).toContainText("sala B-204");
	await expect(fact("Miejsca")).toHaveText("Wolne miejsca: 7 / 7");
	// Cells are divided by 1 px navy lines: above the second and third on a phone, beside them
	// on a desktop.
	const dividers = await page.locator("dl > div").evaluateAll((elements) =>
		elements.slice(1).map((element) => {
			const style = getComputedStyle(element);
			return [style.borderTop, style.borderLeft];
		}),
	);
	for (const [top, left] of dividers) {
		expect(
			[top, left].some((edge) => edge === "1px solid rgb(21, 42, 50)"),
		).toBe(true);
	}
	// The count has a ticker and is the page's one live region for it, in the seats cell.
	await expect(fact("Miejsca").locator("[data-slot=number-ticker]")).toHaveText(
		"7",
	);
	await expect(summary.locator("[aria-live]")).toHaveCount(1);
	await expect(fact("Miejsca")).toHaveAttribute("aria-live", "polite");

	await open(page, `/pl/events/${online.id}`);
	await expect(fact("Miejsce")).toHaveText("Online");

	await open(page, `/pl/events/${hybrid.id}`);
	await expect(fact("Miejsce")).toHaveText("sala C-1, Online");
});

test("[F8] nowy wygląd: sesja rozwija się z animacją, a przy ograniczonym ruchu od razu @uczestnik", async ({
	browser,
}) => {
	// More than ten items: the programme starts with its sessions folded.
	const event = await createTestEvent({});
	const [row] = await db
		.select({ date: events.date })
		.from(events)
		.where(eq(events.id, event.id));
	const start = new Date(row?.date ?? Date.now());
	start.setUTCDate(start.getUTCDate() + 1);
	start.setUTCHours(8, 0, 0, 0);
	const at = (minutes: number) => new Date(start.getTime() + minutes * 60_000);
	const session = await createAgendaSession({
		eventId: event.id,
		title: "Wykłady",
		startsAt: at(0),
		endsAt: at(180),
	});
	for (let index = 0; index < 11; index++) {
		await createAgendaItem({
			eventId: event.id,
			sessionId: session.id,
			title: `Wykład ${index + 1}`,
			startsAt: at(index * 15),
			endsAt: at(index * 15 + 10),
		});
	}

	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		const context = await browser.newContext({ reducedMotion });
		const page = await context.newPage();
		await open(page, `/pl/events/${event.id}`);
		const region = page.getByRole("region", { name: "Wykłady" });
		const toggle = region.getByRole("button", {
			name: "Pokaż punkty programu (11)",
		});
		const first = region.getByText("Wykład 1", { exact: true });
		await expect(toggle).toHaveAttribute("aria-expanded", "false");
		await expect(first).toBeHidden();
		const blockId = await toggle.getAttribute("aria-controls");
		expect(blockId).toBeTruthy();

		// Every transition that starts on the block the button controls, with its length in seconds.
		await page.evaluate((id) => {
			const started: { property: string; seconds: number }[] = [];
			(window as unknown as { started: typeof started }).started = started;
			document.addEventListener(
				"transitionrun",
				(event) => {
					const target = event.target as Element;
					if (target.id !== id) return;
					const seconds = Number.parseFloat(
						getComputedStyle(target).transitionDuration,
					);
					started.push({ property: event.propertyName, seconds });
				},
				true,
			);
		}, blockId);
		const transitions = () =>
			page.evaluate(
				() =>
					(
						window as unknown as {
							started: { property: string; seconds: number }[];
						}
					).started,
			);

		await toggle.click();
		await expect(
			region.getByRole("button", { name: "Ukryj punkty programu" }),
		).toHaveAttribute("aria-expanded", "true");
		await expect(first).toBeVisible();
		await region.getByRole("button", { name: "Ukryj punkty programu" }).click();
		await expect(toggle).toHaveAttribute("aria-expanded", "false");
		await expect(first).toBeHidden();

		const moved = (await transitions())
			.filter((transition) => transition.seconds > 0.001)
			.map((transition) => transition.property);
		if (reducedMotion === "reduce") {
			// Instant: no transition on the block lasts any time.
			expect(moved).toEqual([]);
		} else {
			// Opening and closing each run the height transition.
			expect(
				moved.filter((property) => property === "grid-template-rows"),
			).toHaveLength(2);
		}
		await context.close();
	}
});
