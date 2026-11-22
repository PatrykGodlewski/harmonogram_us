import type {
	AccountSeed,
	AgendaItemSeed,
	AgendaRegistrationSeed,
	EventSeed,
	RegistrationSeed,
} from "./data";

/**
 * Bulk sample data: many participants and events with varied popularity, so the event
 * list pages and filters have something to work with. A fixed-seed generator makes
 * every run produce the same ids and choices, which keeps the seed idempotent.
 */

/** mulberry32: small deterministic PRNG. */
function createRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

const random = createRandom(20261122);

function pick<T>(items: readonly T[]): T {
	const item = items[Math.floor(random() * items.length)];
	if (item === undefined) {
		throw new Error("pick() from an empty list");
	}
	return item;
}

function between(min: number, max: number): number {
	return min + Math.floor(random() * (max - min + 1));
}

/** `count` distinct items in random order. */
function sample<T>(items: readonly T[], count: number): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
	}
	return copy.slice(0, count);
}

// --- Participants ---

export const PARTICIPANT_COUNT = 150;

const FIRST_NAMES = [
	"Adam",
	"Agnieszka",
	"Aleksandra",
	"Bartosz",
	"Dominika",
	"Filip",
	"Hanna",
	"Igor",
	"Julia",
	"Kacper",
	"Karolina",
	"Lena",
	"Łukasz",
	"Magdalena",
	"Mateusz",
	"Michał",
	"Natalia",
	"Oliwia",
	"Paweł",
	"Rafał",
	"Szymon",
	"Weronika",
	"Wiktor",
	"Zuzanna",
	"Jakub",
	"Emilia",
	"Marcel",
	"Amelia",
	"Antoni",
	"Maja",
] as const;

const LAST_NAMES = [
	"Nowak",
	"Kowalczyk",
	"Lewandowski",
	"Zieliński",
	"Szymański",
	"Woźniak",
	"Dąbrowski",
	"Kozłowski",
	"Jankowski",
	"Mazur",
	"Kwiatkowski",
	"Krawczyk",
	"Piotrowski",
	"Grabowski",
	"Pawłowski",
	"Michalski",
	"Król",
	"Wieczorek",
	"Jabłoński",
	"Wróbel",
	"Majewski",
	"Olszewski",
	"Stępień",
	"Malinowski",
] as const;

/** Generated participants sign in with e-mail links: `uczestnik001@harmonogram.local`, … */
export function participantEmail(index: number): string {
	return `uczestnik${String(index).padStart(3, "0")}@harmonogram.local`;
}

/** Participants `from`..`to` (1-based, inclusive). */
export function participantEmails(from: number, to: number): string[] {
	const emails: string[] = [];
	for (let index = from; index <= to; index++) {
		emails.push(participantEmail(index));
	}
	return emails;
}

export const generatedAccountSeeds: AccountSeed[] = participantEmails(
	1,
	PARTICIPANT_COUNT,
).map((email) => ({
	email,
	name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
	role: "user",
	withPassword: false,
}));

/**
 * Participants 1–40 are left to the hand-written showcase events; generated events
 * draw from the rest, so the two never step on each other's waitlists.
 */
const generatedPool = participantEmails(41, PARTICIPANT_COUNT);

// --- Events ---

/** One agenda item of a template; times are minutes after the event starts. */
type Part = {
	title: string;
	at: number;
	minutes: number;
	/** Own limit: a share of the event's places, or a fixed number. Omitted: no limit. */
	seats?: "half" | "third" | number;
	/** No registration needed (breaks, plenary parts, open fairs). */
	open?: boolean;
	/** "elsewhere": another campus; "none": no location (e.g. a break). Default: the event's. */
	place?: "elsewhere" | "none";
	description?: string;
};

type EventTemplate = {
	typeId: string;
	titles: readonly string[];
	seats: readonly number[];
	/** Typical start, hours after midnight UTC. */
	startHours: readonly number[];
	/** Agenda layouts; each event gets one. Items with the same `at` run in parallel. */
	agendas: readonly (readonly Part[])[];
};

const TEMPLATES: readonly EventTemplate[] = [
	{
		typeId: "workshop",
		titles: [
			"Warsztaty: analiza danych w Pythonie",
			"Warsztaty fotografii mobilnej",
			"Warsztaty wystąpień publicznych",
			"Warsztaty: pierwsza aplikacja mobilna",
			"Warsztaty z negocjacji",
			"Warsztaty: druk 3D od podstaw",
			"Warsztaty kreatywnego pisania",
			"Warsztaty: zarządzanie czasem w sesji",
		],
		seats: [12, 15, 20, 24, 30],
		startHours: [8, 9, 12, 14],
		agendas: [
			[
				{ title: "Wprowadzenie", at: 0, minutes: 30, open: true },
				{ title: "Część praktyczna", at: 30, minutes: 90, seats: "half" },
				{ title: "Omówienie wyników", at: 120, minutes: 30, open: true },
			],
			[
				{
					title: "Powitanie i podział na grupy",
					at: 0,
					minutes: 15,
					open: true,
				},
				{ title: "Grupa A: podstawy", at: 15, minutes: 120, seats: "half" },
				{
					title: "Grupa B: dla zaawansowanych",
					at: 15,
					minutes: 120,
					seats: "half",
					description: "Dla osób, które znają już podstawy.",
				},
				{ title: "Przerwa", at: 135, minutes: 15, open: true, place: "none" },
				{ title: "Prezentacja prac", at: 150, minutes: 45 },
			],
		],
	},
	{
		typeId: "lecture",
		titles: [
			"Wykład otwarty: kosmologia dla każdego",
			"Wykład: historia Górnego Śląska",
			"Wykład: etyka sztucznej inteligencji",
			"Wykład: mikrobiom człowieka",
			"Wykład: prawo autorskie w internecie",
			"Wykład: psychologia motywacji",
			"Wykład gościnny: ekonomia klimatu",
			"Wykład: matematyka w muzyce",
		],
		seats: [60, 80, 120, 200, 300],
		startHours: [10, 12, 15, 16],
		agendas: [
			[
				{ title: "Wykład", at: 0, minutes: 60 },
				{ title: "Pytania z sali", at: 60, minutes: 30, open: true },
			],
			[
				{ title: "Powitanie gościa", at: 0, minutes: 10, open: true },
				{ title: "Wykład", at: 10, minutes: 80 },
				{ title: "Dyskusja panelowa", at: 90, minutes: 45, open: true },
				{
					title: "Spotkanie z prelegentem",
					at: 135,
					minutes: 30,
					seats: 20,
					description: "Rozmowa w małej grupie przy kawie.",
				},
			],
		],
	},
	{
		typeId: "meeting",
		titles: [
			"Spotkanie koła naukowego informatyków",
			"Spotkanie z absolwentami",
			"Dyżur samorządu studenckiego",
			"Spotkanie koła filmowego",
			"Spotkanie informacyjne Erasmus+",
			"Spotkanie koła psychologii",
		],
		seats: [15, 20, 25, 40],
		startHours: [14, 15, 16, 17],
		agendas: [
			[
				{ title: "Sprawy organizacyjne", at: 0, minutes: 30, open: true },
				{ title: "Prezentacja projektu", at: 30, minutes: 45 },
				{ title: "Plan działań", at: 75, minutes: 30, open: true },
			],
			[
				{ title: "Krótkie prezentacje członków", at: 0, minutes: 60 },
				{
					title: "Rozmowy przy kawie",
					at: 60,
					minutes: 45,
					open: true,
					place: "none",
				},
			],
		],
	},
	{
		typeId: "conference",
		titles: [
			"Konferencja: cyfrowa humanistyka",
			"Konferencja studencka nauk przyrodniczych",
			"Konferencja: bezpieczeństwo w sieci",
			"Konferencja: edukacja przyszłości",
		],
		seats: [100, 150, 250],
		startHours: [8],
		agendas: [
			[
				{ title: "Otwarcie", at: 0, minutes: 30, open: true },
				{ title: "Sesja plenarna", at: 30, minutes: 90 },
				{
					title: "Przerwa kawowa",
					at: 120,
					minutes: 30,
					open: true,
					place: "none",
				},
				{ title: "Sesja A: badania", at: 150, minutes: 90, seats: "third" },
				{ title: "Sesja B: praktyka", at: 150, minutes: 90, seats: "third" },
				{
					title: "Sesja C: w drugim kampusie",
					at: 150,
					minutes: 90,
					seats: "third",
					place: "elsewhere",
				},
				{ title: "Lunch", at: 240, minutes: 60, open: true, place: "none" },
				{ title: "Sesja posterowa", at: 300, minutes: 90, seats: "half" },
				{ title: "Podsumowanie", at: 390, minutes: 30, open: true },
			],
		],
	},
	{
		typeId: "exhibition",
		titles: [
			"Wystawa: plakat polski",
			"Wystawa fotografii przyrodniczej",
			"Wystawa: archiwum uczelni",
			"Wystawa prac dyplomowych",
		],
		seats: [100, 200, 400],
		startHours: [9, 10],
		agendas: [
			[
				{ title: "Wernisaż", at: 0, minutes: 60, open: true },
				{ title: "Oprowadzanie kuratorskie", at: 90, minutes: 60, seats: 25 },
				{
					title: "Oprowadzanie kuratorskie (powtórka)",
					at: 240,
					minutes: 60,
					seats: 25,
				},
				{ title: "Spotkanie z autorami", at: 330, minutes: 60 },
			],
			[
				{ title: "Otwarcie wystawy", at: 0, minutes: 45, open: true },
				{ title: "Zwiedzanie z przewodnikiem", at: 60, minutes: 45, seats: 20 },
				{
					title: "Warsztaty dla rodzin",
					at: 120,
					minutes: 90,
					seats: 15,
					place: "elsewhere",
					description: "Zajęcia plastyczne dla dzieci z opiekunami.",
				},
			],
		],
	},
	{
		typeId: "competition",
		titles: [
			"Konkurs programistyczny",
			"Konkurs krasomówczy",
			"Turniej debat oksfordzkich",
			"Konkurs wiedzy o Śląsku",
		],
		seats: [30, 40, 60],
		startHours: [8, 9],
		agendas: [
			[
				{ title: "Rejestracja uczestników", at: 0, minutes: 30, open: true },
				{ title: "Etap pierwszy", at: 30, minutes: 120 },
				{ title: "Przerwa", at: 150, minutes: 30, open: true, place: "none" },
				{ title: "Finał", at: 180, minutes: 90, seats: "half" },
				{ title: "Ogłoszenie wyników", at: 270, minutes: 30, open: true },
			],
			[
				{ title: "Rejestracja uczestników", at: 0, minutes: 30, open: true },
				{ title: "Kategoria juniorów", at: 30, minutes: 150, seats: "half" },
				{ title: "Kategoria seniorów", at: 30, minutes: 150, seats: "half" },
				{ title: "Wręczenie nagród", at: 195, minutes: 45, open: true },
			],
		],
	},
	{
		typeId: "celebration",
		titles: [
			"Święto wydziału",
			"Koncert chóru akademickiego",
			"Gala nagród rektora",
		],
		seats: [200, 300, 500],
		startHours: [16, 17],
		agendas: [
			[
				{ title: "Przemówienia", at: 0, minutes: 30, open: true },
				{ title: "Część artystyczna", at: 30, minutes: 60 },
				{ title: "Wręczenie wyróżnień", at: 90, minutes: 45 },
				{
					title: "Poczęstunek",
					at: 135,
					minutes: 60,
					seats: "half",
					place: "none",
				},
			],
		],
	},
	{
		typeId: "special-event",
		titles: [
			"Dzień otwarty uczelni",
			"Noc naukowców",
			"Piknik naukowy",
			"Dzień sportu akademickiego",
		],
		seats: [300, 500, 800],
		startHours: [9, 10],
		agendas: [
			[
				{ title: "Otwarcie", at: 0, minutes: 30, open: true },
				{ title: "Pokazy i stoiska", at: 30, minutes: 300, open: true },
				{
					title: "Warsztaty I",
					at: 60,
					minutes: 90,
					seats: 30,
					place: "elsewhere",
				},
				{ title: "Warsztaty II", at: 180, minutes: 90, seats: 30 },
				{ title: "Koncert na zakończenie", at: 360, minutes: 90, open: true },
			],
		],
	},
];

const LOCATIONS = ["katowice", "sosnowiec", "chorzow", "cieszyn", "online"];
const FACULTIES = ["wh", "wnp", "wns", "wnst", "wpia", "wsne", "wtl", "sf"];

const DESCRIPTIONS = [
	"Wydarzenie otwarte dla studentów wszystkich kierunków.",
	"Liczba miejsc jest ograniczona — zapisz się wcześniej.\nPo zapisie dostaniesz e-mail z biletem.",
	"Prowadzący: pracownicy wydziału oraz goście z przemysłu.",
	"Udział jest bezpłatny. Zaświadczenia o uczestnictwie wydaje sekretariat wydziału.",
];

/** How full an event gets: most are partly full, some fill up and gather a waitlist. */
const POPULARITY = [0, 0.1, 0.25, 0.4, 0.6, 0.8, 0.95, 1, 1.3, 1.6];

const GENERATED_EVENT_COUNT = 70;

function itemSeats(seats: Part["seats"], eventSeats: number): number | null {
	if (seats === undefined) {
		return null;
	}
	if (typeof seats === "number") {
		return Math.min(seats, eventSeats);
	}
	return Math.max(5, Math.round(eventSeats / (seats === "half" ? 2 : 3)));
}

function generate(): {
	events: EventSeed[];
	agenda: AgendaItemSeed[];
	registrations: RegistrationSeed[];
	agendaRegistrations: AgendaRegistrationSeed[];
} {
	const events: EventSeed[] = [];
	const agenda: AgendaItemSeed[] = [];
	const registrations: RegistrationSeed[] = [];
	const agendaRegistrations: AgendaRegistrationSeed[] = [];

	for (let index = 1; index <= GENERATED_EVENT_COUNT; index++) {
		const template = pick(TEMPLATES);
		const id = `gen-${String(index).padStart(3, "0")}`;
		const locationId = pick(LOCATIONS);
		// Mostly upcoming (the next four months), a quarter in the past.
		const daysFromNow = random() < 0.25 ? -between(1, 60) : between(1, 120);
		const maxSeats = pick(template.seats);
		const parts = pick(template.agendas);
		events.push({
			id,
			title: pick(template.titles),
			description: random() < 0.6 ? pick(DESCRIPTIONS) : undefined,
			daysFromNow,
			startHourUtc: pick(template.startHours),
			// The event lasts as long as its agenda.
			durationHours:
				Math.max(...parts.map((part) => part.at + part.minutes)) / 60,
			maxSeats,
			typeId: template.typeId,
			locationId,
			facultyId: pick(FACULTIES),
		});

		const elsewhere = pick(LOCATIONS.filter((place) => place !== locationId));
		const items = parts.map(
			(part, position): AgendaItemSeed => ({
				id: `agenda-${id}-${position + 1}`,
				eventId: id,
				title: part.title,
				description: part.description ?? null,
				startHour: part.at / 60,
				durationMinutes: part.minutes,
				locationId:
					part.place === "none"
						? null
						: part.place === "elsewhere"
							? elsewhere
							: locationId,
				maxSeats: itemSeats(part.seats, maxSeats),
				requiresRegistration: !part.open,
			}),
		);
		agenda.push(...items);

		const wanted = Math.min(
			generatedPool.length,
			Math.round(maxSeats * pick(POPULARITY)),
		);
		if (wanted === 0) {
			continue;
		}
		const emails = sample(generatedPool, wanted);
		registrations.push({ eventId: id, emails });

		// Upcoming events: some of the registered people (not the waitlist) also sign up
		// for limited items. Each person takes one item, so parallel items never overlap.
		if (daysFromNow > 0) {
			const registered = emails.slice(0, maxSeats);
			let next = 0;
			for (const item of items) {
				if (!item.requiresRegistration || item.maxSeats === null) {
					continue;
				}
				const take = Math.min(
					Math.round(item.maxSeats * pick(POPULARITY)),
					item.maxSeats,
					registered.length - next,
				);
				if (take > 0) {
					agendaRegistrations.push({
						itemId: item.id,
						emails: registered.slice(next, next + take),
					});
					next += take;
				}
			}
		}
	}
	return { events, agenda, registrations, agendaRegistrations };
}

const generated = generate();

export const generatedEventSeeds: EventSeed[] = generated.events;
export const generatedAgendaItemSeeds: AgendaItemSeed[] = generated.agenda;
export const generatedRegistrationSeeds: RegistrationSeed[] =
	generated.registrations;
export const generatedAgendaRegistrationSeeds: AgendaRegistrationSeed[] =
	generated.agendaRegistrations;
