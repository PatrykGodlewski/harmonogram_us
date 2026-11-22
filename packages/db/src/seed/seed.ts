import {
	accountSeeds,
	agendaItemSeeds,
	agendaRegistrationSeeds,
	eventSeeds,
	groupSeeds,
	registrationSeeds,
} from "./data";
import { seedAgenda, seedEvents } from "./events";
import {
	generatedAccountSeeds,
	generatedAgendaItemSeeds,
	generatedAgendaRegistrationSeeds,
	generatedEventSeeds,
	generatedRegistrationSeeds,
} from "./generated";
import { seedEventLookups } from "./lookups";
import {
	seedAccounts,
	seedAgendaRegistrations,
	seedGroups,
	seedRegistrations,
	seedShowcase,
} from "./people";

/** Seeds sample data and local test accounts. Idempotent; refuses to touch production. */
export async function seedDatabase(options: {
	password: string;
	nodeEnv: string;
}): Promise<void> {
	if (options.nodeEnv === "production") {
		throw new Error("Refusing to seed a production database");
	}
	const now = new Date();
	const allEvents = [...eventSeeds, ...generatedEventSeeds];
	await seedEventLookups();
	await seedEvents(allEvents, now);
	await seedAgenda(
		[...agendaItemSeeds, ...generatedAgendaItemSeeds],
		allEvents,
		now,
	);
	const accounts = await seedAccounts(
		[...accountSeeds, ...generatedAccountSeeds],
		options.password,
	);
	await seedRegistrations(
		[...registrationSeeds, ...generatedRegistrationSeeds],
		accounts,
	);
	await seedAgendaRegistrations(
		[...agendaRegistrationSeeds, ...generatedAgendaRegistrationSeeds],
		accounts,
	);
	await seedGroups(groupSeeds, accounts);
	await seedShowcase(eventSeeds, accounts);
}
