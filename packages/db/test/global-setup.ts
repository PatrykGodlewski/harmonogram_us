import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { TEST_DATABASE_URL } from "../vitest.config";

export default async function setup() {
	const testDbName = new URL(TEST_DATABASE_URL).pathname.slice(1);
	const adminUrl = new URL(TEST_DATABASE_URL);
	adminUrl.pathname = "/postgres";

	const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
	const existing =
		await admin`SELECT 1 FROM pg_database WHERE datname = ${testDbName}`;
	if (existing.length === 0) {
		await admin.unsafe(`CREATE DATABASE "${testDbName}"`);
	}
	await admin.end();

	const client = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
	await migrate(drizzle(client), { migrationsFolder: "src/migrations" });
	await client.end();
}
