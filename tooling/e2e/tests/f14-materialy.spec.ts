import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { expectAccessible } from "../fixtures/a11y";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { latestMessageTo } from "../fixtures/mailpit";
import { open } from "../fixtures/navigation";

/** A small PDF-like file with random content, so a match proves the same bytes came back. */
function pdf(name: string) {
	const buffer = Buffer.concat([Buffer.from("%PDF-1.4\n"), randomBytes(2048)]);
	return { name, mimeType: "application/pdf", buffer };
}

async function organizerOf(
	page: Page,
	testInfo: Parameters<typeof uniqueEmail>[0],
	event: Omit<Parameters<typeof createTestEvent>[0], "organizerId"> = {},
) {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(email, {
		role: "organizer",
		password,
	});
	const created = await createTestEvent({
		...event,
		organizerId: organizer.id,
	});
	await signInAsAdmin(page, email, password);
	await open(page, adminUrl(`/pl/events/${created.id}`));
	return created;
}

async function downloadedBytes(
	page: Page,
	link: ReturnType<Page["getByRole"]>,
) {
	const [download] = await Promise.all([
		page.waitForEvent("download"),
		link.click(),
	]);
	return {
		bytes: await readFile(await download.path()),
		name: download.suggestedFilename(),
	};
}

test("[F14] organizator dodaje plik i link, uczestnik pobiera ten sam plik @organizator", async ({
	browser,
	page,
}, testInfo) => {
	const event = await organizerOf(page, testInfo);
	const materials = page.getByRole("region", { name: "Materiały" });
	const file = pdf("Program żółć.pdf");

	await materials.getByLabel("Plik", { exact: true }).setInputFiles(file);
	await materials.getByRole("button", { name: "Dodaj plik" }).click();
	await expect(
		materials.getByRole("link", { name: /Program żółć\.pdf/ }),
	).toBeVisible();

	await materials.getByLabel("Nazwa linku").fill("Nagranie");
	await materials
		.getByLabel("Adres linku")
		.fill("https://example.test/nagranie");
	await materials.getByRole("button", { name: "Dodaj link" }).click();
	await expect(materials.getByRole("link", { name: "Nagranie" })).toBeVisible();

	// A file a browser could run is refused, with a reason
	await materials.getByLabel("Plik", { exact: true }).setInputFiles({
		name: "strona.html",
		mimeType: "text/html",
		buffer: Buffer.from("<script>alert(1)</script>"),
	});
	await materials.getByRole("button", { name: "Dodaj plik" }).click();
	await expect(
		page.getByText("Tego rodzaju pliku nie można dodać.", { exact: false }),
	).toBeVisible();
	await expectAccessible(page, "materiały wydarzenia", event.title);

	// A visitor sees both on the event page and gets the same bytes
	const visitor = await (await browser.newContext()).newPage();
	await open(visitor, `/pl/events/${event.id}`);
	const section = visitor.getByRole("region", { name: "Materiały" });
	await expect(section.getByRole("link", { name: "Nagranie" })).toHaveAttribute(
		"href",
		"https://example.test/nagranie",
	);
	const fileLink = section.getByRole("link", { name: /Program żółć\.pdf/ });
	const href = await fileLink.getAttribute("href");
	const downloaded = await downloadedBytes(visitor, fileLink);
	expect(downloaded.bytes.equals(file.buffer)).toBe(true);
	expect(downloaded.name).toBe("Program żółć.pdf");

	// Removed in the panel: gone from the page, and its link no longer works
	await materials
		.getByRole("button", { name: "Usuń plik Program żółć.pdf" })
		.click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Usuń" })
		.click();
	// The open dialog hides the page from the accessibility tree: check after it closes
	await expect(page.getByRole("alertdialog")).toBeHidden();
	await expect(materials.getByText("Program żółć.pdf")).toHaveCount(0);
	await visitor.reload();
	await expect(
		visitor.getByRole("link", { name: /Program żółć\.pdf/ }),
	).toHaveCount(0);
	const gone = await visitor.request.get(href ?? "/missing", {
		maxRedirects: 0,
	});
	expect(gone.status()).toBe(404);

	// The link is removed too: gone from the panel and the event page
	await materials.getByRole("button", { name: "Usuń link Nagranie" }).click();
	await expect(materials.getByRole("link", { name: "Nagranie" })).toHaveCount(
		0,
	);
	await visitor.reload();
	await expect(visitor.getByRole("link", { name: "Nagranie" })).toHaveCount(0);
});

test("[F14] plik szkicu nie jest dostępny publicznie @organizator", async ({
	page,
}, testInfo) => {
	const event = await organizerOf(page, testInfo, { status: "draft" });
	const materials = page.getByRole("region", { name: "Materiały" });
	const file = pdf("szkic.pdf");
	await materials.getByLabel("Plik", { exact: true }).setInputFiles(file);
	await materials.getByRole("button", { name: "Dodaj plik" }).click();
	const panelLink = materials.getByRole("link", { name: /szkic\.pdf/ });
	await expect(panelLink).toBeVisible();

	const fileId = (await panelLink.getAttribute("href"))?.split("/").pop();
	const publicResponse = await page.request.get(`/api/files/${fileId}`, {
		maxRedirects: 0,
	});
	expect(publicResponse.status()).toBe(404);
	expect(
		(await downloadedBytes(page, panelLink)).bytes.equals(file.buffer),
	).toBe(true);
	void event;
});

test("[F14] plik wydarzenia dla zalogowanych prowadzi do logowania i z powrotem @uczestnik", async ({
	browser,
	page,
}, testInfo) => {
	await organizerOf(page, testInfo, { visibility: "authenticated" });
	const materials = page.getByRole("region", { name: "Materiały" });
	const file = pdf("dla-zalogowanych.pdf");
	await materials.getByLabel("Plik", { exact: true }).setInputFiles(file);
	await materials.getByRole("button", { name: "Dodaj plik" }).click();
	const panelLink = materials.getByRole("link", {
		name: /dla-zalogowanych\.pdf/,
	});
	await expect(panelLink).toBeVisible();
	const fileId = (await panelLink.getAttribute("href"))?.split("/").pop();

	// A signed-out visitor following the file link is asked to sign in; a link without a
	// language prefix opens the site's base language, English
	const visitor = await (await browser.newContext()).newPage();
	await visitor.goto(`/api/files/${fileId}`);
	await expect(visitor).toHaveURL(/\/en\/login\?redirect=/);
	await expect(visitor.locator("html")).toHaveAttribute(
		"data-hydrated",
		"true",
	);
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	await visitor.getByLabel("Email").fill(email);
	await visitor.getByRole("button", { name: "Send secure login link" }).click();
	const message = await latestMessageTo(email);
	const link = message.links.find((href) =>
		href.includes("/magic-link/verify"),
	);
	expect(link, "magic link in the e-mail").toBeTruthy();

	// Signing in leads straight back to the file
	const [download] = await Promise.all([
		visitor.waitForEvent("download"),
		visitor.goto(link ?? "").catch(() => undefined),
	]);
	expect((await readFile(await download.path())).equals(file.buffer)).toBe(
		true,
	);
	expect(download.suggestedFilename()).toBe("dla-zalogowanych.pdf");

	// The way back stays on the site: a path a browser reads as another host is ignored
	await visitor.goto("/login?redirect=/%5Cevil.invalid");
	await expect(visitor).toHaveURL(/\/en\/my-events$/);
});

test("[F19] wystąpienie z prelegentem i plikiem jest na stronie wydarzenia @organizator", async ({
	browser,
	page,
}, testInfo) => {
	const event = await organizerOf(page, testInfo, {
		agenda: [{ title: "Referat o grafenie" }],
	});
	await page
		.getByRole("listitem")
		.filter({ hasText: "Referat o grafenie" })
		.getByRole("button", { name: "Edytuj" })
		.click();
	const dialog = page.getByRole("dialog");
	await dialog.getByRole("button", { name: "Dodaj prelegenta" }).click();
	await dialog.getByLabel("Imię i nazwisko prelegenta 1").fill("dr Anna Nowak");
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();

	const materials = page.getByRole("region", { name: "Materiały" });
	const file = pdf("grafen-slajdy.pdf");
	await materials.getByLabel("Plik", { exact: true }).setInputFiles(file);
	await materials
		.getByLabel("Dotyczy")
		.selectOption({ label: "Referat o grafenie" });
	await materials.getByRole("button", { name: "Dodaj plik" }).click();
	await expect(
		materials.getByRole("listitem").filter({ hasText: "grafen-slajdy.pdf" }),
	).toContainText("Referat o grafenie");

	const visitor = await (await browser.newContext()).newPage();
	await open(visitor, `/pl/events/${event.id}`);
	const item = visitor
		.getByRole("listitem")
		.filter({ hasText: "Referat o grafenie" });
	await expect(item.getByText("dr Anna Nowak")).toBeVisible();
	const fileLink = item.getByRole("link", { name: /grafen-slajdy\.pdf/ });
	expect(
		(await downloadedBytes(visitor, fileLink)).bytes.equals(file.buffer),
	).toBe(true);
	// A programme item's file is not repeated among the event's own materials
	await expect(
		visitor
			.getByRole("region", { name: "Materiały" })
			.getByRole("link", { name: /grafen-slajdy/ }),
	).toHaveCount(0);
});

test("[F14] panel odrzuca zbyt duże żądanie, zanim je przeczyta", async () => {
	// Announces 30 MB and sends nothing: the answer must come from the headers alone
	const status = await new Promise<number>((resolve, reject) => {
		const request = httpRequest(
			adminUrl("/_serverFn/upload"),
			{
				method: "POST",
				headers: { "content-length": String(30 * 1024 * 1024) },
			},
			(response) => {
				resolve(response.statusCode ?? 0);
				response.resume();
				request.destroy();
			},
		);
		request.on("error", reject);
		request.setTimeout(5000, () =>
			reject(new Error("no answer before the body")),
		);
		request.flushHeaders();
	});
	expect(status).toBe(413);
});
