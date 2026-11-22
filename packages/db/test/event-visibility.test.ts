import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { getEventById, getEventPage } from "../src/queries/events";
import { events } from "../src/schema/events";
import { createEvent, resetDb } from "./helpers";

beforeEach(resetDb);

const anonymous = { kind: "public", signedIn: false } as const;
const signedIn = { kind: "public", signedIn: true } as const;

describe("event visibility", () => {
	it("a signed-in-only event is hidden from anonymous visitors", async () => {
		const id = await createEvent();
		await db
			.update(events)
			.set({ visibility: "authenticated" })
			.where(eq(events.id, id));

		const anonymousPage = await getEventPage({ audience: anonymous }, 20);
		expect(anonymousPage.events.map((e) => e.id)).not.toContain(id);
		expect(await getEventById(id, anonymous)).toBeNull();

		const signedInPage = await getEventPage({ audience: signedIn }, 20);
		expect(signedInPage.events.map((e) => e.id)).toContain(id);
		expect((await getEventById(id, signedIn))?.visibility).toBe(
			"authenticated",
		);
	});

	it("events are public by default", async () => {
		const id = await createEvent();
		expect((await getEventById(id, anonymous))?.visibility).toBe("public");
	});
});
