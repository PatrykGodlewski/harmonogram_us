import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { agendaItems } from "./agenda";
import { authUsers } from "./better-auth";
import { eventRegistrations } from "./event-registrations";
import { events } from "./events";

/** A teacher's block of held places for an event. Holds count in seat counts while `open`. */
export const registrationGroups = pgTable(
	"registration_groups",
	{
		id: text("id").primaryKey().default(sql`(gen_random_uuid())::text`),
		eventId: text("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		ownerUserId: text("owner_user_id")
			.notNull()
			.references(() => authUsers.id, { onDelete: "cascade" }),
		name: text("name"),
		places: integer("places").notNull(),
		/** "open" | "closed" | "cancelled" */
		status: text("status").notNull().default("open"),
		joinCode: text("join_code").unique(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		check("registration_groups_places_positive", sql`${table.places} > 0`),
		index("registration_groups_event_idx").on(table.eventId),
		index("registration_groups_owner_idx").on(table.ownerUserId),
	],
);

/** The group's default agenda items. */
export const registrationGroupItems = pgTable(
	"registration_group_items",
	{
		groupId: text("group_id")
			.notNull()
			.references(() => registrationGroups.id, { onDelete: "cascade" }),
		agendaItemId: text("agenda_item_id")
			.notNull()
			.references(() => agendaItems.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.groupId, table.agendaItemId] })],
);

export const registrationGroupMembers = pgTable(
	"registration_group_members",
	{
		id: text("id").primaryKey().default(sql`(gen_random_uuid())::text`),
		groupId: text("group_id")
			.notNull()
			.references(() => registrationGroups.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		/** "invited" | "confirmed" */
		status: text("status").notNull().default("invited"),
		/** "email" | "link" */
		invitedVia: text("invited_via").notNull(),
		/** sha256 hex of the invitation token; cleared once used. */
		tokenHash: text("token_hash").unique(),
		userId: text("user_id").references(() => authUsers.id, {
			onDelete: "set null",
		}),
		/** Cascade: when a confirmed student's registration goes, the member goes and the place returns to the group. */
		eventRegistrationId: text("event_registration_id").references(
			() => eventRegistrations.id,
			{ onDelete: "cascade" },
		),
		invitedAt: timestamp("invited_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("registration_group_members_group_email_unique").on(
			table.groupId,
			table.email,
		),
	],
);

/** Per-student items (default: the group's items; editable by the teacher). */
export const registrationGroupMemberItems = pgTable(
	"registration_group_member_items",
	{
		memberId: text("member_id")
			.notNull()
			.references(() => registrationGroupMembers.id, { onDelete: "cascade" }),
		agendaItemId: text("agenda_item_id")
			.notNull()
			.references(() => agendaItems.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.memberId, table.agendaItemId] })],
);

export const registrationGroupsRelations = relations(
	registrationGroups,
	({ one, many }) => ({
		event: one(events, {
			fields: [registrationGroups.eventId],
			references: [events.id],
		}),
		members: many(registrationGroupMembers),
	}),
);

export const registrationGroupMembersRelations = relations(
	registrationGroupMembers,
	({ one }) => ({
		group: one(registrationGroups, {
			fields: [registrationGroupMembers.groupId],
			references: [registrationGroups.id],
		}),
	}),
);
