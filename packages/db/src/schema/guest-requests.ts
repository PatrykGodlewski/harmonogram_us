import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { Answers } from "../queries/registration-answers";
import { events } from "./events";

/**
 * A guest's registration waiting for e-mail confirmation (F17). Not a registration: it
 * holds no place, and confirming it registers through the normal path. Only a hash of
 * the token is stored; rows expire after 24 hours.
 */
export const guestRegistrationRequests = pgTable(
	"guest_registration_requests",
	{
		tokenHash: text("token_hash").primaryKey(),
		eventId: text("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		name: text("name").notNull(),
		locale: text("locale").$type<"pl" | "en">().notNull(),
		answers: jsonb("answers").$type<Answers>().notNull(),
		/** The invite link the guest used, for invite-only events. */
		inviteToken: text("invite_token"),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	},
);
