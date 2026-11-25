import type { AccountSeed } from "./data";

/** Participants for waitlists and full items; they sign in with e-mail links. */
export const PARTICIPANT_COUNT = 60;

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

/** `uczestnik001@harmonogram.local`, … */
export function participantEmail(index: number): string {
	return `uczestnik${String(index).padStart(3, "0")}@harmonogram.local`;
}

/** Participants `from`..`to` (1-based, inclusive). */
export function participantEmails(from: number, to: number): string[] {
	return Array.from({ length: to - from + 1 }, (_, offset) =>
		participantEmail(from + offset),
	);
}

/** Names cycle through both lists at different strides, so they rarely repeat. */
export const participantAccountSeeds: AccountSeed[] = participantEmails(
	1,
	PARTICIPANT_COUNT,
).map((email, index) => ({
	email,
	name: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[(index * 7) % LAST_NAMES.length]}`,
	role: "user",
	withPassword: false,
}));
