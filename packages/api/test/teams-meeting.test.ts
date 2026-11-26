import { db } from "@repo/db/client";
import { events } from "@repo/db/schema/events";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createEvent, resetDb } from "../../db/test/helpers";
import type { TeamsConfig } from "../src/teams/graph";
import { ensureTeamsMeeting } from "../src/teams/meeting";

const CONFIG: TeamsConfig = {
	tenantId: "t",
	clientId: "c",
	clientSecret: "s",
	organizerId: "o",
	loginUrl: "https://login.example",
	graphUrl: "https://graph.example",
};

beforeEach(resetDb);

async function onlineEvent(onlineUrl: string | null) {
	const id = await createEvent();
	await db.update(events).set({ attendanceMode: "online", onlineUrl, title: "Webinar" }).where(eq(events.id, id));
	return id;
}

function neverCalled() {
	let count = 0;
	const create = async () => {
		count++;
		return "https://teams.test/never";
	};
	return { create, calls: () => count };
}

describe("ensureTeamsMeeting", () => {
	it("creates a meeting for an event without a link and stores its join link", async () => {
		const id = await onlineEvent(null);
		const subjects: string[] = [];
		const url = await ensureTeamsMeeting(id, CONFIG, async (_config, meeting) => {
			subjects.push(meeting.subject);
			return "https://teams.test/join/1";
		});
		expect(url).toBe("https://teams.test/join/1");
		expect(subjects).toEqual(["Webinar"]);
		const [row] = await db.select({ url: events.onlineUrl }).from(events).where(eq(events.id, id));
		expect(row?.url).toBe("https://teams.test/join/1");
	});

	it("creates no meeting when the event already has a link", async () => {
		const id = await onlineEvent("https://zoom.test/x");
		let calls = 0;
		const url = await ensureTeamsMeeting(id, CONFIG, async () => {
			calls++;
			return "https://teams.test/join/2";
		});
		expect(url).toBe("https://zoom.test/x");
		expect(calls).toBe(0);
	});

	it("refuses a cancelled event without calling Graph", async () => {
		const id = await onlineEvent(null);
		await db.update(events).set({ status: "cancelled" }).where(eq(events.id, id));
		const { create, calls } = neverCalled();
		await expect(ensureTeamsMeeting(id, CONFIG, create)).rejects.toMatchObject({ message: "EVENT_CANCELLED" });
		expect(calls()).toBe(0);
	});

	it("refuses an ended event without calling Graph", async () => {
		const id = await onlineEvent(null);
		const end = new Date(Date.now() - 3_600_000);
		await db
			.update(events)
			.set({ date: new Date(end.getTime() - 3_600_000), endsAt: end })
			.where(eq(events.id, id));
		const { create, calls } = neverCalled();
		await expect(ensureTeamsMeeting(id, CONFIG, create)).rejects.toMatchObject({ message: "EVENT_ENDED" });
		expect(calls()).toBe(0);
	});

	it("refuses an on-site event and an unknown one", async () => {
		const onsite = await createEvent();
		const never = async () => "https://teams.test/never";
		await expect(ensureTeamsMeeting(onsite, CONFIG, never)).rejects.toMatchObject({ message: "TEAMS_NOT_ONLINE" });
		await expect(ensureTeamsMeeting("nope", CONFIG, never)).rejects.toMatchObject({ message: "EVENT_NOT_FOUND" });
	});
});
