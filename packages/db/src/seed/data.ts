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

/** Seeded event that fills up, so the waitlist has people on it. */
export const FULL_EVENT_ID = "evt-full-seminar";

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
	{
		id: FULL_EVENT_ID,
		title: "Seminarium: sztuczna inteligencja w nauce",
		daysFromNow: 5,
		maxSeats: 3,
		typeId: "meeting",
		locationId: "katowice",
		facultyId: "wnst",
	},
	{
		id: "evt-career-day",
		title: "Dzień kariery — spotkania z pracodawcami",
		daysFromNow: 10,
		maxSeats: 200,
		typeId: "special-event",
		locationId: "katowice",
		facultyId: "wsne",
	},
	{
		id: "evt-law-lecture",
		title: "Wykład gościnny: prawo nowych technologii",
		daysFromNow: 3,
		maxSeats: 80,
		typeId: "lecture",
		locationId: "online",
		facultyId: "wpia",
	},
	{
		id: "evt-theology-meeting",
		title: "Spotkanie koła naukowego teologów",
		daysFromNow: 12,
		maxSeats: 25,
		typeId: "meeting",
		locationId: "katowice",
		facultyId: "wtl",
	},
	{
		id: "evt-arts-exhibition",
		title: "Wystawa prac studentów sztuki",
		daysFromNow: 18,
		maxSeats: 150,
		typeId: "exhibition",
		locationId: "cieszyn",
		facultyId: "sf",
	},
	{
		id: "evt-robotics-contest",
		title: "Konkurs robotyki dla szkół średnich",
		daysFromNow: 25,
		maxSeats: 60,
		typeId: "competition",
		locationId: "chorzow",
		facultyId: "wnst",
	},
	{
		id: "evt-graduation",
		title: "Uroczystość wręczenia dyplomów",
		daysFromNow: 30,
		maxSeats: 400,
		typeId: "celebration",
		locationId: "katowice",
		facultyId: "wnp",
	},
	{
		id: "evt-past-lecture",
		title: "Wykład inauguracyjny (archiwum)",
		daysFromNow: -20,
		maxSeats: 300,
		typeId: "lecture",
		locationId: "katowice",
		facultyId: "wnp",
	},
	{
		id: "evt-past-workshop",
		title: "Warsztaty z pisania prac dyplomowych (archiwum)",
		daysFromNow: -6,
		maxSeats: 40,
		typeId: "workshop",
		locationId: "sosnowiec",
		facultyId: "wh",
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

export type AccountSeed = {
	email: string;
	name: string;
	role: "user" | "admin";
	/** false: the account signs in only with e-mail links (no password). */
	withPassword: boolean;
};

/** Local test accounts; passwords come from SEED_ACCOUNT_PASSWORD (never committed). */
export const accountSeeds: AccountSeed[] = [
	{
		email: "admin@harmonogram.local",
		name: "Administrator",
		role: "admin",
		withPassword: true,
	},
	{
		email: "nauczyciel@harmonogram.local",
		name: "Anna Nauczycielska",
		role: "user",
		withPassword: true,
	},
	{
		email: "student1@harmonogram.local",
		name: "Jan Kowalski",
		role: "user",
		withPassword: true,
	},
	{
		email: "student2@harmonogram.local",
		name: "Maria Nowak",
		role: "user",
		withPassword: true,
	},
	{
		email: "student3@harmonogram.local",
		name: "Piotr Wiśniewski",
		role: "user",
		withPassword: true,
	},
	{
		email: "student4@harmonogram.local",
		name: "Zofia Wójcik",
		role: "user",
		withPassword: true,
	},
	{
		email: "student5@harmonogram.local",
		name: "Tomasz Kamiński",
		role: "user",
		withPassword: true,
	},
	{
		email: "gosc@harmonogram.local",
		name: "Gość z linkiem",
		role: "user",
		withPassword: false,
	},
];

export type RegistrationSeed = { eventId: string; emails: string[] };

/** Registered in order: later people on a full event land on the waitlist. */
export const registrationSeeds: RegistrationSeed[] = [
	{
		eventId: FULL_EVENT_ID,
		emails: [
			"student1@harmonogram.local",
			"student2@harmonogram.local",
			"student3@harmonogram.local",
			"student4@harmonogram.local",
			"student5@harmonogram.local",
		],
	},
	{
		eventId: "evt-2",
		emails: ["student1@harmonogram.local", "student3@harmonogram.local"],
	},
	{
		eventId: "evt-career-day",
		emails: [
			"student2@harmonogram.local",
			"student4@harmonogram.local",
			"student5@harmonogram.local",
		],
	},
	{ eventId: "evt-law-lecture", emails: ["student1@harmonogram.local"] },
];

export type GroupSeed = {
	eventId: string;
	ownerEmail: string;
	name: string;
	places: number;
	invite: string[];
};

export const groupSeeds: GroupSeed[] = [
	{
		eventId: "evt-1",
		ownerEmail: "nauczyciel@harmonogram.local",
		name: "Klasa 3B",
		places: 4,
		invite: ["uczen1@szkola.example", "uczen2@szkola.example"],
	},
];
