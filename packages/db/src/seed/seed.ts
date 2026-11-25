import {
	accountSeeds,
	agendaItemSeeds,
	agendaRegistrationSeeds,
	eventSeeds,
	groupSeeds,
	registrationSeeds,
} from "./data";
import {
	removeStaleAgenda,
	removeStaleEvents,
	seedAgenda,
	seedEvents,
	seedSessions,
} from "./events";
import { festivalItemSeeds, festivalSessionSeeds } from "./festival";
import { seedEventLookups } from "./lookups";
import { participantAccountSeeds } from "./participants";
import {
	seedAccounts,
	seedAgendaRegistrations,
	seedGroups,
	seedRegistrations,
	seedShowcase,
} from "./people";

/** Seeds the showcase events and local test accounts. Idempotent; refuses to touch production. */
export async function seedDatabase(options: {
	password: string;
	nodeEnv: string;
}): Promise<void> {
	if (options.nodeEnv === "production") {
		throw new Error("Refusing to seed a production database");
	}
	const now = new Date();
	await seedEventLookups();
	await removeStaleEvents(eventSeeds);
	await seedEvents(eventSeeds, now);
	const items = [...agendaItemSeeds, ...festivalItemSeeds];
	await removeStaleAgenda(eventSeeds, festivalSessionSeeds, items);
	await seedSessions(festivalSessionSeeds, eventSeeds, now);
	await seedAgenda(items, eventSeeds, now);
	const accounts = await seedAccounts(
		[...accountSeeds, ...participantAccountSeeds],
		options.password,
	);
	await seedRegistrations(registrationSeeds, accounts);
	await seedAgendaRegistrations(agendaRegistrationSeeds, accounts);
	await seedGroups(groupSeeds, accounts);
	await seedShowcase(eventSeeds, accounts);
}
