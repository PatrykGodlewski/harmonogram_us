import type { AgendaLanguage } from "../agenda-languages";
import type { AgendaSessionColor, AgendaSpeaker } from "../schema/agenda";
import type {
	AttendanceMode,
	EventStatus,
	EventVisibility,
} from "../schema/events";
import {
	ALMOST_FULL_FESTIVAL_ITEM_ID,
	FESTIVAL_EVENT_ID,
	FULL_FESTIVAL_ITEM_ID,
	GROUP_FESTIVAL_ITEM_ID,
} from "./festival";
import { participantEmails } from "./participants";

/**
 * Showcase data: a few events, each showing several states of the app at once, and a
 * festival with a programme like Śląski Festiwal Nauki (`festival.ts`).
 */

export type LookupSeed = {
	id: string;
	slug: string;
	label: string;
	sortOrder: number;
};

export const eventTypeSeeds: LookupSeed[] = [
	{ id: "workshop", slug: "workshop", label: "Warsztaty", sortOrder: 1 },
	{ id: "lecture", slug: "lecture", label: "Wykłady", sortOrder: 2 },
	{ id: "show", slug: "show", label: "Pokazy", sortOrder: 3 },
	{ id: "panel", slug: "panel", label: "Panele dyskusyjne", sortOrder: 4 },
	{ id: "meeting", slug: "meeting", label: "Spotkania", sortOrder: 5 },
	{ id: "conference", slug: "conference", label: "Konferencje", sortOrder: 6 },
	{
		id: "special-event",
		slug: "special-event",
		label: "Wydarzenia specjalne",
		sortOrder: 7,
	},
];

export const eventLocationSeeds: LookupSeed[] = [
	{ id: "katowice", slug: "katowice", label: "Katowice", sortOrder: 1 },
	{ id: "sosnowiec", slug: "sosnowiec", label: "Sosnowiec", sortOrder: 2 },
	{ id: "chorzow", slug: "chorzow", label: "Chorzów", sortOrder: 3 },
	{
		id: "rynek-idei",
		slug: "rynek-idei",
		label: "Rynek Idei Miasta Nauki, Katowice",
		sortOrder: 4,
	},
	{
		id: "chorzow-wnst",
		slug: "chorzow-wnst",
		label: "Wydział Nauk Ścisłych i Technicznych, Chorzów",
		sortOrder: 5,
	},
	{ id: "online", slug: "online", label: "Online", sortOrder: 6 },
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
	/** Default "published". */
	status?: EventStatus;
	attendanceMode?: AttendanceMode;
	onlineUrl?: string;
	room?: string;
	requiresApproval?: boolean;
	certificatesEnabled?: boolean;
	visibility?: EventVisibility;
	/** Managed by the seeded organiser account (organizator@harmonogram.local). */
	organizer?: boolean;
};

/** Started an hour before the seed ran, hybrid: the programme shows what is on now. */
export const LIVE_NOW_EVENT_ID = "evt-live-now";
/** 15 places, all taken, 12 people on the waitlist. */
export const WAITLIST_EVENT_ID = "evt-long-waitlist";
/** One place left: the live seat count. */
export const LAST_SEAT_EVENT_ID = "evt-last-seat";
/** Teachers' groups: one with a join link, one closed; items for the whole group. */
export const OPEN_DAY_EVENT_ID = "evt-open-day";
/** Signed-in people only; registrations wait for approval: two pending, one declined. */
export const APPROVAL_EVENT_ID = "evt-phd-seminar";
/** Invite-only: not on the list; the organiser panel shows its invite link. */
export const INVITE_EVENT_ID = "evt-project-team";
/** Ended yesterday, with certificates: student1 was there, student2 was not. */
export const CERTIFICATE_EVENT_ID = "evt-first-aid-past";
/** Online, no programme, many places. */
export const ONLINE_EVENT_ID = "evt-online-training";
/** Cancelled: the page says so, registration is closed. */
export const CANCELLED_EVENT_ID = "evt-cancelled-lecture";
/** A draft: only in the panel. */
export const DRAFT_EVENT_ID = "evt-draft";

export const eventSeeds: EventSeed[] = [
	{
		id: FESTIVAL_EVENT_ID,
		title: "Śląski Festiwal Nauki",
		description:
			"Trzy dni nauki dla wszystkich: krótkie wystąpienia, wykłady, warsztaty dla dzieci i młodzieży oraz pokazy na Rynku Idei.\nNa wystąpienia i warsztaty obowiązują zapisy na konkretny punkt programu; pokazy są otwarte.",
		daysFromNow: 9,
		startHourUtc: 8,
		durationHours: 56,
		maxSeats: 600,
		typeId: "special-event",
		locationId: "rynek-idei",
		facultyId: "wnst",
		organizer: true,
	},
	{
		id: LIVE_NOW_EVENT_ID,
		title: "Wykład otwarty na żywo: jak działa szczepionka",
		description:
			"Wykład w auli i jednocześnie w internecie. Link do transmisji widzą zapisani.",
		daysFromNow: 0,
		hoursFromNow: -1,
		durationHours: 3,
		maxSeats: 120,
		typeId: "lecture",
		locationId: "katowice",
		facultyId: "wnp",
		attendanceMode: "hybrid",
		onlineUrl: "https://meet.example/szczepionka",
		room: "Aula A",
	},
	{
		id: WAITLIST_EVENT_ID,
		title: "Masterclass: projektowanie gier",
		description:
			"Kameralne zajęcia z twórcami gier. Miejsca się skończyły, ale działa lista rezerwowa: zwolnione miejsce dostaje pierwsza osoba z listy.",
		daysFromNow: 6,
		startHourUtc: 14,
		durationHours: 3,
		maxSeats: 15,
		typeId: "workshop",
		locationId: "katowice",
		facultyId: "wsne",
	},
	{
		id: LAST_SEAT_EVENT_ID,
		title: "Warsztaty origami — zostało ostatnie miejsce",
		daysFromNow: 4,
		startHourUtc: 15,
		durationHours: 2,
		maxSeats: 20,
		typeId: "workshop",
		locationId: "sosnowiec",
		facultyId: "wsne",
	},
	{
		id: OPEN_DAY_EVENT_ID,
		title: "Dzień otwarty dla szkół średnich",
		description:
			"Nauczyciele zapisują całe klasy: grupa rezerwuje miejsca, a uczniowie dołączają z linku lub z zaproszenia e-mailem.",
		daysFromNow: 12,
		durationHours: 5,
		groupDeadlineHours: 72,
		maxSeats: 80,
		typeId: "meeting",
		locationId: "chorzow",
		facultyId: "wnst",
	},
	{
		id: APPROVAL_EVENT_ID,
		title: "Seminarium doktoranckie (zapisy z akceptacją)",
		description: "Dla zalogowanych. Organizator zatwierdza każde zgłoszenie.",
		daysFromNow: 9,
		maxSeats: 2,
		typeId: "meeting",
		locationId: "katowice",
		facultyId: "wh",
		requiresApproval: true,
		visibility: "authenticated",
		organizer: true,
	},
	{
		id: INVITE_EVENT_ID,
		title: "Spotkanie zespołu projektowego (na zaproszenie)",
		daysFromNow: 5,
		maxSeats: 12,
		typeId: "meeting",
		locationId: "katowice",
		facultyId: "wnst",
		visibility: "private",
		organizer: true,
	},
	{
		id: CERTIFICATE_EVENT_ID,
		title: "Warsztaty pierwszej pomocy (zakończone, z zaświadczeniami)",
		daysFromNow: -1,
		durationHours: 4,
		maxSeats: 30,
		typeId: "workshop",
		locationId: "katowice",
		facultyId: "wnp",
		certificatesEnabled: true,
		organizer: true,
	},
	{
		id: ONLINE_EVENT_ID,
		title: "Szkolenie online: bezpieczeństwo informacji",
		description:
			"Godzinne szkolenie w internecie, bez programu. Link przyjdzie e-mailem.",
		daysFromNow: 20,
		startHourUtc: 16,
		durationHours: 1,
		maxSeats: 1000,
		typeId: "conference",
		locationId: "online",
		facultyId: "wpia",
		attendanceMode: "online",
		onlineUrl: "https://meet.example/bezpieczenstwo",
	},
	{
		id: CANCELLED_EVENT_ID,
		title: "Wykład gościnny: prawo nowych technologii (odwołany)",
		daysFromNow: 3,
		maxSeats: 80,
		typeId: "lecture",
		locationId: "katowice",
		facultyId: "wpia",
		status: "cancelled",
	},
	{
		id: DRAFT_EVENT_ID,
		title: "Konferencja jubileuszowa (szkic)",
		daysFromNow: 40,
		maxSeats: 200,
		typeId: "conference",
		locationId: "katowice",
		facultyId: "wh",
		status: "draft",
		organizer: true,
	},
];

/** A part of a programme with its own stage, colour and time (F33). */
export type AgendaSessionSeed = {
	id: string;
	eventId: string;
	title: string;
	description: string | null;
	color: AgendaSessionColor;
	locationId: string | null;
	/** Start, in minutes after the event starts. */
	startMinute: number;
	durationMinutes: number;
};

export type AgendaItemSeed = {
	id: string;
	eventId: string;
	sessionId?: string;
	title: string;
	description: string | null;
	/** Start, in minutes after the event starts. */
	startMinute: number;
	durationMinutes: number;
	locationId: string | null;
	maxSeats: number | null;
	requiresRegistration: boolean;
	typeId?: string;
	facultyId?: string;
	topic?: string;
	audience?: string;
	languages?: AgendaLanguage[];
	speakers?: AgendaSpeaker[];
	materials?: { label: string; url: string }[];
};

type AgendaOptions = Partial<
	Omit<
		AgendaItemSeed,
		"id" | "eventId" | "title" | "startMinute" | "durationMinutes"
	>
>;

/** One agenda item; ids are `agenda-<eventId>-<slug>`, start in minutes after the event starts. */
function agendaItem(
	eventId: string,
	slug: string,
	title: string,
	startMinute: number,
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
		description: null,
		startMinute,
		durationMinutes,
		locationId: event.locationId,
		maxSeats: null,
		requiresRegistration: true,
		...options,
	};
}

const LECTURER: AgendaSpeaker = {
	name: "dr Katarzyna Lis",
	affiliation: "Śląski Uniwersytet Medyczny",
	unit: "Wydział Nauk Medycznych w Katowicach",
	bio: "Immunolożka i lekarka. Zajmuje się odpowiedzią odpornościową na infekcje wirusowe.",
};

/** The festival's programme is in `festival.ts`; every agenda starts when its event does. */
export const agendaItemSeeds: AgendaItemSeed[] = [
	// On now: one part over, one running, one to come.
	agendaItem(
		LIVE_NOW_EVENT_ID,
		"intro",
		"Jak działa układ odpornościowy",
		0,
		50,
		{
			requiresRegistration: false,
			speakers: [LECTURER],
			topic: "Medycyna",
			languages: ["pl"],
		},
	),
	agendaItem(LIVE_NOW_EVENT_ID, "vaccines", "Od Jennera do mRNA", 60, 60, {
		requiresRegistration: false,
		speakers: [LECTURER],
		materials: [{ label: "Slajdy", url: "https://example.com/slajdy.pdf" }],
	}),
	agendaItem(LIVE_NOW_EVENT_ID, "qa", "Pytania od widzów", 130, 40, {
		requiresRegistration: false,
	}),
	agendaItem(WAITLIST_EVENT_ID, "talk", "Jak powstaje gra niezależna", 0, 60, {
		requiresRegistration: false,
	}),
	agendaItem(WAITLIST_EVENT_ID, "jam", "Mini game jam w parach", 60, 120, {
		maxSeats: 10,
	}),
	agendaItem(LAST_SEAT_EVENT_ID, "basics", "Podstawowe zagięcia", 0, 45),
	agendaItem(LAST_SEAT_EVENT_ID, "crane", "Żuraw i kwiat lotosu", 45, 60),
	agendaItem(OPEN_DAY_EVENT_ID, "welcome", "Powitanie w auli", 0, 30, {
		requiresRegistration: false,
	}),
	agendaItem(OPEN_DAY_EVENT_ID, "labs", "Zwiedzanie laboratoriów", 30, 90, {
		maxSeats: 40,
	}),
	agendaItem(OPEN_DAY_EVENT_ID, "robots", "Pokaz robotów", 30, 90, {
		maxSeats: 40,
		locationId: "katowice",
	}),
	agendaItem(
		OPEN_DAY_EVENT_ID,
		"talk",
		"Jak wybrać kierunek studiów",
		150,
		60,
		{
			requiresRegistration: false,
		},
	),
	agendaItem(
		CERTIFICATE_EVENT_ID,
		"theory",
		"Ocena sytuacji i wezwanie pomocy",
		0,
		60,
	),
	agendaItem(
		CERTIFICATE_EVENT_ID,
		"practice",
		"Resuscytacja na fantomach",
		75,
		120,
		{
			maxSeats: 15,
		},
	),
];

export type AccountSeed = {
	email: string;
	name: string;
	role: "user" | "organizer" | "admin";
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
		email: "organizator@harmonogram.local",
		name: "Olga Organizatorka",
		role: "organizer",
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
	{ eventId: LAST_SEAT_EVENT_ID, emails: participantEmails(1, 19) },
	// 15 places: participants 16–27 end up on the waitlist, in this order.
	{ eventId: WAITLIST_EVENT_ID, emails: participantEmails(1, 27) },
	{
		eventId: LIVE_NOW_EVENT_ID,
		emails: ["student2@harmonogram.local", ...participantEmails(5, 30)],
	},
	{ eventId: ONLINE_EVENT_ID, emails: participantEmails(1, 12) },
	// Ended: registered while still open, kept as the attendance record.
	{ eventId: CERTIFICATE_EVENT_ID, emails: participantEmails(20, 40) },
];

export type AgendaRegistrationSeed = { itemId: string; emails: string[] };

/** Registrations for single agenda items (F27); they also register for the event. */
export const agendaRegistrationSeeds: AgendaRegistrationSeed[] = [
	// All 30 places of "W cieniu sławy".
	{ itemId: FULL_FESTIVAL_ITEM_ID, emails: participantEmails(1, 30) },
	// 11 of 12: one place left.
	{ itemId: ALMOST_FULL_FESTIVAL_ITEM_ID, emails: participantEmails(31, 41) },
	{
		itemId: `agenda-${FESTIVAL_EVENT_ID}-d1-talk1`,
		emails: ["student1@harmonogram.local", ...participantEmails(40, 52)],
	},
	{
		itemId: `agenda-${FESTIVAL_EVENT_ID}-d2-lecture3`,
		emails: ["student1@harmonogram.local", ...participantEmails(1, 20)],
	},
	{
		itemId: `agenda-${FESTIVAL_EVENT_ID}-d3-panel`,
		emails: ["student4@harmonogram.local", ...participantEmails(20, 40)],
	},
	{
		itemId: `agenda-${OPEN_DAY_EVENT_ID}-labs`,
		emails: participantEmails(1, 10),
	},
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
		eventId: OPEN_DAY_EVENT_ID,
		ownerEmail: "nauczyciel@harmonogram.local",
		name: "Klasa 3B",
		places: 6,
		itemIds: [`agenda-${OPEN_DAY_EVENT_ID}-labs`],
		invite: [
			"uczen1@szkola.example",
			"uczen2@szkola.example",
			"student5@harmonogram.local",
		],
		accept: ["student5@harmonogram.local"],
		joinLinkEnabled: true,
	},
	{
		eventId: OPEN_DAY_EVENT_ID,
		ownerEmail: "nauczyciel2@harmonogram.local",
		name: "Koło robotyczne LO nr 2",
		places: 4,
		itemIds: [`agenda-${OPEN_DAY_EVENT_ID}-robots`],
		invite: ["student2@harmonogram.local", "uczen3@szkola.example"],
		accept: ["student2@harmonogram.local"],
		joinLinkEnabled: false,
		close: true,
	},
	{
		eventId: FESTIVAL_EVENT_ID,
		ownerEmail: "nauczyciel@harmonogram.local",
		name: "Wycieczka klas 2A i 2C",
		places: 8,
		itemIds: [GROUP_FESTIVAL_ITEM_ID],
		invite: [
			...participantEmails(53, 58),
			"uczen7@szkola.example",
			"uczen8@szkola.example",
		],
		accept: participantEmails(53, 56),
		joinLinkEnabled: true,
	},
];
