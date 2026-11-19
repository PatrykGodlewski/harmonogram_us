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
	});

	it("registration job for a withdrawn registration sends nothing", async () => {
		const { sent, deps } = capture();
		await handleEmailJob(
			{ kind: "registration", registrationId: crypto.randomUUID(), change: "promoted" },
			deps,
		);
		expect(sent).toHaveLength(0);
	});
});
