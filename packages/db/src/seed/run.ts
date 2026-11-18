import { seedDatabase } from "./index";

try {
	await seedDatabase();
	console.log("Database seeded successfully.");
	process.exit(0);
} catch (error) {
	console.error("Database seed failed:", error);
	process.exit(1);
}
