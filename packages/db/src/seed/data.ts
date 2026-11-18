export type LookupSeed = {
	id: string;
	slug: string;
	label: string;
	sortOrder: number;
};

export const eventTypeSeeds: LookupSeed[] = [
	{ id: "workshop", slug: "workshop", label: "Warsztaty", sortOrder: 1 },
	{ id: "lecture", slug: "lecture", label: "Wykłady", sortOrder: 2 },
	{ id: "meeting", slug: "meeting", label: "Spotkania", sortOrder: 3 },
	{ id: "conference", slug: "conference", label: "Konferencje", sortOrder: 4 },
	{ id: "exhibition", slug: "exhibition", label: "Wystawy", sortOrder: 5 },
	{ id: "competition", slug: "competition", label: "Konkursy", sortOrder: 6 },
	{
		id: "celebration",
		slug: "celebration",
		label: "Uroczystości",
		sortOrder: 7,
	},
	{
		id: "special-event",
		slug: "special-event",
		label: "Wydarzenia specjalne",
		sortOrder: 8,
	},
];

export const eventLocationSeeds: LookupSeed[] = [
	{ id: "katowice", slug: "katowice", label: "Katowice", sortOrder: 1 },
	{ id: "sosnowiec", slug: "sosnowiec", label: "Sosnowiec", sortOrder: 2 },
	{ id: "chorzow", slug: "chorzow", label: "Chorzów", sortOrder: 3 },
	{ id: "cieszyn", slug: "cieszyn", label: "Cieszyn", sortOrder: 4 },
	{ id: "online", slug: "online", label: "Online", sortOrder: 5 },
];

export const eventFacultySeeds: LookupSeed[] = [
	{ id: "wh", slug: "wh", label: "Wydział Humanistyczny", sortOrder: 1 },
	{
		id: "wnp",
		slug: "wnp",
		label: "Wydział Nauk Przyrodniczych",
		sortOrder: 2,
	},
	{ id: "wns", slug: "wns", label: "Wydział Nauk Społecznych", sortOrder: 3 },
	{
		id: "wnst",
		slug: "wnst",
		label: "Wydział Nauk Ścisłych i Technicznych",
		sortOrder: 4,
	},
	{
		id: "wpia",
		slug: "wpia",
		label: "Wydział Prawa i Administracji",
		sortOrder: 5,
	},
	{
		id: "wsne",
		slug: "wsne",
		label: "Wydział Sztuki i Nauk o Edukacji",
		sortOrder: 6,
	},
	{ id: "wtl", slug: "wtl", label: "Wydział Teologiczny", sortOrder: 7 },
	{
		id: "sf",
		slug: "sf",
		label: "Szkoła Filmowa im. Krzysztofa Kieślowskiego",
		sortOrder: 8,
	},
];

export type EventSeed = {
	id: string;
	title: string;
	daysFromNow: number;
	maxSeats: number;
	typeId: string;
	locationId: string;
	facultyId: string;
};

export const eventSeeds: EventSeed[] = [
	{
		id: "evt-1",
		title: "Warsztaty z programowania",
		daysFromNow: 7,
		maxSeats: 30,
		typeId: "workshop",
		locationId: "katowice",
		facultyId: "wnst",
	},
	{
		id: "evt-2",
		title: "Wykład o historii sztuki",
		daysFromNow: 14,
		maxSeats: 100,
		typeId: "lecture",
		locationId: "sosnowiec",
		facultyId: "wh",
	},
	{
		id: "evt-3",
		title: "Konferencja naukowa",
		daysFromNow: 21,
		maxSeats: 50,
		typeId: "conference",
		locationId: "online",
		facultyId: "wns",
	},
];

export type AgendaItemSeed = {
	id: string;
	eventId: string;
	title: string;
	/** Start, in hours after 09:00 UTC on the event's day. */
	startHour: number;
	durationMinutes: number;
	locationId: string | null;
	maxSeats: number | null;
	requiresRegistration: boolean;
};

export const agendaItemSeeds: AgendaItemSeed[] = [
	{
		id: "agenda-evt-1-opening",
		eventId: "evt-1",
		title: "Otwarcie i wprowadzenie",
		startHour: 0,
		durationMinutes: 60,
		locationId: "katowice",
		maxSeats: null,
		requiresRegistration: true,
	},
	{
		id: "agenda-evt-1-web",
		eventId: "evt-1",
		title: "Warsztat: aplikacje webowe",
		startHour: 1.5,
		durationMinutes: 90,
		locationId: "katowice",
		maxSeats: 15,
		requiresRegistration: true,
	},
	{
		id: "agenda-evt-1-robotics",
		eventId: "evt-1",
		title: "Warsztat: robotyka",
		startHour: 2,
		durationMinutes: 90,
		locationId: "chorzow",
		maxSeats: 10,
		requiresRegistration: true,
	},
	{
		id: "agenda-evt-1-break",
		eventId: "evt-1",
		title: "Przerwa kawowa",
		startHour: 3.5,
		durationMinutes: 30,
		locationId: null,
		maxSeats: null,
		requiresRegistration: false,
	},
];

export const adminUserSeed = {
	id: "00000000-0000-4000-8000-000000000001",
	email: "admin@harmonogram.local",
	name: "Admin",
	password: "Admin123!",
} as const;
