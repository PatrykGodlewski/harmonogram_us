import { participantEmails } from "./generated";

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
	description?: string;
	/** Day of the event, relative to today. Ignored when `hoursFromNow` is set. */
	daysFromNow: number;
	/** Start hour (UTC) on that day; default 9. */
	startHourUtc?: number;
	/** Start relative to now, rounded down to the hour: an event that is on right now. */
	hoursFromNow?: number;
	/** Sets `ends_at`; without it the event ends when its agenda does (or at its start). */
	durationHours?: number;
	/** Hours before the start when group places are released; default 48. */
	groupDeadlineHours?: number;
	maxSeats: number;
	typeId: string;
	locationId: string;
	facultyId: string;
};

/** Seeded event that fills up, so the waitlist has people on it. */
export const FULL_EVENT_ID = "evt-full-seminar";
/** Three-day event with parallel tracks in several cities. */
export const FESTIVAL_EVENT_ID = "evt-science-festival";
/** Started an hour before the seed ran: the agenda shows the current time. */
export const LIVE_NOW_EVENT_ID = "evt-live-now";
/** One place left: shows the live seat count. */
export const LAST_SEAT_EVENT_ID = "evt-last-seat";
/** Full, with a long waitlist. */
export const WAITLIST_EVENT_ID = "evt-long-waitlist";
/** Registration per session (F27); one session is full. */
export const SESSIONS_EVENT_ID = "evt-language-day";
/** Ended, with registrations kept as the attendance record. */
export const PAST_ATTENDED_EVENT_ID = "evt-past-biology-night";

export const eventSeeds: EventSeed[] = [
	{
		id: "evt-1",
		title: "Warsztaty z programowania",
		description:
			"Dzień praktycznych warsztatów dla początkujących i średniozaawansowanych.\nWarsztaty webowe i robotyczne odbywają się równolegle — zapisz się na jeden z nich.",
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
		description:
			"Konferencja online z równoległymi panelami. Link do transmisji przyjdzie e-mailem dzień przed wydarzeniem.",
		daysFromNow: 21,
		maxSeats: 50,
		typeId: "conference",
		locationId: "online",
		facultyId: "wns",
	},
	{
		id: FULL_EVENT_ID,
		title: "Seminarium: sztuczna inteligencja w nauce",
		description:
			"Kameralne seminarium na 3 osoby — miejsca szybko się kończą, ale działa lista rezerwowa.",
		daysFromNow: 5,
		maxSeats: 3,
		typeId: "meeting",
		locationId: "katowice",
		facultyId: "wnst",
	},
	{
		id: "evt-career-day",
		title: "Dzień kariery — spotkania z pracodawcami",
		description:
			"Targi pracodawców są otwarte bez zapisów. Na warsztaty i symulacje rozmów obowiązują osobne zapisy.",
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

	// --- Showcase: one event per feature worth demonstrating ---
	{
		id: FESTIVAL_EVENT_ID,
		title: "Śląski Festiwal Nauki",
		description:
			"Trzy dni pokazów, wykładów i warsztatów w trzech miastach.\nWstęp na festiwal wymaga zapisu; na warsztaty z limitem miejsc zapisujesz się osobno. Równoległe ścieżki widać obok siebie w widoku kalendarza.",
		daysFromNow: 9,
		durationHours: 57,
		groupDeadlineHours: 72,
		maxSeats: 500,
		typeId: "special-event",
		locationId: "katowice",
		facultyId: "wnp",
	},
	{
		id: "evt-hackathon",
		title: "Hackathon 24h: miasto przyszłości",
		description:
			"Całodobowy hackathon w zespołach. Program biegnie przez noc — sprawdź, jak wygląda w kalendarzu.",
		daysFromNow: 15,
		startHourUtc: 15,
		durationHours: 24,
		maxSeats: 40,
		typeId: "competition",
		locationId: "chorzow",
		facultyId: "wnst",
	},
	{
		id: LIVE_NOW_EVENT_ID,
		title: "Wykład otwarty na żywo: jak działa szczepionka",
		description:
			"To wydarzenie właśnie trwa: na programie widać linię bieżącej godziny.",
		daysFromNow: 0,
		hoursFromNow: -1,
		durationHours: 3,
		maxSeats: 120,
		typeId: "lecture",
		locationId: "online",
		facultyId: "wnp",
	},
	{
		id: LAST_SEAT_EVENT_ID,
		title: "Warsztaty origami — zostało ostatnie miejsce",
		description:
			"Zostało jedno wolne miejsce. Otwórz stronę w dwóch przeglądarkach i zapisz się w jednej — licznik w drugiej zmieni się bez odświeżania.",
		daysFromNow: 4,
		startHourUtc: 14,
		durationHours: 2,
		maxSeats: 20,
		typeId: "workshop",
		locationId: "sosnowiec",
		facultyId: "wsne",
	},
	{
		id: WAITLIST_EVENT_ID,
		title: "Masterclass: projektowanie gier",
		description:
			"Komplet miejsc i długa lista rezerwowa. Gdy ktoś zrezygnuje, pierwsza osoba z listy dostaje miejsce automatycznie i e-mail.",
		daysFromNow: 6,
		startHourUtc: 13,
		durationHours: 3,
		maxSeats: 15,
		typeId: "workshop",
		locationId: "katowice",
		facultyId: "sf",
	},
	{
		id: "evt-online-training",
		title: "Szkolenie online: bezpieczeństwo informacji",
		description:
			"Obowiązkowe szkolenie dla pracowników i doktorantów. Duży limit miejsc, zapisy przez cały semestr.",
		daysFromNow: 40,
		startHourUtc: 11,
		durationHours: 1,
		maxSeats: 1000,
		typeId: "lecture",
		locationId: "online",
		facultyId: "wpia",
	},
	{
		id: SESSIONS_EVENT_ID,
		title: "Dzień języków obcych — zapisy na sesje",
		description:
			"Każda sesja ma własny limit miejsc i osobny zapis. Zapis na sesję zapisuje też na wydarzenie. Konwersacje po hiszpańsku są już pełne.",
		daysFromNow: 11,
		durationHours: 6,
		maxSeats: 80,
		typeId: "workshop",
		locationId: "katowice",
		facultyId: "wh",
	},
	{
		id: "evt-no-agenda",
		title: "Spotkanie wolontariuszy",
		description: "Krótkie spotkanie bez programu — tylko zapis na wydarzenie.",
		daysFromNow: 2,
		startHourUtc: 16,
		maxSeats: 30,
		typeId: "meeting",
		locationId: "cieszyn",
		facultyId: "wtl",
	},
	{
		id: PAST_ATTENDED_EVENT_ID,
		title: "Noc Biologów (archiwum)",
		description:
			"Wydarzenie już się odbyło. Zapisy zostają jako lista obecności — nie można się już zapisać ani wypisać.",
		daysFromNow: -13,
		startHourUtc: 15,
		durationHours: 6,
		maxSeats: 60,
		typeId: "special-event",
		locationId: "katowice",
		facultyId: "wnp",
	},
];

export type AgendaItemSeed = {
	id: string;
	eventId: string;
	title: string;
	description: string | null;
	/** Start, in hours after the event starts. */
	startHour: number;
	durationMinutes: number;
	locationId: string | null;
	maxSeats: number | null;
	requiresRegistration: boolean;
};

type AgendaOptions = Partial<
	Pick<
		AgendaItemSeed,
		"description" | "locationId" | "maxSeats" | "requiresRegistration"
	>
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
		description: options.description ?? null,
		startHour,
		durationMinutes,
		locationId:
			options.locationId === undefined ? event.locationId : options.locationId,
		maxSeats: options.maxSeats ?? null,
		requiresRegistration: options.requiresRegistration ?? true,
	};
}

/** One festival day: opening, three parallel tracks (city, seat limit), evening lecture. */
function festivalDay(
	day: number,
	theme: string,
	tracks: [title: string, locationId: string, maxSeats: number | null][],
): AgendaItemSeed[] {
	const start = day * 24;
	return [
		agendaItem(FESTIVAL_EVENT_ID, `d${day + 1}-opening`, theme, start, 45, {
			requiresRegistration: false,
		}),
		...tracks.map(([title, locationId, maxSeats], track) =>
			agendaItem(
				FESTIVAL_EVENT_ID,
				`d${day + 1}-track${track + 1}`,
				title,
				start + 1,
				150,
				{ locationId, maxSeats },
			),
		),
		agendaItem(
			FESTIVAL_EVENT_ID,
			`d${day + 1}-evening`,
			"Wykład wieczorny",
			start + 7,
			90,
			{ maxSeats: 200 },
		),
	];
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

	// Śląski Festiwal Nauki: three days, parallel tracks in different cities
	...festivalDay(0, "Dzień 1: nauki ścisłe", [
		["Pokazy chemiczne", "katowice", 40],
		["Planetarium mobilne", "chorzow", 30],
		["Warsztaty z lutowania", "sosnowiec", 12],
	]),
	...festivalDay(1, "Dzień 2: przyroda i zdrowie", [
		["Laboratorium DNA", "katowice", 16],
		["Spacer botaniczny", "cieszyn", 25],
		["Pierwsza pomoc w praktyce", "sosnowiec", 20],
	]),
	...festivalDay(2, "Dzień 3: technologia i społeczeństwo", [
		["Roboty w akcji", "chorzow", 50],
		["Debata: AI w szkole", "online", null],
		["Gra miejska", "katowice", 60],
	]),

	// Hackathon: the programme runs through the night
	agendaItem("evt-hackathon", "kickoff", "Start i prezentacja wyzwań", 0, 60),
	agendaItem("evt-hackathon", "hacking", "Praca w zespołach", 1, 600, {
		requiresRegistration: false,
	}),
	agendaItem("evt-hackathon", "pizza", "Nocna pizza", 6, 60, {
		locationId: null,
		requiresRegistration: false,
	}),
	agendaItem("evt-hackathon", "mentors", "Konsultacje z mentorami", 11, 120, {
		maxSeats: 20,
	}),
	agendaItem("evt-hackathon", "demo", "Prezentacje projektów", 21, 120),
	agendaItem("evt-hackathon", "awards", "Ogłoszenie zwycięzców", 23.25, 45, {
		requiresRegistration: false,
	}),

	// Live now: one item done, one on, one to come
	agendaItem(
		LIVE_NOW_EVENT_ID,
		"intro",
		"Wprowadzenie: układ odpornościowy",
		0,
		50,
	),
	agendaItem(
		LIVE_NOW_EVENT_ID,
		"lecture",
		"Wykład: od białka do szczepionki",
		0.9,
		80,
	),
	agendaItem(LIVE_NOW_EVENT_ID, "qa", "Pytania od widzów", 2.4, 36, {
		requiresRegistration: false,
	}),

	// Language day: every session has its own limit; Spanish is full
	agendaItem(SESSIONS_EVENT_ID, "english", "Konwersacje: angielski", 0, 90, {
		maxSeats: 12,
		description: "Poziom B1–B2, grupy po sześć osób.",
	}),
	agendaItem(SESSIONS_EVENT_ID, "spanish", "Konwersacje: hiszpański", 0, 90, {
		maxSeats: 8,
		description: "Komplet zapisów.",
	}),
	agendaItem(SESSIONS_EVENT_ID, "german", "Konwersacje: niemiecki", 0, 90, {
		maxSeats: 10,
	}),
	agendaItem(SESSIONS_EVENT_ID, "lunch", "Przerwa obiadowa", 1.5, 60, {
		locationId: null,
		requiresRegistration: false,
	}),
	agendaItem(
		SESSIONS_EVENT_ID,
		"japanese",
		"Pierwsze kroki: japoński",
		2.5,
		120,
		{
			maxSeats: 15,
		},
	),
	agendaItem(SESSIONS_EVENT_ID, "quiz", "Quiz językowy z nagrodami", 4.5, 60, {
		requiresRegistration: false,
	}),

	agendaItem(LAST_SEAT_EVENT_ID, "basics", "Podstawowe zagięcia", 0, 45),
	agendaItem(LAST_SEAT_EVENT_ID, "crane", "Żuraw i kwiat lotosu", 0.75, 60),
	agendaItem(LAST_SEAT_EVENT_ID, "show", "Wystawa prac uczestników", 1.75, 15, {
		requiresRegistration: false,
	}),

	agendaItem(
		WAITLIST_EVENT_ID,
		"talk",
		"Jak powstaje gra: od pomysłu do premiery",
		0,
		60,
	),
	agendaItem(WAITLIST_EVENT_ID, "jam", "Mini game jam w parach", 1, 90, {
		description: "Przynieś laptopa z zainstalowanym Godotem lub Unity.",
	}),
	agendaItem(
		WAITLIST_EVENT_ID,
		"review",
		"Pokaz i omówienie prototypów",
		2.5,
		30,
	),

	agendaItem("evt-online-training", "module", "Moduł szkoleniowy", 0, 45),
	agendaItem("evt-online-training", "test", "Test sprawdzający", 0.75, 15, {
		requiresRegistration: false,
		description: "Zaliczenie testu jest warunkiem otrzymania zaświadczenia.",
	}),

	agendaItem(PAST_ATTENDED_EVENT_ID, "lab", "Nocne laboratorium", 0, 180, {
		maxSeats: 30,
	}),
	agendaItem(
		PAST_ATTENDED_EVENT_ID,
		"talk",
		"Wykład: życie w ciemności",
		3.5,
		60,
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
		email: "nauczyciel2@harmonogram.local",
		name: "Krzysztof Opiekun",
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

	// Showcase events (participants 1–40 are reserved for these)
	{ eventId: LAST_SEAT_EVENT_ID, emails: participantEmails(1, 19) },
	// 15 places: participants 16–27 end up on the waitlist, in this order.
	{ eventId: WAITLIST_EVENT_ID, emails: participantEmails(1, 27) },
	{
		eventId: LIVE_NOW_EVENT_ID,
		emails: ["student2@harmonogram.local", ...participantEmails(5, 30)],
	},
	{
		eventId: FESTIVAL_EVENT_ID,
		emails: [
			"student1@harmonogram.local",
			"student4@harmonogram.local",
			...participantEmails(1, 40),
		],
	},
	{ eventId: "evt-hackathon", emails: participantEmails(10, 33) },
	{ eventId: "evt-online-training", emails: participantEmails(1, 12) },
	{ eventId: "evt-no-agenda", emails: participantEmails(30, 36) },
	// Ended events: registered while still open, kept as the attendance record.
	{
		eventId: PAST_ATTENDED_EVENT_ID,
		emails: ["student1@harmonogram.local", ...participantEmails(20, 40)],
	},
	{ eventId: "evt-past-lecture", emails: participantEmails(1, 35) },
	{
		eventId: "evt-past-workshop",
		emails: ["student3@harmonogram.local", ...participantEmails(8, 22)],
	},
];

export type AgendaRegistrationSeed = { itemId: string; emails: string[] };

/** Registrations for single agenda items (F27); they also register for the event. */
export const agendaRegistrationSeeds: AgendaRegistrationSeed[] = [
	// Fills the 8 places of the Spanish session.
	{
		itemId: `agenda-${SESSIONS_EVENT_ID}-spanish`,
		emails: participantEmails(28, 35),
	},
	{
		itemId: `agenda-${SESSIONS_EVENT_ID}-english`,
		emails: ["student1@harmonogram.local", ...participantEmails(1, 7)],
	},
	{
		itemId: `agenda-${SESSIONS_EVENT_ID}-japanese`,
		emails: participantEmails(3, 11),
	},
	{
		itemId: `agenda-${FESTIVAL_EVENT_ID}-d1-track3`,
		emails: ["student1@harmonogram.local", ...participantEmails(1, 10)],
	},
	{
		itemId: `agenda-${FESTIVAL_EVENT_ID}-d2-track1`,
		emails: participantEmails(11, 26),
	},
	{
		itemId: `agenda-${FESTIVAL_EVENT_ID}-d3-track3`,
		emails: ["student4@harmonogram.local", ...participantEmails(20, 40)],
	},
	{ itemId: "agenda-evt-1-robotics", emails: participantEmails(1, 10) },
	{ itemId: "agenda-evt-hackathon-mentors", emails: participantEmails(10, 25) },
];

export type GroupSeed = {
	eventId: string;
	ownerEmail: string;
	name: string;
	places: number;
	/** Agenda items the whole group attends. */
	itemIds: string[];
	invite: string[];
	/** Invited people with a seeded account who accept the invitation. */
	accept: string[];
	joinLinkEnabled: boolean;
	/** Closed by the owner: unused places go back to the event. */
	close?: boolean;
};

export const groupSeeds: GroupSeed[] = [
	{
		eventId: "evt-1",
		ownerEmail: "nauczyciel@harmonogram.local",
		name: "Klasa 3B",
		places: 4,
		itemIds: ["agenda-evt-1-web"],
		invite: [
			"uczen1@szkola.example",
			"uczen2@szkola.example",
			"student5@harmonogram.local",
		],
		accept: ["student5@harmonogram.local"],
		joinLinkEnabled: true,
	},
	{
		eventId: "evt-robotics-contest",
		ownerEmail: "nauczyciel2@harmonogram.local",
		name: "Drużyna robotyczna LO nr 2",
		places: 5,
		itemIds: [
			"agenda-evt-robotics-contest-qualifying",
			"agenda-evt-robotics-contest-final",
		],
		invite: [
			"uczen3@szkola.example",
			"student2@harmonogram.local",
			"student3@harmonogram.local",
		],
		accept: ["student2@harmonogram.local", "student3@harmonogram.local"],
		joinLinkEnabled: true,
	},
	{
		eventId: "evt-arts-exhibition",
		ownerEmail: "nauczyciel@harmonogram.local",
		name: "Koło plastyczne",
		places: 3,
		itemIds: ["agenda-evt-arts-exhibition-tour"],
		invite: ["student4@harmonogram.local", "uczen4@szkola.example"],
		accept: ["student4@harmonogram.local"],
		joinLinkEnabled: false,
		close: true,
	},
	{
		eventId: "evt-career-day",
		ownerEmail: "nauczyciel2@harmonogram.local",
		name: "Rok III informatyki",
		places: 6,
		itemIds: [],
		invite: [
			"student1@harmonogram.local",
			"uczen5@szkola.example",
			"uczen6@szkola.example",
		],
		accept: ["student1@harmonogram.local"],
		joinLinkEnabled: true,
	},
	{
		eventId: FESTIVAL_EVENT_ID,
		ownerEmail: "nauczyciel@harmonogram.local",
		name: "Wycieczka klas 2A i 2C",
		places: 12,
		itemIds: [`agenda-${FESTIVAL_EVENT_ID}-d1-track1`],
		invite: [
			...participantEmails(41, 48),
			"uczen7@szkola.example",
			"uczen8@szkola.example",
		],
		accept: participantEmails(41, 46),
		joinLinkEnabled: true,
	},
	{
		eventId: "evt-hackathon",
		ownerEmail: "nauczyciel2@harmonogram.local",
		name: "Zespół „Smart Silesia”",
		places: 4,
		itemIds: ["agenda-evt-hackathon-mentors"],
		invite: participantEmails(49, 52),
		accept: participantEmails(49, 52),
		joinLinkEnabled: false,
	},
];
