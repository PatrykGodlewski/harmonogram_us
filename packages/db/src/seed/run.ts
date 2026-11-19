import { env } from "@repo/env";
import { closeDb } from "../client";
import { seedDatabase } from "./seed";

if (!env.SEED_ACCOUNT_PASSWORD) {
	console.error(
		"Set SEED_ACCOUNT_PASSWORD in .env (at least 12 characters): the password of the seeded test accounts.",
	);
	process.exit(1);
}

try {
	await seedDatabase({
		password: env.SEED_ACCOUNT_PASSWORD,
		nodeEnv: env.NODE_ENV,
	});
	console.log(
		"Database seeded. Test accounts (password: SEED_ACCOUNT_PASSWORD): admin@harmonogram.local (admin), nauczyciel@harmonogram.local, student1..5@harmonogram.local; gosc@harmonogram.local signs in with an e-mail link.",
	);
	await closeDb();
} catch (error) {
	console.error("Database seed failed:", error);
	process.exit(1);
}
