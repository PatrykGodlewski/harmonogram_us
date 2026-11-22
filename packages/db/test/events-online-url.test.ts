import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { setOnlineUrlIfEmpty } from "../src/queries/events";
import { events } from "../src/schema/events";
import { createEvent, resetDb } from "./helpers";

beforeEach(resetDb);

describe("setOnlineUrlIfEmpty", () => {
	it("sets the link of an event without one", async () => {
		const id = await createEvent();
		await db.update(events).set({ onlineUrl: "  " }).where(eq(events.id, id));
		expect(await setOnlineUrlIfEmpty(id, "https://teams.test/a")).toBe("https://teams.test/a");
	});

	it("keeps a link that is already there and returns it", async () => {
		const id = await createEvent();
		await db.update(events).set({ onlineUrl: "https://zoom.test/x" }).where(eq(events.id, id));
		expect(await setOnlineUrlIfEmpty(id, "https://teams.test/b")).toBe("https://zoom.test/x");
		const [row] = await db.select({ url: events.onlineUrl }).from(events).where(eq(events.id, id));
		expect(row?.url).toBe("https://zoom.test/x");
	});

	it("returns null for an unknown event", async () => {
		expect(await setOnlineUrlIfEmpty("nope", "https://teams.test/c")).toBeNull();
	});
});
