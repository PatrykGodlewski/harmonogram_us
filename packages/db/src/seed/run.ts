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
		"Database seeded. Test accounts (password: SEED_ACCOUNT_PASSWORD): admin@harmonogram.local (admin), organizator@harmonogram.local (organiser of the showcase events: certificates, approval, invite-only), nauczyciel@ and nauczyciel2@harmonogram.local (group owners), student1..5@harmonogram.local (student1 has a certificate); gosc@ and uczestnik001..060@harmonogram.local sign in with an e-mail link. Showcase: the festival (evt-science-festival) has a three-day programme with sessions.",
	);
	await closeDb();
} catch (error) {
	console.error("Database seed failed:", error);
	process.exit(1);
}
