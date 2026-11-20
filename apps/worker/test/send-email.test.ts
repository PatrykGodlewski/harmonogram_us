import { describe, expect, it } from "vitest";
import { handleEmailJob } from "../src/handlers/send-email";

type Sent = { to: string; subject: string; text: string; html?: string };

function capture() {
	const sent: Sent[] = [];
	return {
		sent,
		deps: {
			send: async (message: Sent) => {
				sent.push(message);
			},
		},
	};
}

describe("handleEmailJob", () => {
	it("verification job sends the link", async () => {
		const { sent, deps } = capture();
		await handleEmailJob(
			{
				kind: "verification",
				to: "new@x.test",
				url: "https://events.example.test/api/auth/verify-email?token=abc",
				locale: "pl",
			},
			deps,
		);
		expect(sent).toHaveLength(1);
		expect(sent[0]?.to).toBe("new@x.test");
		expect(sent[0]?.text).toContain("https://events.example.test/api/auth/verify-email?token=abc");
	});
});

describe("registration e-mails", () => {
	it("confirmed registration sends the event link in the registrant's language", async () => {
		const { createEvent, createUser, resetDb } = await import("../../../packages/db/test/helpers");
		const { registerForEvent } = await import("@repo/db/queries/event-registrations");
		await resetDb();
		const eventId = await createEvent({ maxSeats: 2 });
		const userId = await createUser("reg@x.test");
		let registrationId = "";
		await registerForEvent(eventId, userId, "en", {
			onChanged: async (_tx, changes) => {
				registrationId = changes[0]?.registrationId ?? "";
			},
		});
		const { sent, deps } = capture();
		await handleEmailJob({ kind: "registration", registrationId, change: "confirmed" }, deps);
		expect(sent).toHaveLength(1);
		expect(sent[0]?.to).toBe("reg@x.test");
		expect(sent[0]?.subject).toContain("Test event");
		expect(sent[0]?.html).toContain(`/en/events/${eventId}`);
		expect(sent[0]?.text).toContain(`/en/tickets/${registrationId}`);
		expect(sent[0]?.html).toContain(`/en/tickets/${registrationId}`);
	});

	it("a waitlist e-mail has no ticket link", async () => {
		const { createEvent, createUser, resetDb } = await import("../../../packages/db/test/helpers");
		const { registerForEvent } = await import("@repo/db/queries/event-registrations");
		await resetDb();
		const eventId = await createEvent({ maxSeats: 1 });
		await registerForEvent(eventId, await createUser(), "pl");
		let registrationId = "";
		await registerForEvent(eventId, await createUser("wait@x.test"), "pl", {
			onChanged: async (_tx, changes) => {
				registrationId = changes[0]?.registrationId ?? "";
			},
		});
		const { sent, deps } = capture();
		await handleEmailJob({ kind: "registration", registrationId, change: "waitlisted" }, deps);
		expect(sent).toHaveLength(1);
		expect(sent[0]?.text).not.toContain("/tickets/");
		expect(sent[0]?.html).not.toContain("/tickets/");
	});

	it("registration job for a withdrawn registration sends nothing", async () => {
		const { sent, deps } = capture();
		await handleEmailJob(
			{ kind: "registration", registrationId: crypto.randomUUID(), change: "promoted" },
			deps,
		);
		expect(sent).toHaveLength(0);
	});

	it("a job whose registration changed state before sending sends nothing", async () => {
		const { createEvent, createUser, resetDb } = await import("../../../packages/db/test/helpers");
		const { registerForEvent, unregisterFromEvent } = await import(
			"@repo/db/queries/event-registrations"
		);
		await resetDb();
		const eventId = await createEvent({ maxSeats: 1 });
		const holder = await createUser();
		const waiting = await createUser("waiting@x.test");
		await registerForEvent(eventId, holder, "pl");
		let waitlistedId = "";
		await registerForEvent(eventId, waiting, "pl", {
			onChanged: async (_tx, changes) => {
				waitlistedId = changes[0]?.registrationId ?? "";
			},
		});
		// Promoted before the "you're on the waitlist" job ran.
		await unregisterFromEvent(eventId, holder);
		const { sent, deps } = capture();
		await handleEmailJob({ kind: "registration", registrationId: waitlistedId, change: "waitlisted" }, deps);
		expect(sent).toHaveLength(0);
		// And the promotion e-mail for the same registration still goes out.
		await handleEmailJob({ kind: "registration", registrationId: waitlistedId, change: "promoted" }, deps);
		expect(sent.map((m) => m.to)).toEqual(["waiting@x.test"]);
	});

	it("a cancellation e-mail goes to registered and waitlisted people, without a ticket", async () => {
		const { createEvent, createUser, resetDb } = await import("../../../packages/db/test/helpers");
		const { registerForEvent } = await import("@repo/db/queries/event-registrations");
		const { cancelEvent } = await import("@repo/db/queries/events");
		await resetDb();
		const eventId = await createEvent({ maxSeats: 1 });
		await registerForEvent(eventId, await createUser("x@x.test"), "pl");
		await registerForEvent(eventId, await createUser("y@x.test"), "en");
		const ids: string[] = [];
		await cancelEvent(eventId, {
			onChanged: async (_tx, changes) => {
				ids.push(...changes.map((c) => c.registrationId));
			},
		});
		const { sent, deps } = capture();
		for (const registrationId of ids) {
			await handleEmailJob({ kind: "registration", registrationId, change: "cancelled" }, deps);
		}
		expect(sent.map((m) => m.to).sort()).toEqual(["x@x.test", "y@x.test"]);
		const pl = sent.find((m) => m.to === "x@x.test");
		expect(pl?.subject).toBe("Odwołano: Test event");
		expect(pl?.text).toContain(`/pl/events/${eventId}`);
		expect(pl?.text).not.toContain("/tickets/");
		expect(sent.find((m) => m.to === "y@x.test")?.subject).toBe("Cancelled: Test event");
	});

	it("a cancellation job for an event that is not cancelled sends nothing", async () => {
		const { createEvent, createUser, resetDb } = await import("../../../packages/db/test/helpers");
		const { registerForEvent } = await import("@repo/db/queries/event-registrations");
		await resetDb();
		const eventId = await createEvent();
		let registrationId = "";
		await registerForEvent(eventId, await createUser(), "pl", {
			onChanged: async (_tx, changes) => {
				registrationId = changes[0]?.registrationId ?? "";
			},
		});
		const { sent, deps } = capture();
		await handleEmailJob({ kind: "registration", registrationId, change: "cancelled" }, deps);
		expect(sent).toHaveLength(0);
	});
});
