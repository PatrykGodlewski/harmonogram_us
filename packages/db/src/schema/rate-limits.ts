import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Fixed-window request counters per key (`<prefix>:<key>`), with an optional block after exhaustion. */
export const appRateLimits = pgTable("app_rate_limits", {
	key: text("key").primaryKey(),
	windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
	points: integer("points").notNull(),
	blockedUntil: timestamp("blocked_until", { withTimezone: true }),
});
