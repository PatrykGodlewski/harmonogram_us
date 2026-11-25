import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { db } from "@repo/db/client";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { eventRegistrations } from "@repo/db/schema/event-registrations";
import { and, eq } from "drizzle-orm";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { SCANNER_TICKET_CODE } from "../fixtures/fake-camera";
import { open } from "../fixtures/navigation";

async function organizerWithEvent(base: string) {
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(`org-${base}`, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({ organizerId: organizer.id });
	return { email: `org-${base}`, password, event };
}

test("[F11] skan biletu odhacza obecność @skaner", async ({
	page,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const { email, password, event } = await organizerWithEvent(base);
	const guest = await createTestUser(`gosc-${base}`);
	// The fake camera always shows the same ticket: give it to this registration.
	await db
		.delete(eventRegistrations)
		.where(eq(eventRegistrations.ticketCode, SCANNER_TICKET_CODE));
	await registerForEvent(event.id, guest.id, "pl");
	await db
		.update(eventRegistrations)
		.set({ ticketCode: SCANNER_TICKET_CODE })
		.where(
			and(
				eq(eventRegistrations.eventId, event.id),
				eq(eventRegistrations.userId, guest.id),
			),
		);

	await signInAsAdmin(page, email, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	await page.getByRole("link", { name: "Skanuj bilety" }).click();
	await expect(page.getByText("Obecny: Test User")).toBeVisible({
		timeout: 15_000,
	});

	// The same ticket a few seconds later says it was already checked in
	await expect(page.getByText(/Już odhaczono o \d{2}:\d{2}/)).toBeVisible({
		timeout: 15_000,
	});

	await open(page, adminUrl(`/pl/events/${event.id}`));
	await expect(page.getByText("Obecni: 1 / 1")).toBeVisible();
	await expect(
		page
			.getByRole("listitem")
			.filter({ hasText: `gosc-${base}` })
			.getByRole("checkbox", { name: "Obecność" }),
	).toBeChecked();
});

test("[F11] ręczne odhaczenie i obecność w CSV @organizator", async ({
	page,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const { email, password, event } = await organizerWithEvent(base);
	const guest = await createTestUser(`gosc-${base}`);
	await registerForEvent(event.id, guest.id, "pl");

	await signInAsAdmin(page, email, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	const attendance = page
		.getByRole("listitem")
		.filter({ hasText: `gosc-${base}` })
		.getByRole("checkbox", { name: "Obecność" });
	await attendance.check();
	await expect(page.getByText("Obecni: 1 / 1")).toBeVisible();

	const downloadPromise = page.waitForEvent("download");
	await page.getByRole("button", { name: "Pobierz CSV" }).click();
	const csv = await readFile(
		(await (await downloadPromise).path()) ?? "",
		"utf8",
	);
	const lines = csv.replace(/^﻿/, "").split("\r\n");
	expect(lines[0]).toContain('"Obecność"');
	expect(
		lines.find((line) => line.includes(`gosc-${base}`))?.endsWith('"tak"'),
	).toBe(true);
});
