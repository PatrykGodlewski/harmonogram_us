import type { ImportedEvent } from "@repo/db/queries/indico-events";
import { describe, expect, it, vi } from "vitest";
import { syncIndicoEvents } from "../src/indico/sync";

const CONFIG = { baseUrl: "https://indico.example.edu", categoryIds: ["1"] };

const EVENT: ImportedEvent = {
	id: "1",
	title: "Seminar",
	startsAt: new Date("2026-12-01T10:00:00Z"),
	endsAt: null,
	location: null,
	room: null,
	url: "https://indico.example.edu/event/1/",
};

describe("syncIndicoEvents", () => {
	it("is off without configuration and clears the old copy", async () => {
		const replace = vi.fn(async () => {});
		const fetchEvents = vi.fn();
		expect(await syncIndicoEvents(null, { fetchEvents, replace })).toEqual({ status: "off" });
		expect(fetchEvents).not.toHaveBeenCalled();
		// Switching the import off must not leave the last copy listed for good.
		expect(replace).toHaveBeenCalledWith([]);
	});

	it("replaces the mirror with the fetched events", async () => {
		const replace = vi.fn(async () => {});
		const fetchEvents = vi.fn(async () => [EVENT]);
		expect(await syncIndicoEvents(CONFIG, { fetchEvents, replace })).toEqual({ status: "synced", count: 1 });
		expect(fetchEvents).toHaveBeenCalledWith(CONFIG);
		expect(replace).toHaveBeenCalledWith([EVENT]);
	});

	it("keeps the mirror when Indico can't be read", async () => {
		const replace = vi.fn();
		const fetchEvents = vi.fn(async () => {
			throw new Error("Indico export answered 502");
		});
		expect(await syncIndicoEvents(CONFIG, { fetchEvents, replace })).toEqual({
			status: "failed",
			error: "Indico export answered 502",
		});
		expect(replace).not.toHaveBeenCalled();
	});
});
