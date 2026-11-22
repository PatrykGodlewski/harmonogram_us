import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL } from "../vitest.config";

const MIGRATIONS = fileURLToPath(new URL("../src/migrations", import.meta.url));
const scratchUrl = new URL(TEST_DATABASE_URL);
scratchUrl.pathname = "/harmonogram_us_migration_0015";
const adminUrl = new URL(TEST_DATABASE_URL);
adminUrl.pathname = "/postgres";

/** A copy of the migrations folder whose journal stops after `lastTag`. */
function migrationsUpTo(lastTag: string): string {
	const dir = mkdtempSync(join(tmpdir(), "migrations-"));
	cpSync(MIGRATIONS, dir, { recursive: true });
	const journalPath = join(dir, "meta/_journal.json");
	const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
		entries: { tag: string }[];
	};
	const last = journal.entries.findIndex((entry) => entry.tag === lastTag);
	journal.entries = journal.entries.slice(0, last + 1);
	writeFileSync(journalPath, JSON.stringify(journal));
	return dir;
}

async function recreateScratchDb() {
	const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
	await admin.unsafe('DROP DATABASE IF EXISTS "harmonogram_us_migration_0015" WITH (FORCE)');
	await admin.unsafe('CREATE DATABASE "harmonogram_us_migration_0015"');
	await admin.end();
}

let sql: postgres.Sql;

beforeAll(async () => {
	await recreateScratchDb();
	sql = postgres(scratchUrl.toString(), { max: 1, onnotice: () => {} });
});

afterAll(async () => {
	await sql.end();
	const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
	await admin.unsafe('DROP DATABASE IF EXISTS "harmonogram_us_migration_0015" WITH (FORCE)');
	await admin.end();
}, 30_000);

describe("migration 0015 on existing data", () => {
	it("keeps existing events published, new ones start as drafts", async () => {
		const before = migrationsUpTo("0014_event_organizers");
		await migrate(drizzle(sql), { migrationsFolder: before });
		rmSync(before, { recursive: true, force: true });

		await sql`INSERT INTO event_types (id, slug, label) VALUES ('t', 't', 'T')`;
		await sql`
			INSERT INTO events (title, date, max_seats, type_id)
			VALUES ('Old event', now() + interval '10 days', 3, 't')`;

		await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS });

		await sql`
			INSERT INTO events (title, date, max_seats, type_id)
			VALUES ('New event', now() + interval '10 days', 3, 't')`;
		const rows = await sql<
			{ title: string; status: string; attendance_mode: string }[]
		>`SELECT title, status, attendance_mode FROM events ORDER BY title`;
		expect(rows).toEqual([
			{ title: "New event", status: "draft", attendance_mode: "onsite" },
			{ title: "Old event", status: "published", attendance_mode: "onsite" },
		]);
	});
});
