import { sql } from "drizzle-orm";
import {
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { eventQuestions } from "./event-questions";
import { events } from "./events";

/**
 * One filled-in survey (F20). Deliberately without a registration or user id:
 * answers stay anonymous and survive account deletion and retention.
 */
export const surveyResponses = pgTable(
	"survey_responses",
	{
		id: text("id").primaryKey().default(sql`(gen_random_uuid())::text`),
		eventId: text("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("survey_responses_event_id_idx").on(table.eventId)],
);

/** One answer per survey question in a response; removed with either. */
export const surveyAnswers = pgTable(
	"survey_answers",
	{
		responseId: text("response_id")
			.notNull()
			.references(() => surveyResponses.id, { onDelete: "cascade" }),
		questionId: text("question_id")
			.notNull()
			.references(() => eventQuestions.id, { onDelete: "cascade" }),
		/** Text, the chosen option, "yes" / "no", or "1"–"5". */
		value: text("value").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.responseId, table.questionId] }),
		index("survey_answers_question_idx").on(table.questionId),
	],
);
