import { expect, test } from "@playwright/test";
import { db } from "@repo/db/client";
import {
	registerForAgendaItem,
	registerForEvent,
} from "@repo/db/queries/event-registrations";
import { events } from "@repo/db/schema/events";
import { eq } from "drizzle-orm";
import { signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

test("[F5] konto pokazuje moje nadchodzące i minione zapisy @uczestnik", async ({
	page,
}, testInfo) => {
	// Given a user registered for an upcoming event with one agenda item,
	// waitlisted on a full event, and registered for an event that ended yesterday
	const email = uniqueEmail(testInfo);
	const user = await createTestUser(email);
	const other = await createTestUser(`other-${email}`);
	const upcoming = await createTestEvent({
		startsInDays: 7,
		agenda: [{ title: "Warsztat otwierający" }],
	});
	await registerForAgendaItem(upcoming.itemIds[0] ?? "", user.id, "pl");
	const full = await createTestEvent({ startsInDays: 9, maxSeats: 1 });
	await registerForEvent(full.id, other.id, "pl");
	await registerForEvent(full.id, user.id, "pl");
	const past = await createTestEvent({ startsInDays: 3 });
	await registerForEvent(past.id, user.id, "pl");
	const yesterday = new Date(Date.now() - 86_400_000);
	await db
		.update(events)
		.set({ date: yesterday, endsAt: new Date(yesterday.getTime() + 3_600_000) })
		.where(eq(events.id, past.id));

	// When they open their account
	await signInByEmail(page, email);
	await open(page, "/pl/account");

	// Then upcoming and past registrations are listed with their state
	const upcomingSection = page.getByRole("region", { name: "Nadchodzące" });
	const upcomingCard = upcomingSection
		.getByRole("listitem")
		.filter({ hasText: upcoming.title });
	await expect(upcomingCard.getByText("Zarejestrowano")).toBeVisible();
	await expect(upcomingCard.getByText("Warsztat otwierający")).toBeVisible();
	await expect(
		upcomingSection
			.getByRole("listitem")
			.filter({ hasText: full.title })
			.getByText("Lista rezerwowa (pozycja 1)"),
	).toBeVisible();
	const pastCard = page
		.getByRole("region", { name: "Minione" })
		.getByRole("listitem")
		.filter({ hasText: past.title });
	await expect(pastCard).toBeVisible();
	await expect(
		pastCard.getByRole("button", { name: "Wypisz się" }),
	).toHaveCount(0);

	// And withdrawing removes the upcoming registration
	await upcomingCard.getByRole("button", { name: "Wypisz się" }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Wypisz się" })
		.click();
	await expect(
		upcomingSection.getByRole("listitem").filter({ hasText: upcoming.title }),
	).toHaveCount(0);
});
