import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { db } from "@repo/db/client";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { authSessions, authUsers } from "@repo/db/schema/better-auth";
import { eventRegistrations } from "@repo/db/schema/event-registrations";
import { env } from "@repo/env";
import { serializeSignedCookie } from "better-call";
import { eq } from "drizzle-orm";
import { toJSONAsync } from "seroval";
import { createTestEvent } from "../fixtures/data";
import {
	LOAD,
	LOAD_FUNCTIONS,
	type LoadDocuments,
	type LoadFunction,
	type LoadRun,
	type LoadUsers,
} from "./config";

/**
 * Server functions are addressed by hashed ids (stable per build). Read them from the
 * manifest of the image under test, by export name, so k6 calls what the browser calls.
 */
function readFunctionIds(): Record<LoadFunction, string> {
	const manifest = execFileSync(
		"docker",
		[
			"compose",
			"-p",
			LOAD.composeProject,
			"exec",
			"-T",
			"web",
			"sh",
			"-c",
			"cat /app/.output/server/__23tanstack-start-server-fn-resolver-*.mjs",
		],
		{ encoding: "utf8" },
	);
	const ids = new Map<string, string>();
	for (const match of manifest.matchAll(
		/"([a-f0-9]{64})":\s*\{\s*functionName:\s*"(\w+?)_createServerFn_handler"/g,
	)) {
		ids.set(match[2] ?? "", match[1] ?? "");
	}
	return Object.fromEntries(
		LOAD_FUNCTIONS.map((name) => {
			const id = ids.get(name);
			if (!id) {
				throw new Error(
					`Server function ${name} is not in the web build's manifest (did TanStack Start change its format?)`,
				);
			}
			return [name, id];
		}),
	) as Record<LoadFunction, string>;
}

/** Users with a signed session cookie, created directly (sign-in has CAPTCHA and rate limits). */
async function createUsers(count: number, label: string) {
	const runId = randomBytes(4).toString("hex");
	const users = Array.from({ length: count }, (_, index) => ({
		id: crypto.randomUUID(),
		email: `load-${label}-${runId}-${index}@load.test`,
		token: randomBytes(32).toString("base64url"),
	}));
	await db.insert(authUsers).values(
		users.map((user) => ({
			id: user.id,
			email: user.email,
			name: `Load ${label} ${user.email.split("@")[0]}`,
			emailVerified: true,
		})),
	);
	await db.insert(authSessions).values(
		users.map((user) => ({
			id: crypto.randomUUID(),
			userId: user.id,
			token: user.token,
			expiresAt: new Date(Date.now() + 86_400_000),
		})),
	);
	return Promise.all(
		users.map(async (user) => {
			const header = await serializeSignedCookie(
				"better-auth.session_token",
				user.token,
				env.BETTER_AUTH_SECRET,
			);
			return { ...user, cookie: header.split(";")[0] ?? "" };
		}),
	);
}

/** The JSON body a browser sends for a server function call with this input. */
async function payload(data: Record<string, string>): Promise<string> {
	return JSON.stringify(await toJSONAsync({ data }));
}

/** Users who browse and register/withdraw on the given events. */
async function usersFor(
	count: number,
	label: string,
	eventIds: string[],
): Promise<LoadUsers> {
	const users = await createUsers(count, label);
	return {
		eventIds,
		users: await Promise.all(
			users.map(async (user) => ({
				cookie: user.cookie,
				register: await Promise.all(
					eventIds.map((eventId) => payload({ eventId, locale: "pl" })),
				),
				unregister: await Promise.all(
					eventIds.map((eventId) => payload({ eventId })),
				),
			})),
		),
	};
}

async function createEvents(count: number, label: string, maxSeats: number) {
	const created = await Promise.all(
		Array.from({ length: count }, (_, index) =>
			createTestEvent({
				title: `Load ${label} ${index} ${randomBytes(3).toString("hex")}`,
				maxSeats,
				startsInDays: 21,
			}),
		),
	);
	return created.map((event) => event.id);
}

/** One event everyone holds a ticket for, plus people who only browse. */
async function documentsRun(): Promise<LoadDocuments> {
	const event = await createTestEvent({
		title: `Load documents ${randomBytes(3).toString("hex")}`,
		maxSeats: LOAD.documentsUsers,
		startsInDays: 22,
	});
	const holders = await createUsers(LOAD.documentsUsers, "documents");
	for (const holder of holders) {
		await registerForEvent(event.id, holder.id, "pl");
	}
	const registrations = await db
		.select({ id: eventRegistrations.id, userId: eventRegistrations.userId })
		.from(eventRegistrations)
		.where(eq(eventRegistrations.eventId, event.id));
	const byUser = new Map(registrations.map((row) => [row.userId, row.id]));
	const browsers = await createUsers(LOAD.documentsBrowseUsers, "browse");
	return {
		eventId: event.id,
		downloads: holders.map((holder) => ({
			cookie: holder.cookie,
			path: `/api/tickets/${byUser.get(holder.id)}/pdf?lang=pl`,
		})),
		browsers: browsers.map((user) => ({ cookie: user.cookie })),
	};
}

export async function setupLoadRun(options: {
	stress: boolean;
	documents?: boolean;
}): Promise<LoadRun> {
	if (options.documents) {
		const run: LoadRun = {
			webUrl: LOAD.webUrl,
			functionIds: readFunctionIds(),
			spike: { eventId: "", users: [] },
			steady: { eventIds: [], users: [] },
			documents: await documentsRun(),
		};
		mkdirSync(LOAD.runDir, { recursive: true });
		writeFileSync(new URL("run.json", LOAD.runDir), JSON.stringify(run));
		return run;
	}
	const functionIds = readFunctionIds();
	const spikeEvent = await createTestEvent({
		title: `Load spike ${randomBytes(3).toString("hex")}`,
		maxSeats: LOAD.spikeSeats,
		startsInDays: 20,
	});
	const spikeUsers = await createUsers(LOAD.spikeUsers, "spike");

	const run: LoadRun = {
		webUrl: LOAD.webUrl,
		functionIds,
		spike: {
			eventId: spikeEvent.id,
			users: await Promise.all(
				spikeUsers.map(async (user) => ({
					cookie: user.cookie,
					register: await payload({ eventId: spikeEvent.id, locale: "pl" }),
				})),
			),
		},
		steady: await usersFor(
			LOAD.steadyUsers,
			"steady",
			await createEvents(LOAD.steadyEvents, "steady", LOAD.steadySeats),
		),
		stress: options.stress
			? await usersFor(
					LOAD.stressUsers,
					"stress",
					await createEvents(LOAD.steadyEvents, "stress", LOAD.steadySeats * 5),
				)
			: undefined,
	};
	mkdirSync(LOAD.runDir, { recursive: true });
	writeFileSync(new URL("run.json", LOAD.runDir), JSON.stringify(run));
	return run;
}
