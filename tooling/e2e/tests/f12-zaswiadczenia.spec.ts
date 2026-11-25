import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { db } from "@repo/db/client";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { eventRegistrations } from "@repo/db/schema/event-registrations";
import { events } from "@repo/db/schema/events";
import { and, eq } from "drizzle-orm";
import { extractText } from "unpdf";
import { adminUrl, signInAsAdmin, signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { latestMessageTo } from "../fixtures/mailpit";
import { open } from "../fixtures/navigation";

test("[F12] organizator włącza zaświadczenia @organizator", async ({
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
	await page.getByRole("button", { name: "Edytuj wydarzenie" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Zaświadczenia dla obecnych").check();
	await dialog.getByLabel("Wystawca zaświadczenia").fill("Wydział Fizyki");
	await dialog.getByLabel("Podpis na zaświadczeniu").fill("dr Jan Nowak");
	await dialog.getByLabel("Dodatkowa informacja").fill("Liczba godzin: 4");
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();
	await expect
		.poll(async () => {
			const [row] = await db
				.select({
					on: events.certificatesEnabled,
					issuer: events.certificateIssuer,
					signer: events.certificateSigner,
					note: events.certificateNote,
				})
				.from(events)
				.where(eq(events.id, event.id));
			return row;
		})
		.toEqual({
			on: true,
			issuer: "Wydział Fizyki",
			signer: "dr Jan Nowak",
			note: "Liczba godzin: 4",
		});
});

test("[F12] obecny pobiera zaświadczenie, nieobecny nie @uczestnik", async ({
	browser,
	page,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const present = await createTestUser(`present-${base}`);
	const absent = await createTestUser(`absent-${base}`);
	const event = await createTestEvent({
		title: `Warsztaty łączności ${base.slice(0, 6)}`,
	});
	await registerForEvent(event.id, present.id, "pl");
	await registerForEvent(event.id, absent.id, "pl");
	await db
		.update(eventRegistrations)
		.set({ checkedInAt: new Date() })
		.where(
			and(
				eq(eventRegistrations.eventId, event.id),
				eq(eventRegistrations.userId, present.id),
			),
		);
	// The event took place yesterday, with certificates switched on
	const start = new Date(Date.now() - 26 * 3_600_000);
	await db
		.update(events)
		.set({
			certificatesEnabled: true,
			date: start,
			endsAt: new Date(start.getTime() + 2 * 3_600_000),
		})
		.where(eq(events.id, event.id));

	await signInByEmail(page, `present-${base}`);
	await open(page, "/pl/my-events");
	await page.getByText(/^Archiwum \(\d+\)$/).click();
	const row = page.getByRole("listitem").filter({ hasText: event.title });
	const link = row.getByRole("link", { name: "Pobierz zaświadczenie" });
	const href = await link.getAttribute("href");
	expect(href).toBeTruthy();
	const response = await page.request.get(href ?? "");
	expect(response.headers()["content-type"]).toContain("application/pdf");
	const { text } = await extractText(new Uint8Array(await response.body()), {
		mergePages: true,
	});
	expect(text).toContain("Test User");
	expect(text).toContain(event.title);
	expect(text).toContain(
		new Intl.DateTimeFormat("pl-PL", {
			dateStyle: "long",
			timeZone: "Europe/Warsaw",
		}).format(start),
	);

	// The absentee's registration has no certificate, even by its address
	const [absentRow] = await db
		.select({ id: eventRegistrations.id })
		.from(eventRegistrations)
		.where(eq(eventRegistrations.userId, absent.id));
	const other = await (await browser.newContext()).newPage();
	await signInByEmail(other, `absent-${base}`);
	const refused = await other.request.get(
		`/api/certificates/${absentRow?.id ?? ""}`,
	);
	expect(refused.status()).toBe(404);
	await open(other, "/pl/my-events");
	await expect(
		other.getByRole("link", { name: "Pobierz zaświadczenie" }),
	).toHaveCount(0);
});

test("[F12] po wydarzeniu obecni dostają e-mail z zaświadczeniem", async () => {
	const testInfo = test.info();
	const base = uniqueEmail(testInfo);
	const present = await createTestUser(`present-${base}`);
	const absent = await createTestUser(`absent-${base}`);
	const event = await createTestEvent({});
	await registerForEvent(event.id, present.id, "pl");
	await registerForEvent(event.id, absent.id, "pl");
	await db
		.update(eventRegistrations)
		.set({ checkedInAt: new Date() })
		.where(eq(eventRegistrations.userId, present.id));
	const start = new Date(Date.now() - 5 * 3_600_000);
	await db
		.update(events)
		.set({
			certificatesEnabled: true,
			date: start,
			endsAt: new Date(start.getTime() + 2 * 3_600_000),
		})
		.where(eq(events.id, event.id));

	const { queueReadyCertificateEmails } = await import(
		"@repo/api/notifications/certificates"
	);
	await queueReadyCertificateEmails(new Date());

	const message = await latestMessageTo(`present-${base}`, {
		subject: "Zaświadczenie",
	});
	expect(message.subject).toContain(event.title);
	expect(message.links.some((href) => href.endsWith("/pl/my-events"))).toBe(
		true,
	);
	const response = await fetch(
		`${process.env.E2E_MAILPIT_URL ?? "http://localhost:18025"}/api/v1/search?query=${encodeURIComponent(`to:"absent-${base}" subject:"Zaświadczenie"`)}`,
	);
	expect(
		((await response.json()) as { messages: unknown[] }).messages,
	).toHaveLength(0);
});
