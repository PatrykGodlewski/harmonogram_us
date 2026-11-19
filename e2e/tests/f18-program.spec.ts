import { expect, test } from "@playwright/test";
import { signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

test("[F18] program w widoku listy i kalendarza @uczestnik", async ({
	page,
}, testInfo) => {
	// Given an event with an opening and two parallel limited workshops
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	const event = await createTestEvent({
		maxSeats: 10,
		agenda: [
			{ title: "Otwarcie", startHour: 0, durationMinutes: 60 },
			{ title: "Warsztat A", startHour: 1.5, durationMinutes: 90, maxSeats: 2 },
			{ title: "Warsztat B", startHour: 1.5, durationMinutes: 90, maxSeats: 2 },
		],
	});
	await signInByEmail(page, email);
	await open(page, `/pl/events/${event.id}`);

	// The list is the default view
	await expect(
		page.getByRole("listitem").filter({ hasText: "Otwarcie" }),
	).toBeVisible();

	// When they switch to the calendar
	await page.getByRole("button", { name: "Kalendarz" }).click();
	await expect(page).toHaveURL(/agenda=calendar/);

	// Then the parallel workshops sit side by side, inside the window
	const a = page.getByRole("button", { name: /Warsztat A/ });
	const b = page.getByRole("button", { name: /Warsztat B/ });
	await expect(a).toBeVisible();
	await expect(b).toBeVisible();
	// Measure once the layout is stable (the server-rendered view is replaced by the live one).
	const layout = async () => {
		const [boxA, boxB] = [await a.boundingBox(), await b.boundingBox()];
		const width = page.viewportSize()?.width ?? 0;
		return {
			sameRow: boxA !== null && boxA.y === boxB?.y,
			sideBySide: boxA !== null && boxB !== null && boxA.x !== boxB.x,
			inside:
				boxA !== null &&
				boxB !== null &&
				boxA.x + boxA.width <= width &&
				boxB.x + boxB.width <= width,
		};
	};
	await expect
		.poll(layout)
		.toEqual({ sameRow: true, sideBySide: true, inside: true });

	// And registering from the calendar works like in the list
	await a.click();
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByText("Wolne miejsca: 2 / 2")).toBeVisible();
	await dialog.getByRole("button", { name: "Zarejestruj się" }).click();
	await expect(dialog.getByText("Wolne miejsca: 1 / 2")).toBeVisible();

	// And the calendar view survives a reload
	await page.reload();
	await page.locator("html[data-hydrated=true]").waitFor();
	await expect(page.getByRole("button", { name: /Warsztat B/ })).toBeVisible();
});

test("[F18] program pokazuje bieżącą godzinę w liście i w kalendarzu @uczestnik", async ({
	page,
}) => {
	// Given an event that started 30 minutes ago: one item running now, one later
	const event = await createTestEvent({
		startsInDays: -30 / (24 * 60),
		agenda: [
			{ title: "Trwa teraz", startHour: 0, durationMinutes: 90 },
			{ title: "Później", startHour: 2, durationMinutes: 30 },
		],
	});
	await open(page, `/pl/events/${event.id}`);

	// Then the list marks "now" between the running item and the later one
	const now = page.getByRole("separator", { name: /^Teraz/ });
	await expect(now).toBeVisible();
	// Read the order once the live list has replaced the server-rendered one.
	const neighbours = async () => {
		const order = await page
			.locator("ol > li")
			.evaluateAll((items) => items.map((item) => item.textContent ?? ""));
		const at = order.findIndex((text) => text.startsWith("Teraz"));
		return {
			before: at > 0 && (order[at - 1] ?? "").includes("Trwa teraz"),
			after: at >= 0 && (order[at + 1] ?? "").includes("Później"),
		};
	};
	await expect.poll(neighbours).toEqual({ before: true, after: true });

	// And the calendar shows a line at the current time
	await page.getByRole("button", { name: "Kalendarz" }).click();
	await expect(page.getByRole("separator", { name: /^Teraz/ })).toBeVisible();
});

test("[F18] bieżąca godzina w kalendarzu zmienia się z każdą minutą @uczestnik", async ({
	page,
}) => {
	// Given an event running now, opened 5 s after a full minute
	const event = await createTestEvent({
		startsInDays: -30 / (24 * 60),
		agenda: [{ title: "Trwa teraz", startHour: 0, durationMinutes: 90 }],
	});
	const minuteStart = Math.floor(Date.now() / 60_000) * 60_000;
	await page.clock.install({ time: new Date(minuteStart + 5_000) });
	await open(page, `/pl/events/${event.id}?agenda=calendar`);
	const label = (date: Date) =>
		`Teraz, ${new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" }).format(date)}`;
	await expect(
		page.getByRole("separator", { name: label(new Date(minuteStart)) }),
	).toBeVisible();

	// When the clock passes the next full minute
	await page.clock.runFor(55_200);

	// Then the line shows the new minute right away, without a reload
	await expect(
		page.getByRole("separator", {
			name: label(new Date(minuteStart + 60_000)),
		}),
	).toBeVisible({ timeout: 1_000 });
});
