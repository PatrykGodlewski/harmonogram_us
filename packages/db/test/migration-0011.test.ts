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
scratchUrl.pathname = "/harmonogram_us_migration_test";
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
	await admin.unsafe('DROP DATABASE IF EXISTS "harmonogram_us_migration_test"');
	await admin.unsafe('CREATE DATABASE "harmonogram_us_migration_test"');
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
	await admin.unsafe('DROP DATABASE IF EXISTS "harmonogram_us_migration_test"');
	await admin.end();
});

describe("migration 0011 on existing data", () => {
	it("keeps existing registrations registered and seat counts unchanged", async () => {
		const before = migrationsUpTo("0010_app_rate_limits");
		await migrate(drizzle(sql), { migrationsFolder: before });
		rmSync(before, { recursive: true, force: true });

		await sql`INSERT INTO event_types (id, slug, label) VALUES ('t', 't', 'T')`;
		const [event] = await sql<{ id: string }[]>`
			INSERT INTO events (title, date, max_seats, type_id)
			VALUES ('Old event', now() + interval '10 days', 3, 't') RETURNING id`;
		for (const n of [1, 2]) {
			await sql`INSERT INTO "user" (id, name, email, email_verified) VALUES (${`u${n}`}, 'U', ${`u${n}@x.test`}, true)`;
			await sql`INSERT INTO event_registrations (id, event_id, user_id) VALUES (${`r${n}`}, ${event?.id ?? ""}, ${`u${n}`})`;
		}
		const [countBefore] = await sql<{ seats_remaining: number }[]>`
			SELECT seats_remaining FROM event_seat_counts WHERE event_id = ${event?.id ?? ""}`;
		expect(countBefore?.seats_remaining).toBe(1);

		await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS });

		const rows = await sql<{ state: string; locale: string }[]>`
			SELECT state, locale FROM event_registrations ORDER BY id`;
		expect(rows).toEqual([
			{ state: "registered", locale: "pl" },
			{ state: "registered", locale: "pl" },
		]);
		const [countAfter] = await sql<{ seats_remaining: number }[]>`
			SELECT seats_remaining FROM event_seat_counts WHERE event_id = ${event?.id ?? ""}`;
		expect(countAfter?.seats_remaining).toBe(1);

		// The new trigger counts only registered rows.
		await sql`INSERT INTO "user" (id, name, email, email_verified) VALUES ('u3', 'U', 'u3@x.test', true)`;
		await sql`INSERT INTO event_registrations (id, event_id, user_id, state) VALUES ('r3', ${event?.id ?? ""}, 'u3', 'waitlisted')`;
		const [countWaitlisted] = await sql<{ seats_remaining: number }[]>`
			SELECT seats_remaining FROM event_seat_counts WHERE event_id = ${event?.id ?? ""}`;
		expect(countWaitlisted?.seats_remaining).toBe(1);
	});
});
