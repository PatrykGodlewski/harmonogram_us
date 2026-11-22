import { beforeEach, describe, expect, it } from "vitest";
import {
	addRegistrantByEmail,
	registerForAgendaItem,
	registerForEvent,
	unregisterFromEvent,
} from "../src/queries/event-registrations";
import { db } from "../src/client";
import { eventRegistrations } from "../src/schema/event-registrations";
import { authUsers } from "../src/schema/better-auth";
import { and, eq } from "drizzle-orm";
import {
	collectChanges,
	createEvent,
	createItem,
	createUser,
	readEventCount,
	rejectionCode,
	resetDb,
	stateOf,
} from "./helpers";

beforeEach(resetDb);

async function setState(eventId: string, userId: string, state: "rejected") {
	await db
		.update(eventRegistrations)
		.set({ state })
		.where(
			and(
				eq(eventRegistrations.eventId, eventId),
				eq(eventRegistrations.userId, userId),
			),
		);
}

describe("registration approval", () => {
	it("a registration on an approval event waits as pending and takes no place", async () => {
		const eventId = await createEvent({ maxSeats: 1, requiresApproval: true });
		const user = await createUser();
		const { hooks, changes } = collectChanges();
		const result = await registerForEvent(eventId, user, "pl", hooks);
		expect(result.state).toBe("pending");
		expect(changes.map((c) => c.change)).toEqual(["pending"]);
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(1);
	});

	it("programme items need an approved registration first", async () => {
		const eventId = await createEvent({ requiresApproval: true });
		const itemId = await createItem(eventId);
		const user = await createUser();
		expect(await rejectionCode(registerForAgendaItem(itemId, user, "pl"))).toBe(
			"APPROVAL_REQUIRED",
		);
		await registerForEvent(eventId, user, "pl");
		expect(await rejectionCode(registerForAgendaItem(itemId, user, "pl"))).toBe(
			"APPROVAL_REQUIRED",
		);
	});

	it("a rejected person cannot withdraw and ask again", async () => {
		const eventId = await createEvent({ requiresApproval: true });
		const user = await createUser();
		await registerForEvent(eventId, user, "pl");
		await setState(eventId, user, "rejected");
		expect(await rejectionCode(unregisterFromEvent(eventId, user))).toBe(
			"NOT_REGISTERED",
		);
		expect(await stateOf(eventId, user)).toBe("rejected");
	});

	it("an organiser adding someone skips approval", async () => {
		const eventId = await createEvent({ requiresApproval: true });
		const user = await createUser();
		const [row] = await db
			.select({ email: authUsers.email })
			.from(authUsers)
			.where(eq(authUsers.id, user));
		const result = await addRegistrantByEmail(eventId, row?.email ?? "", "pl");
		expect(result.state).toBe("registered");
	});
});

describe("who hears about a cancelled event", () => {
	it("pending requests are told, rejected ones are not", async () => {
		const { cancelEvent } = await import("../src/queries/events");
		const eventId = await createEvent({ requiresApproval: true });
		const [pending, rejected] = [await createUser(), await createUser()];
		await registerForEvent(eventId, pending, "pl");
		await registerForEvent(eventId, rejected, "pl");
		await setState(eventId, rejected, "rejected");
		const { hooks, changes } = collectChanges();
		await cancelEvent(eventId, hooks);
		expect(changes).toHaveLength(1);
	});
});

describe("approving and rejecting", () => {
	it("approval fills free places in request order, the rest go to the waitlist", async () => {
		const { approveRegistrations } = await import(
			"../src/queries/registration-approval"
		);
		const eventId = await createEvent({ maxSeats: 1, requiresApproval: true });
		const [first, second] = [await createUser(), await createUser()];
		await registerForEvent(eventId, first, "pl");
		await registerForEvent(eventId, second, "pl");
		const ids = await registrationIds(eventId);
		const { hooks, changes } = collectChanges();
		const result = await approveRegistrations(eventId, ids, hooks);
		expect(result).toMatchObject({ approved: 1, waitlisted: 1 });
		expect(await stateOf(eventId, first)).toBe("registered");
		expect(await stateOf(eventId, second)).toBe("waitlisted");
		expect(changes.map((c) => c.change).sort()).toEqual([
			"confirmed",
			"waitlisted",
		]);
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(0);
	});

	it("rejection changes only pending requests and tells them", async () => {
		const { rejectRegistrations } = await import(
			"../src/queries/registration-approval"
		);
		const eventId = await createEvent({ requiresApproval: true });
		const [pending, added] = [await createUser(), await createUser()];
		await registerForEvent(eventId, pending, "pl");
		await registerForEvent(eventId, added, "pl", undefined, {
			byOrganizer: true,
		});
		const { hooks, changes } = collectChanges();
		const result = await rejectRegistrations(
			eventId,
			await registrationIds(eventId),
			hooks,
		);
		expect(result.rejected).toBe(1);
		expect(await stateOf(eventId, pending)).toBe("rejected");
		expect(await stateOf(eventId, added)).toBe("registered");
		expect(changes.map((c) => c.change)).toEqual(["rejected"]);
	});

	it("a rejected request can still be approved later", async () => {
		const { approveRegistrations, rejectRegistrations } = await import(
			"../src/queries/registration-approval"
		);
		const eventId = await createEvent({ requiresApproval: true });
		const user = await createUser();
		await registerForEvent(eventId, user, "pl");
		const ids = await registrationIds(eventId);
		await rejectRegistrations(eventId, ids);
		await approveRegistrations(eventId, ids);
		expect(await stateOf(eventId, user)).toBe("registered");
	});
});

async function registrationIds(eventId: string): Promise<string[]> {
	const rows = await db
		.select({ id: eventRegistrations.id })
		.from(eventRegistrations)
		.where(eq(eventRegistrations.eventId, eventId));
	return rows.map((row) => row.id);
}
