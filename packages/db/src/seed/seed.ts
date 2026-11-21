import { seedAgenda, seedEvents } from "./events";
import { seedEventLookups } from "./lookups";
import {
	seedAccounts,
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
	await seedEventLookups();
	await seedEvents();
	await seedAgenda();
	const accounts = await seedAccounts(options.password);
	await seedRegistrations(accounts);
	await seedGroups(accounts);
	await seedShowcase(accounts);
}
