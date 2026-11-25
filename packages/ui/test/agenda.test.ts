import { describe, expect, it } from "vitest";
import {
	findOverlaps,
	layoutAgenda,
	markParallel,
	nowListIndex,
	filterByPlace,
	filterByDay,
	filterBySession,
	entriesByDay,
	programmeDays,
	programmeEntries,
	programmePlaces,
	programmeSessionTitles,
	sessionLegend,
	programmeNowIndex,
	msUntilNextMinute,
	nowMinuteOnDay,
} from "../src/agenda";

const at = (time: string) => `2026-03-14T${time}:00Z`;
const item = (id: string, start: string, end: string) => ({
	id,
	title: id,
	startsAt: at(start),
	endsAt: at(end),
});

describe("markParallel", () => {
	it("flags items starting while an earlier one runs", () => {
		const result = markParallel([
			item("lasers", "12:00", "13:30"),
			item("opening", "09:00", "10:00"),
			item("robotics", "12:30", "14:00"),
			item("coffee", "13:30", "14:00"),
		]);
		expect(result.map((r) => [r.id, r.parallel])).toEqual([
			["opening", false],
			["lasers", false],
			["robotics", true],
			["coffee", true],
		]);
	});

	it("touching items are not parallel", () => {
		const result = markParallel([
			item("a", "12:00", "13:30"),
			item("b", "13:30", "14:00"),
		]);
		expect(result.map((r) => r.parallel)).toEqual([false, false]);
	});
});

describe("findOverlaps", () => {
	const items = [
		item("Lasers", "12:00", "13:30"),
		item("Robotics", "12:30", "14:00"),
		item("Coffee", "13:30", "14:00"),
	];

	it("maps selected overlapping items to each other", () => {
		const result = findOverlaps(items, new Set(["Lasers", "Robotics"]));
		expect(result.get("Lasers")).toEqual(["Robotics"]);
		expect(result.get("Robotics")).toEqual(["Lasers"]);
	});

	it("ignores touching and unselected items", () => {
		expect(findOverlaps(items, new Set(["Lasers", "Coffee"])).size).toBe(0);
		expect(findOverlaps(items, new Set(["Lasers"])).size).toBe(0);
	});
});

describe("layoutAgenda", () => {
	const TZ = "Europe/Warsaw";
	// 2026-11-19 in Warsaw is UTC+1: 10:00 local = 09:00Z.
	const item = (id: string, start: string, end: string) => ({
		id,
		title: id,
		startsAt: new Date(start),
		endsAt: new Date(end),
	});

	it("puts parallel sessions in separate lanes", () => {
		const [day] = layoutAgenda(
			[
				item("opening", "2026-11-19T09:00:00Z", "2026-11-19T10:00:00Z"),
				item("a", "2026-11-19T10:30:00Z", "2026-11-19T12:00:00Z"),
				item("b", "2026-11-19T10:30:00Z", "2026-11-19T12:00:00Z"),
			],
			TZ,
		);
		expect(day?.lanes).toBe(2);
		expect(day?.items.map((i) => [i.id, i.lane])).toEqual([
			["opening", 0],
			["a", 0],
			["b", 1],
		]);
	});

	it("items outside a parallel block use the full width", () => {
		const [day] = layoutAgenda(
			[
				item("opening", "2026-11-19T09:00:00Z", "2026-11-19T10:00:00Z"),
				item("a", "2026-11-19T10:30:00Z", "2026-11-19T12:00:00Z"),
				item("b", "2026-11-19T10:30:00Z", "2026-11-19T12:00:00Z"),
				item("closing", "2026-11-19T12:00:00Z", "2026-11-19T12:30:00Z"),
			],
			TZ,
		);
		expect(day?.items.map((i) => [i.id, i.lanes])).toEqual([
			["opening", 1],
			["a", 2],
			["b", 2],
			["closing", 1],
		]);
	});

	it("a short item drawn taller than it lasts doesn't share a lane with the next one", () => {
		const [day] = layoutAgenda(
			[
				item("talk", "2026-11-19T09:00:00Z", "2026-11-19T09:15:00Z"),
				item("next", "2026-11-19T09:15:00Z", "2026-11-19T10:00:00Z"),
			],
			TZ,
			{ minDurationMinutes: 30 },
		);
		expect(day?.items.map((i) => [i.id, i.lane, i.lanes])).toEqual([
			["talk", 0, 2],
			["next", 1, 2],
		]);
	});

	it("an item that starts when the previous ends shares its lane", () => {
		const [day] = layoutAgenda(
			[
				item("first", "2026-11-19T09:00:00Z", "2026-11-19T10:00:00Z"),
				item("next", "2026-11-19T10:00:00Z", "2026-11-19T11:00:00Z"),
			],
			TZ,
		);
		expect(day?.lanes).toBe(1);
		expect(day?.items.map((i) => i.lane)).toEqual([0, 0]);
	});

	it("groups by day in the given time zone, not UTC", () => {
		// 23:30 in Warsaw on the 19th is 22:30Z, still the 19th; 00:30 on the 20th is 23:30Z on the 19th.
		const days = layoutAgenda(
			[
				item("late", "2026-11-19T22:30:00Z", "2026-11-19T22:50:00Z"),
				item("after-midnight", "2026-11-19T23:30:00Z", "2026-11-20T00:00:00Z"),
			],
			TZ,
		);
		expect(days.map((d) => [d.day, d.items.map((i) => i.id)])).toEqual([
			["2026-11-19", ["late"]],
			["2026-11-20", ["after-midnight"]],
		]);
		expect(days[0]?.items[0]?.startMinute).toBe(23 * 60 + 30);
	});

	it("a two-day agenda gives two days", () => {
		const days = layoutAgenda(
			[
				item("d1", "2026-11-19T09:00:00Z", "2026-11-19T10:00:00Z"),
				item("d2", "2026-11-20T09:00:00Z", "2026-11-20T10:00:00Z"),
			],
			TZ,
		);
		expect(days.map((d) => d.day)).toEqual(["2026-11-19", "2026-11-20"]);
	});

	it("the day spans whole hours around its items", () => {
		const [day] = layoutAgenda(
			[item("x", "2026-11-19T09:15:00Z", "2026-11-19T10:40:00Z")],
			TZ,
		);
		expect([day?.startMinute, day?.endMinute]).toEqual([10 * 60, 12 * 60]);
		expect([day?.items[0]?.startMinute, day?.items[0]?.endMinute]).toEqual([10 * 60 + 15, 11 * 60 + 40]);
	});
});

describe("now markers", () => {
	const TZ = "Europe/Warsaw";
	const item = (id: string, start: string, end: string) => ({
		id,
		title: id,
		startsAt: new Date(start),
		endsAt: new Date(end),
	});
	const agenda = [
		item("a", "2026-11-19T09:00:00Z", "2026-11-19T10:00:00Z"),
		item("b", "2026-11-19T11:00:00Z", "2026-11-19T12:00:00Z"),
	];

	it("nowMinuteOnDay: minutes since midnight in the time zone, only on that day and within its hours", () => {
		const [day] = layoutAgenda(agenda, TZ);
		if (!day) throw new Error("no day");
		// 09:30Z is 10:30 in Warsaw.
		expect(nowMinuteOnDay(day, new Date("2026-11-19T09:30:00Z"), TZ)).toBe(10 * 60 + 30);
		expect(nowMinuteOnDay(day, new Date("2026-11-20T09:30:00Z"), TZ)).toBeNull();
		expect(nowMinuteOnDay(day, new Date("2026-11-19T05:00:00Z"), TZ)).toBeNull();
	});

	it("nowListIndex: where 'now' goes in the sorted list while the agenda runs, else null", () => {
		expect(nowListIndex(agenda, new Date("2026-11-19T09:30:00Z"))).toBe(1);
		expect(nowListIndex(agenda, new Date("2026-11-19T10:30:00Z"))).toBe(1);
		expect(nowListIndex(agenda, new Date("2026-11-19T11:30:00Z"))).toBe(2);
		expect(nowListIndex(agenda, new Date("2026-11-19T08:00:00Z"))).toBeNull();
		expect(nowListIndex(agenda, new Date("2026-11-19T12:30:00Z"))).toBeNull();
	});
});

describe("msUntilNextMinute", () => {
	it("is the time left to the next full minute", () => {
		expect(msUntilNextMinute(new Date("2026-11-19T09:30:05.000Z"))).toBe(55_000);
		expect(msUntilNextMinute(new Date("2026-11-19T09:30:59.900Z"))).toBe(100);
		expect(msUntilNextMinute(new Date("2026-11-19T09:31:00.000Z"))).toBe(60_000);
	});
});

describe("programme with sessions (F33)", () => {
	const loose = (id: string, start: string, end: string) => ({
		...item(id, start, end),
		sessionId: null,
	});
	const inSession = (id: string, session: string, start: string, end: string) => ({
		...item(id, start, end),
		sessionId: session,
	});
	const lectures = item("Wykłady", "13:00", "15:00");
	const programme = [
		loose("Otwarcie", "09:00", "10:00"),
		inSession("Grafen", "Wykłady", "13:00", "14:00"),
		loose("Panel", "15:00", "16:00"),
	];

	it("orders sessions and items outside them by start; a session carries its items", () => {
		const entries = programmeEntries(programme, [lectures]);
		expect(
			entries.map((entry) =>
				entry.kind === "session"
					? `${entry.session.id}: ${entry.items.map((row) => row.id).join(",")}`
					: entry.item.id,
			),
		).toEqual(["Otwarcie", "Wykłady: Grafen", "Panel"]);
	});

	it("places 'now' among sessions and items, also when every item is in a session", () => {
		const entries = programmeEntries(programme, [lectures]);
		expect(programmeNowIndex(entries, new Date(at("12:00")))).toBe(1);
		expect(programmeNowIndex(entries, new Date(at("14:00")))).toBe(2);
		const onlySession = programmeEntries(
			[inSession("Grafen", "Wykłady", "13:00", "14:00")],
			[lectures],
		);
		expect(programmeNowIndex(onlySession, new Date(at("13:30")))).toBe(1);
		expect(programmeNowIndex(onlySession, new Date(at("16:00")))).toBeNull();
	});
});

describe("programme by place (F33)", () => {
	const place = (id: string | null) => ({
		locationId: id,
		locationLabel: id ? id.toUpperCase() : null,
	});
	const sessions = [
		{ ...item("Wykłady", "09:30", "13:00"), ...place("kat") },
		{ ...item("Grupa 2", "13:30", "15:30"), ...place("sos") },
	];
	const items = [
		{ ...item("Otwarcie", "09:00", "09:30"), ...place("kat"), sessionId: null },
		{ ...item("Grafen", "09:30", "10:15"), ...place(null), sessionId: "Wykłady" },
		{ ...item("Przerwa", "13:00", "13:30"), ...place(null), sessionId: null },
		{ ...item("Mikroskopy", "13:30", "14:20"), ...place(null), sessionId: "Grupa 2" },
		{ ...item("Gość w Chorzowie", "14:30", "15:00"), ...place("cho"), sessionId: "Grupa 2" },
	];

	it("lists the programme's places in time order; items take their session's place", () => {
		expect(programmePlaces(items, sessions)).toEqual([
			{ id: "kat", label: "KAT" },
			{ id: "sos", label: "SOS" },
			{ id: "cho", label: "CHO" },
		]);
	});

	it("keeps only what happens in the chosen place", () => {
		const sosnowiec = filterByPlace(items, sessions, "sos");
		expect(sosnowiec.items.map((row) => row.id)).toEqual(["Mikroskopy"]);
		expect(sosnowiec.sessions.map((row) => row.id)).toEqual(["Grupa 2"]);
		const chorzow = filterByPlace(items, sessions, "cho");
		// A session shows for an item of its own held elsewhere
		expect(chorzow.items.map((row) => row.id)).toEqual(["Gość w Chorzowie"]);
		expect(chorzow.sessions.map((row) => row.id)).toEqual(["Grupa 2"]);
		const all = filterByPlace(items, sessions, null);
		expect(all.items).toHaveLength(items.length);
		expect(all.sessions).toHaveLength(2);
	});
});

describe("programme by session (F33)", () => {
	const session = (id: string, title: string, start: string, end: string) => ({
		...item(id, start, end),
		title,
	});
	const sessions = [
		session("stage-fri", "Scena Główna", "10:00", "17:00"),
		session("exact-fri", "Strefa Nauk Ścisłych", "09:00", "15:00"),
		session("stage-sat", "Scena Główna", "18:00", "20:00"),
	];
	const items = [
		{ ...item("Otwarcie", "09:00", "09:30"), sessionId: null },
		{ ...item("Czarne dziury", "10:00", "10:45"), sessionId: "stage-fri" },
		{ ...item("Kryptografia", "09:00", "10:00"), sessionId: "exact-fri" },
		{ ...item("Koncert", "18:00", "19:00"), sessionId: "stage-sat" },
	];

	it("offers each session name once, in time order", () => {
		expect(programmeSessionTitles(sessions)).toEqual([
			"Strefa Nauk Ścisłych",
			"Scena Główna",
		]);
	});

	it("keeps the sessions with the chosen name and their items", () => {
		const stage = filterBySession(items, sessions, "Scena Główna");
		expect(stage.sessions.map((row) => row.id)).toEqual(["stage-fri", "stage-sat"]);
		expect(stage.items.map((row) => row.id)).toEqual(["Czarne dziury", "Koncert"]);
		const all = filterBySession(items, sessions, null);
		expect(all.items).toHaveLength(4);
		expect(all.sessions).toHaveLength(3);
	});
});

describe("programme by day", () => {
	const zone = "Europe/Warsaw";
	const at = (iso: string) => iso;
	const timed = (id: string, start: string, end: string) => ({
		id,
		title: id,
		startsAt: at(start),
		endsAt: at(end),
	});
	const sessions = [
		{ ...timed("Scena pt", "2026-12-11T09:00:00Z", "2026-12-11T15:00:00Z"), color: "violet" },
		{ ...timed("Scena sb", "2026-12-12T09:00:00Z", "2026-12-12T15:00:00Z"), color: "violet" },
		{ ...timed("Dzieci sb", "2026-12-12T09:00:00Z", "2026-12-12T12:00:00Z"), color: "amber" },
	];
	const items = [
		{ ...timed("Otwarcie", "2026-12-11T08:00:00Z", "2026-12-11T08:30:00Z"), sessionId: null },
		{ ...timed("Wykład", "2026-12-11T09:00:00Z", "2026-12-11T10:00:00Z"), sessionId: "Scena pt" },
		{ ...timed("Koncert", "2026-12-12T09:00:00Z", "2026-12-12T10:00:00Z"), sessionId: "Scena sb" },
		// 23:30 UTC on the 12th is the 13th in Warsaw
		{ ...timed("Nocny pokaz", "2026-12-12T23:30:00Z", "2026-12-13T00:30:00Z"), sessionId: null },
	];

	it("lists the programme's days in order, in the event time zone", () => {
		expect(programmeDays(items, sessions, zone)).toEqual([
			"2026-12-11",
			"2026-12-12",
			"2026-12-13",
		]);
	});

	it("keeps only what starts on the chosen day", () => {
		const saturday = filterByDay(items, sessions, "2026-12-12", zone);
		expect(saturday.items.map((row) => row.id)).toEqual(["Koncert"]);
		expect(saturday.sessions.map((row) => row.id)).toEqual(["Scena sb", "Dzieci sb"]);
		expect(filterByDay(items, sessions, null, zone).items).toHaveLength(4);
	});

	it("groups programme entries by day, in order", () => {
		const groups = entriesByDay(programmeEntries(items, sessions), zone);
		expect(
			groups.map((group) => [
				group.day,
				group.entries.map((entry) =>
					entry.kind === "session" ? entry.session.id : entry.item.id,
				),
			]),
		).toEqual([
			["2026-12-11", ["Otwarcie", "Scena pt"]],
			["2026-12-12", ["Dzieci sb", "Scena sb"]],
			["2026-12-13", ["Nocny pokaz"]],
		]);
	});

	it("keeps a session that runs past midnight whole, on the day it starts", () => {
		const late = [
			{ ...timed("Noc nauki", "2026-12-11T21:00:00Z", "2026-12-12T01:00:00Z"), color: "blue" },
		];
		const lateItems = [
			{ ...timed("Przed północą", "2026-12-11T21:00:00Z", "2026-12-11T22:00:00Z"), sessionId: "Noc nauki" },
			// 00:30 on Saturday in Warsaw, still inside Friday's session
			{ ...timed("Po północy", "2026-12-11T23:30:00Z", "2026-12-12T00:30:00Z"), sessionId: "Noc nauki" },
		];
		expect(programmeDays(lateItems, late, zone)).toEqual(["2026-12-11"]);
		const friday = filterByDay(lateItems, late, "2026-12-11", zone);
		expect(friday.items.map((row) => row.id)).toEqual(["Przed północą", "Po północy"]);
		expect(friday.sessions.map((row) => row.id)).toEqual(["Noc nauki"]);
		expect(filterByDay(lateItems, late, "2026-12-12", zone).items).toEqual([]);
	});

	it("names each session once in the legend (same title and colour)", () => {
		const legend = sessionLegend([
			{ ...sessions[0], title: "Scena Główna" },
			{ ...sessions[1], title: "Scena Główna" },
			{ ...sessions[2], title: "Strefa Dzieci" },
		]);
		expect(legend).toEqual([
			{ title: "Scena Główna", color: "violet" },
			{ title: "Strefa Dzieci", color: "amber" },
		]);
	});
});

