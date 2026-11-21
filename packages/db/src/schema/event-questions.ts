import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { eventRegistrations } from "./event-registrations";
import { events } from "./events";

/** Free text, one of the listed options, or yes/no. */
export type QuestionKind = "text" | "choice" | "yesno";

/** A question people answer when they register (F10). */
export const eventQuestions = pgTable(
	"event_questions",
	{
		id: text("id").primaryKey().default(sql`(gen_random_uuid())::text`),
		eventId: text("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		label: text("label").notNull(),
		kind: text("kind").$type<QuestionKind>().notNull(),
		/** The choices of a `choice` question; empty for the others. */
		options: jsonb("options").$type<string[]>().notNull().default([]),
		required: boolean("required").notNull().default(false),
		position: integer("position").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		check(
			"event_questions_kind_check",
			sql`${table.kind} IN ('text', 'choice', 'yesno')`,
		),
		index("event_questions_event_position_idx").on(
			table.eventId,
			table.position,
		),
	],
);

/** One answer per question per registration; removed with either. */
export const registrationAnswers = pgTable(
	"registration_answers",
	{
		registrationId: text("registration_id")
			.notNull()
			.references(() => eventRegistrations.id, { onDelete: "cascade" }),
		questionId: text("question_id")
			.notNull()
			.references(() => eventQuestions.id, { onDelete: "cascade" }),
		/** Text, the chosen option, or "yes" / "no". */
		value: text("value").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.registrationId, table.questionId] }),
		index("registration_answers_question_idx").on(table.questionId),
	],
);
