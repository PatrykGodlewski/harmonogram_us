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

type AgendaOptions = Partial<
	Pick<AgendaItemSeed, "locationId" | "maxSeats" | "requiresRegistration">
>;

/** One agenda item; ids are `agenda-<eventId>-<slug>`, start is hours after the event starts. */
function agendaItem(
	eventId: string,
	slug: string,
	title: string,
	startHour: number,
	durationMinutes: number,
	options: AgendaOptions = {},
): AgendaItemSeed {
	const event = eventSeeds.find((seed) => seed.id === eventId);
	if (!event) {
		throw new Error(`Agenda seed refers to unknown event ${eventId}`);
	}
	return {
		id: `agenda-${eventId}-${slug}`,
		eventId,
		title,
		startHour,
		durationMinutes,
		locationId:
			options.locationId === undefined ? event.locationId : options.locationId,
		maxSeats: options.maxSeats ?? null,
		requiresRegistration: options.requiresRegistration ?? true,
	};
}

/** Every event's agenda starts when the event starts (startHour 0). */
export const agendaItemSeeds: AgendaItemSeed[] = [
	// Warsztaty z programowania: parallel workshops with their own limits
	agendaItem("evt-1", "opening", "Otwarcie i wprowadzenie", 0, 60),
	agendaItem("evt-1", "web", "Warsztat: aplikacje webowe", 1.5, 90, {
		maxSeats: 15,
	}),
	agendaItem("evt-1", "robotics", "Warsztat: robotyka", 2, 90, {
		locationId: "chorzow",
		maxSeats: 10,
	}),
	agendaItem("evt-1", "break", "Przerwa kawowa", 3.5, 30, {
		locationId: null,
		requiresRegistration: false,
	}),

	agendaItem("evt-2", "lecture", "Wykład: sztuka renesansu na Śląsku", 0, 90),
	agendaItem("evt-2", "discussion", "Dyskusja z prelegentką", 1.75, 45, {
		requiresRegistration: false,
	}),

	// Konferencja naukowa (online): plenary sessions and parallel panels
	agendaItem("evt-3", "opening", "Otwarcie konferencji", 0, 30, {
		requiresRegistration: false,
	}),
	agendaItem("evt-3", "keynote", "Wykład plenarny: nauka otwarta", 0.5, 60),
	agendaItem("evt-3", "panel-social", "Panel: nauki społeczne", 2, 90, {
		maxSeats: 25,
	}),
	agendaItem("evt-3", "panel-media", "Panel: media i komunikacja", 2, 90, {
		maxSeats: 25,
	}),
	agendaItem("evt-3", "closing", "Podsumowanie i zamknięcie", 4, 30, {
		requiresRegistration: false,
	}),

	agendaItem(
		FULL_EVENT_ID,
		"talk",
		"Referat: modele językowe w badaniach",
		0,
		60,
	),
	agendaItem(
		FULL_EVENT_ID,
		"workshop",
		"Ćwiczenia z narzędziami AI",
		1.25,
		75,
		{ maxSeats: 2 },
	),

	// Dzień kariery: open fair with limited workshops
	agendaItem("evt-career-day", "fair", "Targi pracodawców", 0, 300, {
		requiresRegistration: false,
	}),
	agendaItem("evt-career-day", "cv", "Warsztat: CV i list motywacyjny", 1, 60, {
		maxSeats: 20,
	}),
	agendaItem(
		"evt-career-day",
		"interview",
		"Symulacje rozmów kwalifikacyjnych",
		2.5,
		90,
		{ maxSeats: 12 },
	),
	agendaItem("evt-career-day", "linkedin", "Profil zawodowy w sieci", 4, 45, {
		maxSeats: 30,
	}),

	agendaItem(
		"evt-law-lecture",
		"lecture",
		"Wykład: sztuczna inteligencja a prawo",
		0,
		75,
	),
	agendaItem("evt-law-lecture", "qa", "Pytania od słuchaczy", 1.25, 30, {
		requiresRegistration: false,
	}),

	agendaItem("evt-theology-meeting", "paper", "Referat członka koła", 0, 45),
	agendaItem(
		"evt-theology-meeting",
		"discussion",
		"Dyskusja i plany na semestr",
		0.75,
		45,
		{ requiresRegistration: false },
	),

	agendaItem("evt-arts-exhibition", "vernissage", "Wernisaż", 0, 90, {
		requiresRegistration: false,
	}),
	agendaItem("evt-arts-exhibition", "tour", "Oprowadzanie z kuratorką", 2, 60, {
		maxSeats: 20,
	}),
	agendaItem(
		"evt-arts-exhibition",
		"workshop",
		"Warsztaty grafiki dla gości",
		3,
		90,
		{ maxSeats: 15 },
	),

	// Konkurs robotyki: stages of the competition
	agendaItem("evt-robotics-contest", "check-in", "Rejestracja drużyn", 0, 45, {
		requiresRegistration: false,
	}),
	agendaItem("evt-robotics-contest", "qualifying", "Eliminacje", 0.75, 150),
	agendaItem("evt-robotics-contest", "final", "Finał", 4, 90),
	agendaItem("evt-robotics-contest", "awards", "Ogłoszenie wyników", 5.5, 30, {
		requiresRegistration: false,
	}),

	agendaItem(
		"evt-graduation",
		"ceremony",
		"Uroczyste wręczenie dyplomów",
		0,
		120,
	),
	agendaItem("evt-graduation", "photos", "Wspólne zdjęcia", 2, 30, {
		requiresRegistration: false,
	}),
	agendaItem(
		"evt-graduation",
		"reception",
		"Poczęstunek dla absolwentów",
		2.5,
		90,
		{ maxSeats: 150 },
	),

	agendaItem(
		"evt-past-lecture",
		"speeches",
		"Przemówienia władz uczelni",
		0,
		45,
		{ requiresRegistration: false },
	),
	agendaItem("evt-past-lecture", "lecture", "Wykład inauguracyjny", 0.75, 60),

	agendaItem(
		"evt-past-workshop",
		"structure",
		"Struktura pracy dyplomowej",
		0,
		90,
	),
	agendaItem(
		"evt-past-workshop",
		"sources",
		"Praca ze źródłami i przypisami",
		1.75,
		90,
		{ maxSeats: 20 },
	),
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
