import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@repo/db/client";
import { EVENT_LINKS_LIMIT } from "@repo/db/queries/event-files";
import { events } from "@repo/db/schema/events";
import { eq } from "drizzle-orm";
import { createEvent, createUser, resetDb } from "../../db/test/helpers";
import {
	addEventMaterialLinkServer,
	deleteEventFileServer,
} from "../src/admin/materials";
import type { AuthenticatedUser } from "../src/auth/user";

/**
 * Runs a panel server function's validator and handler with a given user,
 * without the TanStack Start request context.
 */
vi.mock("../src/auth/panel-middleware", () => {
	type Handler = (opts: { data: unknown; context: unknown }) => unknown;
	const builder = (validate: (input: unknown) => unknown = (input) => input) => ({
		validator: (next: (input: unknown) => unknown) => builder(next),
		handler:
			(fn: Handler) =>
			(opts: { data: unknown; user: AuthenticatedUser }) =>
				fn({ data: validate(opts.data), context: { user: opts.user } }),
	});
	return { panelActionFn: builder(), panelQueryFn: builder() };
});

type Call = (opts: { data: unknown; user: AuthenticatedUser }) => Promise<unknown>;

beforeEach(resetDb);

async function admin(): Promise<AuthenticatedUser> {
	const id = await createUser();
	return {
		id,
		email: `${id}@example.test`,
		hasPassword: true,
		isAdmin: true,
		role: "admin",
		hasPanelAccess: true,
	};
}

describe("materials server functions", () => {
	it("deleting a file that is not the event's answers NOT_FOUND", async () => {
		const user = await admin();
		const eventId = await createEvent();
		const call = deleteEventFileServer as unknown as Call;

		await expect(
			call({ data: { eventId, id: crypto.randomUUID() }, user }),
		).rejects.toMatchObject({ message: "NOT_FOUND", status: 404 });
	});

	it("the 31st link is refused with EVENT_LINKS_LIMIT (409)", async () => {
		const user = await admin();
		const eventId = await createEvent();
		const link = { label: "Strona", url: "https://example.test" };
		await db
			.update(events)
			.set({ materials: Array.from({ length: EVENT_LINKS_LIMIT }, () => link) })
			.where(eq(events.id, eventId));
		const call = addEventMaterialLinkServer as unknown as Call;

		await expect(call({ data: { eventId, link }, user })).rejects.toMatchObject({
			message: "EVENT_LINKS_LIMIT",
			status: 409,
		});
	});
});
