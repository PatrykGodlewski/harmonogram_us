import { randomBytes } from "node:crypto";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createAgendaItem } from "@repo/db/queries/agenda-items";
import { createAgendaSession } from "@repo/db/queries/agenda-sessions";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import {
	createTestEvent,
	createTestLocation,
	createTestUser,
	uniqueEmail,
} from "../fixtures/data";
import { open } from "../fixtures/navigation";

async function chooseRoom(page: Page, dialog: Locator, room: string) {
	await dialog.getByLabel("Sala / pokój").click();
	await page.getByRole("option", { name: room, exact: true }).click();
}

test("[F33] organizator dzieli program na sesje, wchodzi do sesji i kopiuje ją do innej sali @organizator", async ({
	page,
}, testInfo) => {
	test.slow();
	const tag = randomBytes(3).toString("hex");
	const labA = `Lab 101 ${tag}`;
	const labB = `Lab 205 ${tag}`;
	await createTestLocation(labA);
	await createTestLocation(labB);
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(email, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({ organizerId: organizer.id });
	await signInAsAdmin(page, email, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	const programme = page.getByRole("region", { name: "Program" });

	// A session with its theme, time and room
	await programme.getByRole("button", { name: "Dodaj sesję" }).click();
	let dialog = page.getByRole("dialog");
	await dialog.getByLabel("Tytuł").fill("Ćwiczenia");
	await dialog.getByLabel("Opis").fill("Zajęcia w laboratorium");
	await dialog.getByLabel("Godzina rozpoczęcia").fill("10:00");
	await dialog.getByLabel("Godzina zakończenia").fill("12:00");
	await chooseRoom(page, dialog, labA);
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();
	const original = programme
		.getByRole("listitem")
		.filter({ hasText: "Ćwiczenia" });
	await expect(original).toContainText(`10:00–12:00 · ${labA}`);

	// Inside the session: its own programme, starting in its room
	await original.getByRole("link", { name: "Otwórz sesję Ćwiczenia" }).click();
	await expect(page.getByRole("heading", { name: "Ćwiczenia" })).toBeVisible();
	const sessionProgramme = page.getByRole("region", { name: "Program sesji" });
	for (const [title, start, end] of [
		["Mikroskopy", "10:00", "10:50"],
		["Pomiary", "11:00", "11:50"],
	] as const) {
		await sessionProgramme.getByRole("button", { name: "Dodaj punkt" }).click();
		dialog = page.getByRole("dialog");
		await dialog.getByLabel("Tytuł").fill(title);
		await dialog.getByLabel("Godzina rozpoczęcia").fill(start);
		await dialog.getByLabel("Godzina zakończenia").fill(end);
		await dialog.getByRole("button", { name: "Zapisz" }).click();
		await expect(dialog).toBeHidden();
	}
	await expect(
		sessionProgramme.getByRole("listitem").filter({ hasText: "Pomiary" }),
	).toContainText(`11:00–11:50 · ${labA}`);
	// An item that does not fit the session is refused, with the reason
	await sessionProgramme.getByRole("button", { name: "Dodaj punkt" }).click();
	dialog = page.getByRole("dialog");
	await dialog.getByLabel("Tytuł").fill("Za późno");
	await dialog.getByLabel("Godzina rozpoczęcia").fill("11:30");
	await dialog.getByLabel("Godzina zakończenia").fill("12:30");
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(
		page.getByText("Punkt programu musi mieścić się w godzinach sesji."),
	).toBeVisible();
	await dialog.getByRole("button", { name: "Anuluj" }).click();
	await page.getByRole("link", { name: "Wróć do wydarzenia" }).click();

	// A copy at 13:00 in the other room
	await original
		.getByRole("button", { name: "Kopiuj sesję Ćwiczenia" })
		.click();
	dialog = page.getByRole("dialog");
	await expect(dialog.getByLabel("Tytuł")).toHaveValue("Ćwiczenia");
	await dialog.getByLabel("Godzina rozpoczęcia").fill("13:00");
	await chooseRoom(page, dialog, labB);
	await dialog.getByRole("button", { name: "Kopiuj" }).click();
	await expect(dialog).toBeHidden();
	const copy = programme
		.getByRole("listitem")
		.filter({ hasText: `13:00–15:00 · ${labB}` });
	await expect(copy).toContainText("Ćwiczenia");
	await expect(copy).toContainText("Punkty programu: 2");

	// The copy has the same programme, two hours later, in its room; it is independent
	await copy.getByRole("link", { name: "Otwórz sesję Ćwiczenia" }).click();
	const copied = page
		.getByRole("region", { name: "Program sesji" })
		.getByRole("listitem");
	await expect(copied.filter({ hasText: "Mikroskopy" })).toContainText(
		`13:00–13:50 · ${labB}`,
	);
	await expect(copied.filter({ hasText: "Pomiary" })).toContainText(
		`14:00–14:50 · ${labB}`,
	);
	await copied
		.filter({ hasText: "Mikroskopy" })
		.getByRole("button", { name: "Edytuj" })
		.click();
	dialog = page.getByRole("dialog");
	await dialog.getByLabel("Tytuł").fill("Mikroskopy (B)");
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();
	await page.getByRole("link", { name: "Wróć do wydarzenia" }).click();
	await original
		.filter({ hasText: labA })
		.getByRole("link", { name: "Otwórz sesję Ćwiczenia" })
		.click();
	await expect(
		page
			.getByRole("region", { name: "Program sesji" })
			.getByText("Mikroskopy", {
				exact: true,
			}),
	).toBeVisible();
	await page.getByRole("link", { name: "Wróć do wydarzenia" }).click();

	// Deleting the copy says what goes with it
	await copy.getByRole("button", { name: "Usuń sesję Ćwiczenia" }).click();
	const confirm = page.getByRole("alertdialog");
	await expect(confirm).toContainText("punkty programu (2)");
	await confirm.getByRole("button", { name: "Usuń" }).click();
	await expect(confirm).toBeHidden();
	await expect(
		programme.getByRole("listitem").filter({ hasText: labB }),
	).toHaveCount(0);
	await expect(
		programme.getByRole("listitem").filter({ hasText: labA }),
	).toHaveCount(1);
});

/** An event with an opening, a lectures session in the hall and an exercises session in the lab. */
async function programmeWithSessions() {
	const tag = randomBytes(3).toString("hex");
	const aula = `Aula ${tag}`;
	const lab = `Lab 101 ${tag}`;
	const [aulaId, labId] = [
		await createTestLocation(aula),
		await createTestLocation(lab),
	];
	const event = await createTestEvent({});
	const { db } = await import("@repo/db/client");
	const { events } = await import("@repo/db/schema/events");
	const { eq } = await import("drizzle-orm");
	const [row] = await db
		.select({ date: events.date })
		.from(events)
		.where(eq(events.id, event.id));
	const start = row?.date ?? new Date();
	const hours = (n: number) => new Date(start.getTime() + n * 3_600_000);
	await createAgendaItem({
		eventId: event.id,
		title: "Otwarcie",
		startsAt: hours(0),
		endsAt: hours(0.5),
	});
	const lectures = await createAgendaSession({
		eventId: event.id,
		title: "Wykłady",
		description: "Najnowsze odkrycia",
		color: "violet",
		locationId: aulaId,
		startsAt: hours(1),
		endsAt: hours(3),
	});
	await createAgendaItem({
		eventId: event.id,
		sessionId: lectures.id,
		title: "Grafen",
		startsAt: hours(1),
		endsAt: hours(2),
	});
	const exercises = await createAgendaSession({
		eventId: event.id,
		title: "Ćwiczenia",
		color: "green",
		locationId: labId,
		startsAt: hours(2),
		endsAt: hours(4),
	});
	await createAgendaItem({
		eventId: event.id,
		sessionId: exercises.id,
		title: "Mikroskopy",
		startsAt: hours(2),
		endsAt: hours(3),
		locationId: labId,
	});

	return { event, aula, aulaId, lab, labId };
}

test("[F33] uczestnik widzi program podzielony na sesje @uczestnik", async ({
	page,
}) => {
	const { event, aula, lab } = await programmeWithSessions();
	await open(page, `/pl/events/${event.id}`);
	// Each session is a labelled part of the programme with its theme and place
	const lecturesPart = page.getByRole("region", { name: "Wykłady" });
	await expect(lecturesPart).toContainText("Najnowsze odkrycia");
	await expect(lecturesPart).toContainText(aula);
	await expect(
		lecturesPart.getByRole("listitem").filter({ hasText: "Grafen" }),
	).toContainText(aula);
	await expect(
		page
			.getByRole("region", { name: "Ćwiczenia" })
			.getByRole("listitem")
			.filter({ hasText: "Mikroskopy" }),
	).toContainText(lab);
	// An item outside any session stays outside
	await expect(page.getByText("Otwarcie")).toBeVisible();
	await expect(lecturesPart.getByText("Otwarcie")).toHaveCount(0);

	// The calendar names each session's colour
	await page.getByRole("button", { name: "Kalendarz" }).click();
	const legend = page.getByRole("list", { name: "Sesje" });
	await expect(legend.getByRole("listitem")).toHaveText([
		"Wykłady",
		"Ćwiczenia",
	]);
});

test("[F33] uczestnik zawęża program do jednego miejsca @uczestnik", async ({
	page,
}) => {
	const { event, lab, labId } = await programmeWithSessions();
	await open(page, `/pl/events/${event.id}`);
	const places = page.getByRole("group", { name: "Miejsce" });
	await places.getByRole("button", { name: lab }).click();
	// Only what happens there: its session and items
	await expect(page).toHaveURL(new RegExp(`[?&]place=${labId}`));
	await expect(page.getByRole("region", { name: "Ćwiczenia" })).toBeVisible();
	await expect(page.getByRole("region", { name: "Wykłady" })).toHaveCount(0);
	await expect(page.getByText("Otwarcie")).toHaveCount(0);
	// The link keeps the choice
	await page.reload();
	await expect(
		page
			.getByRole("group", { name: "Miejsce" })
			.getByRole("button", { name: lab }),
	).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("region", { name: "Wykłady" })).toHaveCount(0);
	// And the whole programme comes back
	await page
		.getByRole("group", { name: "Miejsce" })
		.getByRole("button", { name: "Wszystkie miejsca" })
		.click();
	await expect(page.getByRole("region", { name: "Wykłady" })).toBeVisible();
	await expect(page.getByText("Otwarcie")).toBeVisible();
});

test("[F33] uczestnik pokazuje tylko jedną sesję @uczestnik", async ({
	page,
}) => {
	const { event, aula } = await programmeWithSessions();
	await open(page, `/pl/events/${event.id}`);
	await page.getByLabel("Sesja").selectOption({ label: "Ćwiczenia" });
	// Only that session and its items
	await expect(page).toHaveURL(/[?&]session=/);
	await expect(page.getByRole("region", { name: "Ćwiczenia" })).toBeVisible();
	await expect(page.getByRole("region", { name: "Wykłady" })).toHaveCount(0);
	await expect(page.getByText("Otwarcie")).toHaveCount(0);
	// The link keeps the choice
	await page.reload();
	await expect(page.getByLabel("Sesja")).toHaveValue("Ćwiczenia");
	// Together with a place that has none of it, the page says so
	await page
		.getByRole("group", { name: "Miejsce" })
		.getByRole("button", { name: aula })
		.click();
	await expect(
		page.getByText("Nic z programu nie pasuje do wybranych filtrów."),
	).toBeVisible();
	// And the whole programme comes back
	await page.getByLabel("Sesja").selectOption({ label: "Wszystkie sesje" });
	await page
		.getByRole("group", { name: "Miejsce" })
		.getByRole("button", { name: "Wszystkie miejsca" })
		.click();
	await expect(page.getByRole("region", { name: "Wykłady" })).toBeVisible();
	await expect(page.getByText("Otwarcie")).toBeVisible();
});
