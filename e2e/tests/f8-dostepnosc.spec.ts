import { randomBytes } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { createEventQuestion } from "@repo/db/queries/event-questions";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import {
	expectAccessible,
	expectAccessibleOverlay,
	tabTo,
} from "../fixtures/a11y";
import { adminUrl, signInAsAdmin, signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { latestMessageTo } from "../fixtures/mailpit";
import { open } from "../fixtures/navigation";

/** Root titles: the home pages are the site itself. */
const SITE = "Rejestracja na wydarzenia uczelniane | Studenci";
const PANEL = "Rejestracja na wydarzenia uczelniane | Admin";

async function audit(page: Page, url: string, screen: string, title: string) {
	await open(page, url);
	await expectAccessible(page, screen, title);
}

test("[F8] publiczne ekrany spełniają WCAG AA @uczestnik", async ({ page }) => {
	const event = await createTestEvent({ agenda: [{ title: "Otwarcie" }] });

	await audit(page, "/pl", "lista", SITE);
	await audit(page, `/pl/events/${event.id}`, "wydarzenie", event.title);
	await audit(page, "/pl/login", "logowanie", "Logowanie");
	await audit(page, "/pl/signup", "rejestracja", "Rejestracja");
	await audit(page, "/pl/privacy", "dane osobowe", "Informacja o danych");
	await audit(
		page,
		"/pl/accessibility",
		"deklaracja",
		"Deklaracja dostępności",
	);
	await audit(
		page,
		"/en/accessibility",
		"statement",
		"Accessibility statement",
	);
});

test("[F8] ekrany zalogowanego uczestnika spełniają WCAG AA @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const user = await createTestUser(email);
	const registered = await createTestEvent({});
	await registerForEvent(registered.id, user.id, "pl");
	const withQuestions = await createTestEvent({});
	await createEventQuestion({
		eventId: withQuestions.id,
		label: "Kierunek studiów",
		kind: "text",
		required: true,
	});

	await signInByEmail(page, email);
	await audit(page, "/pl/account", "konto", "Konto");
	await page.getByRole("link", { name: "Bilet" }).first().click();
	await page.getByRole("heading", { level: 1 }).waitFor();
	await expectAccessible(page, "bilet", "Bilet");

	await audit(
		page,
		`/pl/events/${withQuestions.id}`,
		"wydarzenie (zalogowany)",
		withQuestions.title,
	);
	await page
		.locator("section")
		.first()
		.getByRole("button", { name: "Zarejestruj się" })
		.click();
	await page.getByRole("dialog").waitFor();
	await expectAccessibleOverlay(page, "pytania przy zapisie");
});

test("[F8] ekrany grupy spełniają WCAG AA @uczestnik", async ({
	page,
	browser,
}, testInfo) => {
	const teacher = uniqueEmail(testInfo);
	const student = `s-${teacher}`;
	await createTestUser(teacher);
	const event = await createTestEvent({ maxSeats: 10 });

	await signInByEmail(page, teacher);
	await audit(
		page,
		`/pl/events/${event.id}/groups/new`,
		"zapis grupy",
		"Zapis grupy",
	);
	await page.getByLabel("Liczba miejsc").fill("2");
	await page.getByLabel("Adresy e-mail uczniów").fill(student);
	await page.getByRole("button", { name: "Zarezerwuj miejsca" }).click();
	await page.getByRole("heading", { name: "Grupa", level: 1 }).waitFor();
	await expectAccessible(page, "grupa", "Grupa");
	const joinUrl = await page
		.getByRole("textbox", { name: "Link do dołączenia" })
		.inputValue();

	const visitor = await (
		await browser.newContext({ locale: "pl-PL" })
	).newPage();
	await audit(visitor, joinUrl, "dołączanie", "Dołącz do grupy");
	const invite = (await latestMessageTo(student)).links.find((href) =>
		href.includes("/invite/"),
	);
	expect(invite, "invitation link").toBeTruthy();
	// Invitation e-mails link to the English page (sender-language limitation, see Plan 5).
	await audit(visitor, invite ?? "", "zaproszenie", "Confirm your place");
});

test("[F8] ekrany organizatora spełniają WCAG AA @organizator", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(email, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({
		organizerId: organizer.id,
		agenda: [{ title: "Otwarcie" }],
	});
	await createEventQuestion({
		eventId: event.id,
		label: "Rozmiar koszulki",
		kind: "choice",
		options: ["S", "M"],
	});
	const participant = `p-${email}`;
	const user = await createTestUser(participant);
	await registerForEvent(event.id, user.id, "pl");

	await open(page, adminUrl("/pl/login"));
	await expectAccessible(page, "panel: logowanie", "Logowanie administratora");
	await signInAsAdmin(page, email, password);
	await audit(page, adminUrl("/pl"), "panel: start", PANEL);
	await audit(page, adminUrl("/pl/events"), "panel: wydarzenia", "Wydarzenia");
	await audit(
		page,
		adminUrl(`/pl/events/${event.id}`),
		"panel: wydarzenie",
		event.title,
	);

	for (const [button, screen] of [
		["Edytuj wydarzenie", "formularz wydarzenia"],
		["Dodaj pytanie", "nowe pytanie"],
		["Wyślij wiadomość", "wiadomość do zapisanych"],
		["Zaproś e-mailem", "zaproszenia"],
		["Dodaj punkt", "punkt programu"],
		["Edytuj odpowiedzi", "odpowiedzi uczestnika"],
		["Duplikuj", "duplikowanie"],
		["Odwołaj wydarzenie", "odwołanie wydarzenia"],
		["Dodaj osobę", "dodawanie osoby"],
	] as const) {
		const trigger = page.getByRole("button", { name: button, exact: true });
		const overlay = page.locator('[role="dialog"], [role="alertdialog"]');
		await trigger.click();
		await overlay.waitFor();
		await expectAccessibleOverlay(page, `panel: ${screen}`);
		await page.keyboard.press("Escape");
		await expect(overlay).toBeHidden();
		// WCAG 2.4.3: closing returns focus to what opened it.
		await expect(trigger, `${screen}: focus back on the button`).toBeFocused();
	}
	await page.getByRole("checkbox", { name: `Zaznacz ${participant}` }).check();
	await page.getByRole("toolbar", { name: "Zaznaczeni" }).waitFor();
	await expectAccessibleOverlay(page, "panel: akcje na zaznaczonych");

	await audit(
		page,
		adminUrl(`/pl/events/${event.id}/scan`),
		"panel: skaner",
		"Skanowanie biletów",
	);
});

test("[F8] ekrany administratora spełniają WCAG AA @organizator", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	await createTestUser(email, { role: "admin", password });

	await signInAsAdmin(page, email, password);
	// The home page carries the monthly activity table for administrators (F15).
	await audit(page, adminUrl("/pl"), "panel: aktywność", PANEL);
	for (const [path, title] of [
		["/pl/users", "Użytkownicy"],
		["/pl/event-types", "Typy wydarzeń"],
		["/pl/event-locations", "Lokalizacje"],
		["/pl/event-faculties", "Wydziały"],
	] as const) {
		await audit(page, adminUrl(path), `panel: ${title}`, title);
	}
	await page.getByRole("button", { name: "Dodaj", exact: true }).click();
	await page.getByRole("dialog").waitFor();
	await expectAccessibleOverlay(page, "panel: nowy wydział");
});

test("[F8] zapis i bilet obsługiwane samą klawiaturą @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	const event = await createTestEvent({});
	await signInByEmail(page, email);

	await open(page, `/pl/events/${event.id}`);
	await tabTo(page, "Zarejestruj się");
	await page.keyboard.press("Enter");
	await expect(
		page.locator("section").first().getByText("Zarejestrowano"),
	).toBeVisible();
	await open(page, "/pl/account");
	await tabTo(page, "Bilet");
	await page.keyboard.press("Enter");
	await expect(page).toHaveURL(/\/pl\/tickets\//);
});

test("[F8] panel organizatora obsługiwany klawiaturą @organizator", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(email, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({ organizerId: organizer.id });

	await signInAsAdmin(page, email, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	await tabTo(page, "Dodaj pytanie");
	await page.keyboard.press("Enter");
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await expect(dialog.locator(":focus")).toHaveCount(1);
	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();
	await expect(
		page.getByRole("button", { name: "Dodaj pytanie" }),
	).toBeFocused();
});

test("[F8] okno otwarte dotknięciem oddaje fokus przyciskowi (Safari) @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	await signInByEmail(page, email);
	await open(page, "/pl/account");

	// Safari and iOS do not focus a button on click or tap: open it the same way.
	const trigger = page.getByRole("button", { name: "Usuń konto", exact: true });
	await trigger.dispatchEvent("click");
	await expect(page.getByRole("alertdialog")).toBeVisible();
	await expectAccessibleOverlay(page, "usuwanie konta");
	await page.keyboard.press("Escape");
	await expect(page.getByRole("alertdialog")).toBeHidden();
	await expect(trigger).toBeFocused();
});

test("[F8] nagłówek mieści się przy szerszej czcionce @uczestnik", async ({
	page,
}) => {
	// Fonts differ between devices: CI's DejaVu Sans is wider than Liberation Sans, and the
	// header overflowed there. Wider text (simulated with letter spacing) must make the
	// header's brand shrink, not push the header past the screen at 320 px.
	await page.setViewportSize({ width: 320, height: 800 });
	for (const url of ["/pl/login", adminUrl("/pl/login")]) {
		await open(page, url);
		await page.addStyleTag({
			content: "header * { letter-spacing: 0.15em !important; }",
		});
		await expect
			.poll(
				() =>
					page.evaluate(() =>
						Math.max(
							...[...document.querySelectorAll("header *")].map(
								(element) => element.getBoundingClientRect().right,
							),
						),
					),
				{ message: `${url}: header wider than the screen` },
			)
			.toBeLessThanOrEqual(320);
	}
});
