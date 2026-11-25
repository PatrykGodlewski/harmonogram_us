import { db } from "@repo/db/client";
import { sql } from "drizzle-orm";
import type { LoadRun, LoadUsers } from "./config";

type EventCounts = {
	event_id: string;
	max_seats: number;
	seats_remaining: number;
	registered: number;
	waitlisted: number;
};

async function countsOf(eventIds: string[]): Promise<EventCounts[]> {
	return db.execute<EventCounts>(sql`
		SELECT e.id AS event_id, e.max_seats, c.seats_remaining,
			count(r.id) FILTER (WHERE r.state = 'registered')::int AS registered,
			count(r.id) FILTER (WHERE r.state = 'waitlisted')::int AS waitlisted
		FROM events e
		JOIN event_seat_counts c ON c.event_id = e.id
		LEFT JOIN event_registrations r ON r.event_id = e.id
		WHERE e.id IN ${eventIds}
		GROUP BY e.id, e.max_seats, c.seats_remaining
	`);
}

/** Problems with the database state after a run; empty when every invariant holds. */
function invariantProblems(rows: EventCounts[]): string[] {
	return rows.flatMap((row) => {
		const problems: string[] = [];
		if (row.seats_remaining !== row.max_seats - row.registered) {
			problems.push(
				`${row.event_id}: seat count ${row.seats_remaining} ≠ ${row.max_seats} − ${row.registered} registered`,
			);
		}
		if (row.registered > row.max_seats) {
			problems.push(
				`${row.event_id}: ${row.registered} registered for ${row.max_seats} places`,
			);
		}
		if (row.waitlisted > 0 && row.seats_remaining > 0) {
			problems.push(
				`${row.event_id}: ${row.waitlisted} waiting while ${row.seats_remaining} places are free`,
			);
		}
		return problems;
	});
}

/** After the spike: exactly the places taken, everyone else waiting, counts consistent. */
export async function verifySpike(run: LoadRun): Promise<string[]> {
	const [row] = await countsOf([run.spike.eventId]);
	if (!row) {
		return ["spike event not found"];
	}
	const users = run.spike.users.length;
	const problems = invariantProblems([row]);
	if (row.registered !== row.max_seats) {
		problems.push(
			`spike: ${row.registered} registered, expected ${row.max_seats}`,
		);
	}
	if (row.waitlisted !== users - row.max_seats) {
		problems.push(
			`spike: ${row.waitlisted} waitlisted, expected ${users - row.max_seats}`,
		);
	}
	console.log(
		`spike: ${row.registered}/${row.max_seats} registered, ${row.waitlisted} waitlisted, ${row.seats_remaining} places left`,
	);
	return problems;
}

/** After the steady run: every event's counters agree with its rows and nobody is stuck. */
export async function verifySteady(users: LoadUsers): Promise<string[]> {
	const rows = await countsOf(users.eventIds);
	for (const row of rows) {
		console.log(
			`steady ${row.event_id}: ${row.registered}/${row.max_seats} registered, ${row.waitlisted} waitlisted`,
		);
	}
	return invariantProblems(rows);
}

/**
 * Waits until the worker has sent every queued e-mail; returns how long that took, or a
 * problem when it doesn't drain in time (registrations queue a confirmation each).
 */
export async function drainEmails(
	timeoutSeconds: number,
): Promise<{ seconds: number; problems: string[] }> {
	const started = Date.now();
	for (;;) {
		const [row] = await db.execute<{ pending: number }>(sql`
			SELECT count(*)::int AS pending FROM pgboss.job
			WHERE name = 'emails' AND state IN ('created', 'retry', 'active')
		`);
		const seconds = (Date.now() - started) / 1000;
		if ((row?.pending ?? 0) === 0) {
			return { seconds, problems: [] };
		}
		if (seconds > timeoutSeconds) {
			return {
				seconds,
				problems: [
					`e-mails: ${row?.pending} still queued after ${timeoutSeconds} s`,
				],
			};
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
}
