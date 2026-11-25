import type { AgendaLanguage } from "../agenda-languages";
import type { AgendaSpeaker } from "../schema/agenda";
import type { AgendaItemSeed, AgendaSessionSeed } from "./data";

/**
 * The festival's programme, laid out like Śląski Festiwal Nauki: three days, four stages
 * a day (programme sessions), short talks every 25 minutes, longer lectures, small-group
 * workshops and open shows running side by side. Every item carries the details a
 * festival programme shows (category, field, languages, unit, audience, speakers).
 */

export const FESTIVAL_EVENT_ID = "evt-science-festival";
/** "W cieniu sławy", day 1, 11:05–11:25: all 30 places taken. */
export const FULL_FESTIVAL_ITEM_ID = `agenda-${FESTIVAL_EVENT_ID}-d1-talk6`;
/** Day 1's first workshop, for the teacher's group. */
export const GROUP_FESTIVAL_ITEM_ID = `agenda-${FESTIVAL_EVENT_ID}-d1-workshop1`;
/** Day 2's first workshop: one place left. */
export const ALMOST_FULL_FESTIVAL_ITEM_ID = `agenda-${FESTIVAL_EVENT_ID}-d2-workshop1`;

const VENUE = "rynek-idei";
const LAB = "chorzow-wnst";
const DAY_MINUTES = 24 * 60;

const SPEAKERS: AgendaSpeaker[] = [
	{
		name: "dr hab. Anna Kijanowska",
		affiliation: "Uniwersytet Śląski w Katowicach",
		unit: "Wydział Sztuki i Nauk o Edukacji",
		bio: "Pianistka, badaczka i pedagożka, związana z Uniwersytetem Śląskim. Jej zainteresowania naukowe koncentrują się wokół dziedzictwa muzycznego, ze szczególnym uwzględnieniem twórczości kompozytorek oraz problematyki równości płci w kulturze. Łączy działalność artystyczną z badawczą, podejmując projekty poświęcone zapomnianym postaciom muzyki, zwłaszcza polskiego kręgu emigracyjnego.\nW swojej pracy zajmuje się także rolą muzyki w kontekście społecznym i ekologicznym. Występuje na konferencjach międzynarodowych i prowadzi projekty popularyzatorskie z wykorzystaniem nowoczesnych technologii.",
	},
	{
		name: "prof. dr hab. Marek Zieliński",
		affiliation: "Uniwersytet Śląski w Katowicach",
		unit: "Instytut Fizyki",
		bio: "Fizyk ciała stałego, od dwudziestu lat bada materiały dwuwymiarowe. Kieruje pracownią spektroskopii i chętnie pokazuje, że fizyka dzieje się w kuchni.",
	},
	{
		name: "dr Katarzyna Lis",
		affiliation: "Śląski Uniwersytet Medyczny",
		unit: "Wydział Nauk Medycznych w Katowicach",
		bio: "Immunolożka i lekarka. Zajmuje się odpowiedzią odpornościową na infekcje wirusowe i komunikacją naukową w medycynie.",
	},
	{
		name: "dr inż. Paweł Nowicki",
		affiliation: "Politechnika Śląska",
		unit: "Wydział Automatyki, Elektroniki i Informatyki",
		bio: "Robotyk, konstruktor dronów badawczych i opiekun koła naukowego, które od lat zdobywa nagrody w zawodach łazików marsjańskich. Uczy, jak zaprogramować maszynę, żeby sama znalazła drogę.",
	},
	{
		name: "dr Olena Kowalenko",
		affiliation: "Uniwersytet Śląski w Katowicach",
		unit: "Instytut Językoznawstwa",
		bio: "Językoznawczyni badająca dwujęzyczność dzieci w rodzinach migracyjnych. Prowadzi zajęcia po polsku, ukraińsku i angielsku.",
	},
	{
		name: "prof. Jan Mazur",
		affiliation: "Uniwersytet Śląski w Katowicach",
		unit: "Instytut Historii",
		bio: "Historyk dziejów Górnego Śląska XIX i XX wieku, autor książek o przemyśle i codzienności robotniczych osiedli.",
	},
	{
		name: "dr Ewa Grabowska",
		affiliation: "Uniwersytet Śląski w Katowicach",
		unit: "Instytut Biologii, Biotechnologii i Ochrony Środowiska",
		bio: "Ekolożka, bada owady zapylające w miastach. Współtworzy łąki kwietne na terenach pogórniczych i uczy, jak liczyć trzmiele.",
	},
	{
		name: "dr hab. Tomasz Wrona",
		affiliation: "Politechnika Śląska",
		unit: "Wydział Chemiczny",
		bio: "Chemik materiałowy. Projektuje polimery, które same się naprawiają, a w wolnym czasie pokazuje dzieciom, co potrafi ciekły azot.",
	},
	{
		name: "Sarah Mitchell, PhD",
		affiliation: "University of Edinburgh",
		unit: "School of Physics and Astronomy",
		bio: "Astrophysicist working on exoplanet atmospheres; visiting researcher in Katowice this year.",
	},
	{
		name: "dr Agata Szymańska",
		affiliation: "Uniwersytet Śląski w Katowicach",
		unit: "Instytut Psychologii",
		bio: "Psycholożka poznawcza. Bada, jak uczymy się na błędach i dlaczego pamięć bywa zawodna.",
	},
	{
		name: "mgr Michał Dudek",
		affiliation: "Planetarium Śląskie",
		bio: "Popularyzator astronomii, prowadzi pokazy nieba i obserwacje Słońca dla szkół.",
	},
	{
		name: "dr Joanna Pietrzak",
		affiliation: "Uniwersytet Śląski w Katowicach",
		unit: "Instytut Matematyki",
		bio: "Matematyczka, autorka gier logicznych i zagadek. Przekonuje, że każdy lubi matematykę, tylko jeszcze o tym nie wie.",
	},
];

type Fields = {
	topic: string;
	facultyId: string;
	languages?: AgendaLanguage[];
	audience?: string;
};

const ART: Fields = { topic: "Sztuka", facultyId: "wsne" };
const PHYSICS: Fields = { topic: "Fizyka", facultyId: "wnst" };
const MEDICINE: Fields = { topic: "Medycyna", facultyId: "wnp" };
const ROBOTICS: Fields = { topic: "Informatyka", facultyId: "wnst" };
const LANGUAGE: Fields = { topic: "Językoznawstwo", facultyId: "wh" };
const HISTORY: Fields = { topic: "Historia", facultyId: "wh" };
const ECOLOGY: Fields = { topic: "Ekologia", facultyId: "wnp" };
const CHEMISTRY: Fields = { topic: "Chemia", facultyId: "wnst" };
const ASTRONOMY: Fields = { topic: "Astronomia", facultyId: "wnst" };
const PSYCHOLOGY: Fields = { topic: "Psychologia", facultyId: "wns" };
const MATHS: Fields = { topic: "Matematyka", facultyId: "wnst" };

/** Area of knowledge → who usually talks about it (index into SPEAKERS). */
const SPEAKER_FOR = new Map<string, number>([
	["Sztuka", 0],
	["Fizyka", 1],
	["Medycyna", 2],
	["Informatyka", 3],
	["Językoznawstwo", 4],
	["Historia", 5],
	["Ekologia", 6],
	["Chemia", 7],
	["Astronomia", 8],
	["Psychologia", 9],
	["Matematyka", 11],
]);

type Entry = [title: string, description: string, fields: Fields];

/** 20-minute talks on the main stage, ten a day. */
const TALKS: Entry[][] = [
	[
		[
			"Dlaczego niebo jest niebieskie?",
			"Rozpraszanie światła wyjaśnione na pięciu prostych doświadczeniach.",
			PHYSICS,
		],
		[
			"Jak szczepionka uczy organizm?",
			"Od pierwszej szczepionki Jennera do mRNA: krótka historia pamięci immunologicznej.",
			MEDICINE,
		],
		[
			"Śląskie familoki — domy, które pamiętają",
			"Jak wyglądało życie na osiedlu robotniczym sto lat temu.",
			HISTORY,
		],
		[
			"Trzmiel w mieście",
			"Co zapylacze robią między blokami i jak możemy im pomóc.",
			ECOLOGY,
		],
		[
			"Liczby pierwsze w telefonie",
			"Dlaczego bezpieczeństwo naszych wiadomości zależy od matematyki sprzed 2000 lat.",
			MATHS,
		],
		[
			"W cieniu sławy",
			"Zapraszam do fascynującej podróży w świat dwóch niezwykłych artystek – Nathalie Janothy i Ireny Régine Wieniawskiej (Poldowski), które mimo wielkich osiągnięć pozostają niemal nieznane. Spotkanie łączy opowieść o ich barwnym życiu – od europejskich salonów muzycznych po górskie wyprawy – z prezentacją ich twórczości pianistycznej i kompozytorskiej.\nUczestnicy poznają kulisy życia koncertowego przełomu XIX i XX wieku, relacje z najwybitniejszymi muzykami epoki oraz rolę kobiet w świecie sztuki. Wykład wzbogacony będzie o przykłady muzyczne i materiały multimedialne.",
			{ ...ART, audience: "dla wszystkich" },
		],
		[
			"Dwa języki w jednej głowie",
			"Co dzieje się w mózgu dziecka, które od urodzenia mówi dwoma językami.",
			{ ...LANGUAGE, languages: ["pl", "uk"] },
		],
		[
			"Pamięć jak sito",
			"Dlaczego zapominamy i jak to wykorzystać w nauce do egzaminu.",
			PSYCHOLOGY,
		],
		[
			"Robot, który się uczy",
			"Uczenie przez wzmacnianie pokazane na małym robocie jeżdżącym.",
			ROBOTICS,
		],
		[
			"Plastik, który się naprawia",
			"Polimery samonaprawiające się: od laboratorium do telefonu.",
			CHEMISTRY,
		],
	],
	[
		[
			"Grafen — cud na jednej warstwie",
			"Materiał grubości jednego atomu i jego niezwykłe właściwości.",
			PHYSICS,
		],
		[
			"Bakterie, które nam pomagają",
			"Mikrobiom jelitowy i jego wpływ na zdrowie.",
			MEDICINE,
		],
		[
			"Kopalnia w liczbach",
			"Jak węgiel zmienił Śląsk i co zostało po kopalniach.",
			HISTORY,
		],
		[
			"Łąka zamiast trawnika",
			"Jak jedna decyzja ogrodnika zwiększa liczbę gatunków dziesięciokrotnie.",
			ECOLOGY,
		],
		[
			"Exoplanets for beginners",
			"How we find planets around other stars, and what their air is made of.",
			{ ...ASTRONOMY, languages: ["en"] },
		],
		[
			"Kolor w malarstwie Matejki",
			"Co analiza pigmentów mówi o pracowni mistrza.",
			ART,
		],
		["Słowa, które zniknęły", "Gwara śląska wczoraj i dziś.", LANGUAGE],
		[
			"Iluzje wzrokowe",
			"Dlaczego mózg daje się oszukać — i co to mówi o widzeniu.",
			PSYCHOLOGY,
		],
		[
			"Algorytm w kuchni",
			"Przepis jako program: pętle, warunki i błędy w ciastach.",
			{ ...ROBOTICS, audience: "13–18 lat" },
		],
		[
			"Chemia zapachów",
			"Z czego zrobione są perfumy i dlaczego pachną inaczej na każdym.",
			CHEMISTRY,
		],
	],
	[
		[
			"Czarne dziury bez tajemnic",
			"Co wiemy po pierwszym zdjęciu cienia czarnej dziury.",
			ASTRONOMY,
		],
		[
			"Serce na chipie",
			"Jak hodowane w laboratorium tkanki zastępują testy na zwierzętach.",
			MEDICINE,
		],
		[
			"Powstania śląskie oczami świadków",
			"Listy i dzienniki z lat 1919–1921.",
			HISTORY,
		],
		["Woda w mieście", "Deszczówka, zielone dachy i walka z upałem.", ECOLOGY],
		[
			"Nieskończoność w hotelu Hilberta",
			"Paradoksy nieskończoności opowiedziane na gościach hotelowych.",
			MATHS,
		],
		[
			"Muzyka zapisana w kamieniu",
			"Rzeźba i dźwięk w sztuce współczesnej.",
			ART,
		],
		[
			"Język migowy — język jak każdy inny",
			"Gramatyka, dialekty i historia polskiego języka migowego.",
			LANGUAGE,
		],
		["Decyzje pod presją", "Jak stres zmienia nasze wybory.", PSYCHOLOGY],
		[
			"Dron ratowniczy",
			"Jak autonomiczne drony szukają ludzi w górach.",
			ROBOTICS,
		],
		[
			"Kryształy z kuchni",
			"Krystalizacja soli i cukru krok po kroku.",
			{ ...CHEMISTRY, audience: "rodziny z dziećmi" },
		],
	],
];

/** 45-minute lectures on the second stage, five a day. */
const LECTURES: Entry[][] = [
	[
		[
			"Fale grawitacyjne: jak usłyszeć zderzenie gwiazd",
			"Wykład o detektorach LIGO i Virgo oraz o tym, co nam powiedziały.",
			PHYSICS,
		],
		[
			"Antybiotyki na rozdrożu",
			"Oporność bakterii i poszukiwanie nowych leków.",
			MEDICINE,
		],
		[
			"Sztuczna inteligencja a prawo autorskie",
			"Kto jest autorem obrazu stworzonego przez model?",
			ROBOTICS,
		],
		[
			"Przemysłowe dziedzictwo Śląska",
			"Od szybów do muzeów: druga młodość zabytków techniki.",
			HISTORY,
		],
		[
			"Klimat w liczbach",
			"Co mówią pomiary z ostatnich 150 lat.",
			{ ...ECOLOGY, languages: ["pl", "en"] },
		],
	],
	[
		[
			"Kwantowe komputery dla każdego",
			"Kubit, splątanie i to, czego jeszcze nie umiemy.",
			PHYSICS,
		],
		[
			"Mózg nastolatka",
			"Dlaczego dorastanie to przebudowa, a nie usterka.",
			{ ...PSYCHOLOGY, audience: "13–18 lat" },
		],
		[
			"Life on Mars?",
			"What rovers have found, and where to look next.",
			{ ...ASTRONOMY, languages: ["en"] },
		],
		[
			"Kompozytorki zapomniane",
			"Muzyka kobiet XIX wieku na nowo odkryta.",
			ART,
		],
		["Statystyka, która kłamie", "Jak czytać wykresy w wiadomościach.", MATHS],
	],
	[
		[
			"Nowe materiały dla energetyki",
			"Ogniwa perowskitowe i przyszłość fotowoltaiki.",
			CHEMISTRY,
		],
		["Medycyna spersonalizowana", "Leki dobrane do genów pacjenta.", MEDICINE],
		[
			"Roboty społeczne",
			"Czy maszyna może być towarzyszem osoby starszej?",
			ROBOTICS,
		],
		[
			"Śląsk wielu języków",
			"Polski, niemiecki, czeski i gwara w jednym regionie.",
			LANGUAGE,
		],
		["Las po kopalni", "Jak przyroda wraca na hałdy.", ECOLOGY],
	],
];

/** 90-minute workshops in the lab, three a day, for small groups. */
const WORKSHOPS: Entry[][] = [
	[
		[
			"Zbuduj własnego robota",
			"Składamy i programujemy robota z gotowych modułów.",
			{ ...ROBOTICS, audience: "7–12 lat" },
		],
		[
			"Chemia w kuchni",
			"Doświadczenia z kapustą, sodą i octem.",
			{ ...CHEMISTRY, audience: "rodziny z dziećmi" },
		],
		[
			"Mikroskop w terenie",
			"Oglądamy życie w kropli wody ze stawu.",
			{ ...ECOLOGY, audience: "13–18 lat" },
		],
	],
	[
		[
			"Programowanie łazika marsjańskiego",
			"Zadania jak w zawodach University Rover Challenge.",
			{ ...ROBOTICS, audience: "13–18 lat" },
		],
		[
			"Kod genetyczny z koralików",
			"Budujemy model DNA i odczytujemy jego informację.",
			{ ...MEDICINE, audience: "7–12 lat" },
		],
		[
			"Zagadki matematyczne",
			"Escape room z łamigłówkami.",
			{ ...MATHS, audience: "dla wszystkich" },
		],
	],
	[
		[
			"Druk 3D od pomysłu do modelu",
			"Projektujemy i drukujemy własny breloczek.",
			{ ...ROBOTICS, audience: "13–18 lat" },
		],
		[
			"Laboratorium kryminalistyczne",
			"Odciski palców, atrament i chromatografia.",
			{ ...CHEMISTRY, audience: "13–18 lat" },
		],
		[
			"Mapa nieba",
			"Budujemy obrotową mapę gwiazd na grudniowe noce.",
			{ ...ASTRONOMY, audience: "7–12 lat" },
		],
	],
];

/** 30-minute open shows on the square, four a day, no registration. */
const SHOWS: Entry[] = [
	[
		"Pokaz: ciekły azot",
		"Lody w minutę, latające balony i inne zimne sztuczki.",
		{ ...CHEMISTRY, audience: "dla wszystkich" },
	],
	[
		"Pokaz: wyładowania elektryczne",
		"Cewka Tesli gra muzykę.",
		{ ...PHYSICS, audience: "dla wszystkich" },
	],
	[
		"Pokaz nieba w mobilnym planetarium",
		"Zimowe gwiazdozbiory pod kopułą.",
		{ ...ASTRONOMY, audience: "rodziny z dziećmi" },
	],
	[
		"Pokaz: roboty w akcji",
		"Wyścig robotów-sumo i drony w formacji.",
		{ ...ROBOTICS, audience: "dla wszystkich" },
	],
];

const DEFAULTS = { languages: ["pl"] as AgendaLanguage[], audience: "dorośli" };

function speakersFor(fields: Fields, extra = 0): AgendaSpeaker[] {
	const first = SPEAKER_FOR.get(fields.topic) ?? 0;
	const speakers = [SPEAKERS[first]];
	// Every third item has a guest from the planetarium or another field as well.
	if (extra % 3 === 2) speakers.push(SPEAKERS[(first + 10) % SPEAKERS.length]);
	return speakers.filter((speaker): speaker is AgendaSpeaker => !!speaker);
}

type Stage = {
	slug: string;
	title: string;
	description: string;
	color: AgendaSessionSeed["color"];
	locationId: string;
	/** Minutes after the day's start (09:00). */
	from: number;
	to: number;
};

const STAGES: Stage[] = [
	{
		slug: "body",
		title: "Scena Inteligencja Ciała",
		description: "Sala Wielofunkcyjna: krótkie wystąpienia co 25 minut.",
		color: "violet",
		locationId: VENUE,
		from: 0,
		to: 270,
	},
	{
		slug: "science",
		title: "Scena Nauk Ścisłych",
		description: "Duża sala: wykłady i panel dyskusyjny.",
		color: "blue",
		locationId: VENUE,
		from: 0,
		to: 285,
	},
	{
		slug: "lab",
		title: "Strefa Warsztatów",
		description:
			"Pracownie w Chorzowie: zajęcia w małych grupach, obowiązują zapisy.",
		color: "green",
		locationId: LAB,
		from: 30,
		to: 360,
	},
	{
		slug: "square",
		title: "Pokazy na Rynku Idei",
		description: "Plac przed budynkiem: pokazy bez zapisów.",
		color: "amber",
		locationId: VENUE,
		from: 60,
		to: 450,
	},
];

function session(day: number, stage: Stage): AgendaSessionSeed {
	return {
		id: `session-${FESTIVAL_EVENT_ID}-d${day + 1}-${stage.slug}`,
		eventId: FESTIVAL_EVENT_ID,
		title: stage.title,
		description: stage.description,
		color: stage.color,
		locationId: stage.locationId,
		startMinute: day * DAY_MINUTES + stage.from,
		durationMinutes: stage.to - stage.from,
	};
}

function item(
	day: number,
	stage: Stage,
	slug: string,
	[title, description, fields]: Entry,
	at: number,
	minutes: number,
	options: {
		typeId: string;
		maxSeats: number | null;
		requiresRegistration?: boolean;
		index: number;
	},
): AgendaItemSeed {
	return {
		id: `agenda-${FESTIVAL_EVENT_ID}-d${day + 1}-${slug}`,
		eventId: FESTIVAL_EVENT_ID,
		sessionId: session(day, stage).id,
		title,
		description,
		startMinute: day * DAY_MINUTES + at,
		durationMinutes: minutes,
		locationId: stage.locationId,
		maxSeats: options.maxSeats,
		requiresRegistration: options.requiresRegistration ?? true,
		typeId: options.typeId,
		facultyId: fields.facultyId,
		topic: fields.topic,
		audience: fields.audience ?? DEFAULTS.audience,
		languages: fields.languages ?? DEFAULTS.languages,
		speakers:
			options.typeId === "show" ? [] : speakersFor(fields, options.index),
	};
}

const [BODY, SCIENCE, LAB_STAGE, SQUARE] = STAGES as [
	Stage,
	Stage,
	Stage,
	Stage,
];

function day(index: number): {
	sessions: AgendaSessionSeed[];
	items: AgendaItemSeed[];
} {
	const items: AgendaItemSeed[] = [
		...(TALKS[index] ?? []).map((entry, n) =>
			item(index, BODY, `talk${n + 1}`, entry, BODY.from + n * 25, 20, {
				typeId: "lecture",
				maxSeats: 30,
				index: n,
			}),
		),
		...(LECTURES[index] ?? []).map((entry, n) =>
			item(
				index,
				SCIENCE,
				`lecture${n + 1}`,
				entry,
				SCIENCE.from + n * 60,
				45,
				{
					typeId: "lecture",
					maxSeats: null,
					index: n,
				},
			),
		),
		...(WORKSHOPS[index] ?? []).map((entry, n) =>
			item(
				index,
				LAB_STAGE,
				`workshop${n + 1}`,
				entry,
				LAB_STAGE.from + n * 120,
				90,
				{
					typeId: "workshop",
					maxSeats: [12, 16, 20][n] ?? 16,
					index: n,
				},
			),
		),
		...SHOWS.map((entry, n) =>
			item(index, SQUARE, `show${n + 1}`, entry, SQUARE.from + n * 120, 30, {
				typeId: "show",
				maxSeats: null,
				requiresRegistration: false,
				index: n,
			}),
		),
	];
	if (index === 2) {
		// The closing panel, in English, ends the last day on the main stage.
		items.push(
			item(
				index,
				SCIENCE,
				"panel",
				[
					"Panel: science in the city of tomorrow",
					"Researchers from Katowice and Edinburgh discuss what cities will need from science. Questions from the audience welcome.",
					{
						topic: "Nauki o mieście",
						facultyId: "wns",
						languages: ["en", "pl"],
						audience: "dorośli",
					},
				],
				SCIENCE.from + 5 * 60,
				60,
				{ typeId: "panel", maxSeats: 120, index: 2 },
			),
		);
	}
	return {
		sessions: STAGES.map((stage) =>
			index === 2 && stage === SCIENCE
				? { ...session(index, stage), durationMinutes: 360 }
				: session(index, stage),
		),
		items,
	};
}

const DAYS = [day(0), day(1), day(2)];

export const festivalSessionSeeds: AgendaSessionSeed[] = DAYS.flatMap(
	(entry) => entry.sessions,
);
export const festivalItemSeeds: AgendaItemSeed[] = DAYS.flatMap(
	(entry) => entry.items,
);
