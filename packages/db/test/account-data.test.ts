import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { deleteAccount, exportAccountData } from "../src/queries/account-data";
import { registerForEvent } from "../src/queries/event-registrations";
import { authUsers } from "../src/schema/better-auth";
import { eventOrganizers } from "../src/schema/event-organizers";
import {
	collectChanges,
	createEvent,
	createUser,
	rejectionCode,
	resetDb,
	stateOf,
} from "./helpers";

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

	it("exports the answers given at registration", async () => {
		const { createEventQuestion } = await import("../src/queries/event-questions");
		const userId = await createUser();
		const eventId = await createEvent();
		const question = await createEventQuestion({ eventId, label: "Kierunek", kind: "text" });
		await registerForEvent(eventId, userId, "pl", undefined, {
			answers: { [question.id]: "Fizyka" },
		});
		const data = await exportAccountData(userId);
		expect(data.registrations[0]?.answers).toEqual([{ question: "Kierunek", answer: "Fizyka" }]);
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

	it("refuses while the person is the only organizer of an upcoming event", async () => {
		const organizer = await createUser();
		const eventId = await createEvent();
		await db.insert(eventOrganizers).values({ eventId, userId: organizer });
		expect(await rejectionCode(deleteAccount(organizer))).toBe("SOLE_ORGANIZER");
		const co = await createUser();
		await db.insert(eventOrganizers).values({ eventId, userId: co });
		await deleteAccount(organizer);
		const [row] = await db.select().from(authUsers).where(eq(authUsers.id, organizer));
		expect(row).toBeUndefined();
	});

	it("refuses to delete the last admin", async () => {
		const admin = await createUser();
		await db.update(authUsers).set({ role: "admin" }).where(eq(authUsers.id, admin));
		expect(await rejectionCode(deleteAccount(admin))).toBe("LAST_ADMIN");
	});
});
