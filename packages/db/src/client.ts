/// <reference types="node" />
import { env } from "@repo/env";
import { drizzle } from "drizzle-orm/postgres-js";
import {
	authAccounts,
	authSessions,
	authUsers,
	authVerifications,
} from "./schema/better-auth";
import {
	eventFaculties,
	eventLocations,
	eventTypes,
} from "./schema/event-lookups";
import {
	eventRegistrations,
	eventRegistrationsRelations,
	eventSeatCounts,
	eventSeatCountsRelations,
} from "./schema/event-registrations";
import { events, eventsRelations } from "./schema/events";

export const db = drizzle(env.DATABASE_URL, {
	schema: {
		authUsers,
		authSessions,
		authAccounts,
		authVerifications,
		eventTypes,
		eventLocations,
		eventFaculties,
		events,
		eventsRelations,
		eventRegistrations,
		eventRegistrationsRelations,
		eventSeatCounts,
		eventSeatCountsRelations,
	},
});
