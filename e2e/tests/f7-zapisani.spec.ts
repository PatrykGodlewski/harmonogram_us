import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { latestMessageTo } from "../fixtures/mailpit";
import { open } from "../fixtures/navigation";

test("[F7] organizator dodaje i usuwa osobę, szuka i pobiera CSV @organizator", async ({
	page,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(`org-${base}`, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({
		maxSeats: 2,
		organizerId: organizer.id,
	});
	const q = await createTestUser(`q-${base}`);
	await registerForEvent(event.id, q.id, "pl");
	const pEmail = `p-${base}`;
	await createTestUser(pEmail);
	const waiting = await createTestUser(`w-${base}`);

	await signInAsAdmin(page, `org-${base}`, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	const list = page.getByRole("region", { name: /Zapisani/ });

	// When the organizer adds P by e-mail
	await list.getByRole("button", { name: "Dodaj osobę" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("E-mail").fill(pEmail);
	await dialog.getByRole("button", { name: "Dodaj" }).click();
	await expect(dialog).toBeHidden();
	const pRow = list.getByRole("listitem").filter({ hasText: pEmail });
	await expect(pRow).toBeVisible();
	await expect(pRow.getByText("Lista rezerwowa")).toHaveCount(0);
	const mail = await latestMessageTo(pEmail, { subject: "Zapisano" });
	expect(mail.subject).toContain(event.title);

	// And W joins the (now full) waitlist; removing Q promotes W
	await registerForEvent(event.id, waiting.id, "pl");
	await page.reload();
	const wRow = list.getByRole("listitem").filter({ hasText: `w-${base}` });
	await expect(wRow.getByText("Lista rezerwowa")).toBeVisible();
	await list
		.getByRole("listitem")
		.filter({ hasText: `q-${base}` })
		.getByRole("button", { name: "Usuń" })
		.click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Usuń" })
		.click();
	await expect(list.getByText(`q-${base}`)).toHaveCount(0);
	await expect(wRow.getByText("Lista rezerwowa")).toHaveCount(0);

	// Search narrows the list
	await list.getByLabel("Szukaj").fill(`p-${base.slice(0, 12)}`);
	await expect(
		list.getByRole("listitem").filter({ hasText: `w-${base}` }),
	).toHaveCount(0);
	await expect(pRow).toBeVisible();

	// CSV download has the headers and P as registered
	const downloadPromise = page.waitForEvent("download");
	await list.getByRole("button", { name: "Pobierz CSV" }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toMatch(/^zapisani-.*\.csv$/);
	const csv = await readFile((await download.path()) ?? "", "utf8");
	const lines = csv.replace(/^﻿/, "").split("\r\n");
	expect(lines[0]).toContain('"E-mail"');
	expect(
		lines.some(
			(line) => line.includes(pEmail) && line.includes("Zarejestrowano"),
		),
	).toBe(true);
});
