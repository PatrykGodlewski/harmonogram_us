import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { deleteAccount, exportAccountData } from "../src/queries/account-data";
import { registerForEvent } from "../src/queries/event-registrations";
import { authUsers } from "../src/schema/better-auth";
import { collectChanges, createEvent, createUser, resetDb, stateOf } from "./helpers";

beforeEach(resetDb);

describe("account data", () => {
	it("exports the profile and registrations with event titles", async () => {
		const userId = await createUser("me@x.test");
		const eventId = await createEvent();
		await registerForEvent(eventId, userId, "pl");

		const data = await exportAccountData(userId);

		expect(data.profile.email).toBe("me@x.test");
		expect(data.registrations).toHaveLength(1);
		expect(data.registrations[0]).toMatchObject({
			state: "registered",
			event: { id: eventId, title: "Test event" },
		});
	});

	it("deleting an account frees its place for the waitlist, then removes the user", async () => {
		const eventId = await createEvent({ maxSeats: 1 });
		const leaving = await createUser();
		const waiting = await createUser();
		await registerForEvent(eventId, leaving, "pl");
		await registerForEvent(eventId, waiting, "pl");
		const { changes, hooks } = collectChanges();

		await deleteAccount(leaving, hooks);

		expect(await stateOf(eventId, waiting)).toBe("registered");
		expect(changes.map((c) => c.change)).toEqual(["promoted"]);
		const [row] = await db.select().from(authUsers).where(eq(authUsers.id, leaving));
		expect(row).toBeUndefined();
	});
});
