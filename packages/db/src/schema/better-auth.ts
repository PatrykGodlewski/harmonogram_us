import { relations, sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const authUsers = pgTable(
	"user",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		email: text("email").notNull().unique(),
		emailVerified: boolean("email_verified").notNull().default(false),
		image: text("image"),
		/** "user" | "organizer" | "admin". Organizers create events; admins manage everything. */
		role: text("role").notNull().default("user"),
		/** Language chosen in the profile; null: none chosen (e-mails use the registration's). */
		locale: text("locale").$type<"pl" | "en">(),
		/** Secret part of the personal calendar feed URL ("my registrations"). */
		calendarToken: text("calendar_token")
			.notNull()
			.unique()
			.default(
				sql`replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')`,
			),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		check(
			"user_role_check",
			sql`${table.role} IN ('user', 'organizer', 'admin')`,
		),
		check("user_locale_check", sql`${table.locale} IN ('pl', 'en')`),
	],
);

export const authSessions = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => authUsers.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_user_id_idx").on(table.userId)],
);

export const authAccounts = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => authUsers.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("account_user_id_idx").on(table.userId)],
);

export const authVerifications = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const authUsersRelations = relations(authUsers, ({ many }) => ({
	sessions: many(authSessions),
	accounts: many(authAccounts),
}));
