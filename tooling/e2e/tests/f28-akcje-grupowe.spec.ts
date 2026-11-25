import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import readXlsxFile from "read-excel-file/node";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { latestMessageTo, messageCountTo } from "../fixtures/mailpit";
import { open } from "../fixtures/navigation";

test("[F28] akcje grupowe na zaznaczonych i eksport XLSX @organizator", async ({
	page,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(`org-${base}`, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({
		maxSeats: 3,
		organizerId: organizer.id,
	});
	for (const who of ["a", "b", "c", "w"]) {
		const user = await createTestUser(`${who}-${base}`);
		await registerForEvent(event.id, user.id, "pl");
	}
	const cBefore = await messageCountTo(`c-${base}`);

	await signInAsAdmin(page, `org-${base}`, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	const list = page.getByRole("region", { name: /Zapisani/ });
	const bar = page.getByRole("toolbar", { name: "Zaznaczeni" });

	// Select A and B: the action bar appears
	await list.getByRole("checkbox", { name: `Zaznacz a-${base}` }).check();
	await list.getByRole("checkbox", { name: `Zaznacz b-${base}` }).check();
	await expect(bar.getByText("Zaznaczono: 2")).toBeVisible();

	// Check both in
	await bar.getByRole("button", { name: "Odhacz obecność" }).click();
	await expect(list.getByText("Obecni: 2 / 3")).toBeVisible();

	// Message only them
	await list.getByRole("checkbox", { name: `Zaznacz a-${base}` }).check();
	await list.getByRole("checkbox", { name: `Zaznacz b-${base}` }).check();
	await bar.getByRole("button", { name: "Wiadomość" }).click();
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByText("Odbiorcy: zaznaczeni (2)")).toBeVisible();
	await dialog.getByLabel("Temat").fill("Tylko dla was");
	await dialog.getByLabel("Treść").fill("Wiadomość do zaznaczonych.");
	await dialog.getByRole("button", { name: "Wyślij" }).click();
	await expect(page.getByText("Wysłano do 2 osób.")).toBeVisible();
	await latestMessageTo(`a-${base}`, { subject: "Tylko dla was" });
	expect(await messageCountTo(`c-${base}`)).toBe(cBefore);

	// Remove A and B: W moves up from the waitlist
	await list.getByRole("checkbox", { name: `Zaznacz a-${base}` }).check();
	await list.getByRole("checkbox", { name: `Zaznacz b-${base}` }).check();
	await bar.getByRole("button", { name: "Usuń" }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Usuń zaznaczonych (2)" })
		.click();
	await expect(list.getByText(`a-${base}`)).toHaveCount(0);
	const wRow = list.getByRole("listitem").filter({ hasText: `w-${base}` });
	await expect(wRow.getByText("Lista rezerwowa")).toHaveCount(0);

	// The XLSX export has headers and rows
	const downloadPromise = page.waitForEvent("download");
	await list.getByRole("button", { name: "Pobierz XLSX" }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
	const [sheet] = await readXlsxFile((await download.path()) ?? "");
	const rows = sheet?.data ?? [];
	expect(rows[0]).toContain("E-mail");
	expect(rows.some((row) => row.includes(`c-${base}`))).toBe(true);
});
