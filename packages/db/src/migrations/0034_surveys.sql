CREATE TABLE "survey_answers" (
	"response_id" text NOT NULL,
	"question_id" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "survey_answers_response_id_question_id_pk" PRIMARY KEY("response_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"event_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_questions" DROP CONSTRAINT "event_questions_kind_check";--> statement-breakpoint
DROP INDEX "event_questions_event_position_idx";--> statement-breakpoint
ALTER TABLE "event_questions" ADD COLUMN "form" text DEFAULT 'registration' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "survey_emailed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "survey_answered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_response_id_survey_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."survey_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_question_id_event_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."event_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "survey_answers_question_idx" ON "survey_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "survey_responses_event_id_idx" ON "survey_responses" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_questions_event_form_position_idx" ON "event_questions" USING btree ("event_id","form","position");--> statement-breakpoint
ALTER TABLE "event_questions" ADD CONSTRAINT "event_questions_form_check" CHECK ("event_questions"."form" IN ('registration', 'survey'));--> statement-breakpoint
ALTER TABLE "event_questions" ADD CONSTRAINT "event_questions_rating_survey_check" CHECK ("event_questions"."kind" <> 'rating' OR "event_questions"."form" = 'survey');--> statement-breakpoint
ALTER TABLE "event_questions" ADD CONSTRAINT "event_questions_kind_check" CHECK ("event_questions"."kind" IN ('text', 'choice', 'yesno', 'rating'));