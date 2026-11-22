/// <reference types="node" />
import { env } from "@repo/env";
import { drizzle } from "drizzle-orm/postgres-js";
import {
	agendaItemRegistrations,
	agendaItemRegistrationsRelations,
	agendaItemSeatCounts,
	agendaItems,
	agendaItemsRelations,
} from "./schema/agenda";
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
	eventOrganizers,
	eventOrganizersRelations,
} from "./schema/event-organizers";
import {
	eventRegistrations,
	eventRegistrationsRelations,
	eventSeatCounts,
	eventSeatCountsRelations,
} from "./schema/event-registrations";
import { events, eventsRelations } from "./schema/events";
import {
	registrationGroupItems,
	registrationGroupMemberItems,
	registrationGroupMembers,
	registrationGroupMembersRelations,
	registrationGroups,
	registrationGroupsRelations,
} from "./schema/groups";

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
		eventOrganizers,
		eventOrganizersRelations,
		eventRegistrations,
		eventRegistrationsRelations,
		eventSeatCounts,
		eventSeatCountsRelations,
		agendaItems,
		agendaItemsRelations,
		agendaItemRegistrations,
		agendaItemRegistrationsRelations,
		agendaItemSeatCounts,
		registrationGroups,
		registrationGroupsRelations,
		registrationGroupItems,
		registrationGroupMembers,
		registrationGroupMembersRelations,
		registrationGroupMemberItems,
	},
});

export type DbClient = typeof db;
export type TransactionClient = Parameters<
	Parameters<DbClient["transaction"]>[0]
>[0];
/** Either the pool or an open transaction. */
export type DbExecutor = DbClient | TransactionClient;

/** Closes the connection pool (scripts and tests; servers keep it open). */
export async function closeDb(): Promise<void> {
	await db.$client.end();
}
