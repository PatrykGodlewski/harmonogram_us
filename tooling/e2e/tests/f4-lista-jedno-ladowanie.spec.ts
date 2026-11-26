import { expect, test } from "@playwright/test";
import { signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

type CardRecord = {
	/** Every card element present now. */
	cards: number;
	/** Cards present now that were not parsed from the server HTML. */
	notFromServer: number;
	/** Card elements taken out of the document since the page started. */
	removed: number;
	/** The most starts of one animation on one element, by animation name. */
	mostStarts: Record<string, number>;
};

test("[F4] lista wydarzeń powstaje raz: karty z serwera zostają po uruchomieniu strony @uczestnik", async ({
	page,
}) => {
	await createTestEvent({ startsInDays: 2 });
	// Runs before the page's own scripts: records every card from its first appearance.
	await page.addInitScript(() => {
		const CARD = 'article[data-slot="card"]';
		// Elements created by scripts go through createElement; the HTML parser's do not.
		const created = new WeakSet<Element>();
		const createElement = Document.prototype.createElement;
		Document.prototype.createElement = function (
			this: Document,
			...args: Parameters<typeof createElement>
		) {
			const element = createElement.apply(this, args);
			created.add(element);
			return element;
		} as typeof createElement;

		const fromServer = new WeakMap<Element, boolean>();
		const record = {
			removed: 0,
			starts: new Map<Element, Map<string, number>>(),
		};
		const cardsIn = (node: Node): Element[] =>
			node instanceof Element
				? [
						...(node.matches(CARD) ? [node] : []),
						...node.querySelectorAll(CARD),
					]
				: [];
		new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					for (const card of cardsIn(node)) {
						if (!fromServer.has(card)) fromServer.set(card, !created.has(card));
					}
				}
				for (const node of mutation.removedNodes) {
					record.removed += cardsIn(node).length;
				}
			}
		}).observe(document, { childList: true, subtree: true });
		document.addEventListener(
			"animationstart",
			(event) => {
				const element = event.target as Element;
				const byName = record.starts.get(element) ?? new Map<string, number>();
				byName.set(
					event.animationName,
					(byName.get(event.animationName) ?? 0) + 1,
				);
				record.starts.set(element, byName);
			},
			true,
		);
		(window as unknown as { cardRecord: () => CardRecord }).cardRecord = () => {
			const cards = [...document.querySelectorAll(CARD)];
			const mostStarts: Record<string, number> = {};
			for (const byName of record.starts.values()) {
				for (const [name, count] of byName) {
					mostStarts[name] = Math.max(mostStarts[name] ?? 0, count);
				}
			}
			return {
				cards: cards.length,
				notFromServer: cards.filter((card) => fromServer.get(card) !== true)
					.length,
				removed: record.removed,
				mostStarts,
			};
		};
	});

	await open(page, "/pl");
	// Past the old swap: every script chunk is in, and the cards' entry animations have run.
	await page.waitForLoadState("networkidle");
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					document
						.getAnimations()
						.filter(
							(animation) =>
								animation instanceof CSSAnimation &&
								["checker-reveal", "stagger-in"].includes(
									animation.animationName,
								) &&
								animation.playState === "running",
						).length,
			),
		)
		.toBe(0);

	const record = await page.evaluate(() =>
		(window as unknown as { cardRecord: () => CardRecord }).cardRecord(),
	);
	const summary = JSON.stringify(record);
	expect(record.cards, summary).toBeGreaterThan(0);
	expect(record.notFromServer, summary).toBe(0);
	expect(record.removed, summary).toBe(0);
	expect(record.mostStarts["checker-reveal"] ?? 0, summary).toBeLessThanOrEqual(
		1,
	);
	expect(record.mostStarts["stagger-in"] ?? 0, summary).toBeLessThanOrEqual(1);
});

test("[F4] karta wydarzenia prowadzi do szczegółów i nie ma na niej zapisu @uczestnik", async ({
	page,
}, testInfo) => {
	// Given a signed-in visitor and an open event on the list
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	const event = await createTestEvent({
		title: `Karta ${crypto.randomUUID().slice(0, 6)}`,
		maxSeats: 5,
	});
	await signInByEmail(page, email);
	const listUrl = `/pl?search=${encodeURIComponent(event.title)}`;
	await open(page, listUrl);
	const card = page
		.locator('article[data-slot="card"]')
		.filter({ hasText: event.title });
	await expect(card).toBeVisible();

	// The card offers no registration: no button, one link named by the title
	await expect.soft(card.getByRole("button")).toHaveCount(0);
	await expect.soft(card.getByRole("link")).toHaveCount(1);
	await expect.soft(card.getByRole("link")).toHaveAccessibleName(event.title);

	// When they click the card away from its title (forced: the card's link lies over the line)
	await card.getByText("5 / 5 wolnych miejsc").click({ force: true });
	// Then the event page opens
	await expect(page).toHaveURL(new RegExp(`/pl/events/${event.id}$`));
	await expect(
		page.getByRole("heading", { level: 1, name: event.title }),
	).toBeVisible();

	// When they register there and return to the list
	const summary = page.locator("section").first();
	await summary.getByRole("button", { name: "Zarejestruj się" }).click();
	await expect(summary.getByText("Zarejestrowano")).toBeVisible();
	await page.goBack();
	await expect(page).toHaveURL(/\/pl\?search=/);
	// Then the card shows their registration, still without a button
	await expect(card.getByText("Zarejestrowano")).toBeVisible();
	await expect(card.getByRole("button")).toHaveCount(0);
	// And so does the server-rendered page
	await open(page, listUrl);
	await expect(card.getByText("Zarejestrowano")).toBeVisible();
});
