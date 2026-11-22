import { db } from "@repo/db/client";
import { sql } from "drizzle-orm";

/**
 * GET handler for /api/health in each app: Railway switches traffic to a new deployment
 * only once this answers 200. It checks the database, so a deployment that cannot reach
 * Postgres (wrong DATABASE_URL, private network down) never goes live.
 */
export async function serveHealth(): Promise<Response> {
	try {
		await db.execute(sql`select 1`);
		return new Response("ok", { headers: { "Cache-Control": "no-store" } });
	} catch {
		return new Response("database unavailable", {
			status: 503,
			headers: { "Cache-Control": "no-store" },
		});
	}
}
