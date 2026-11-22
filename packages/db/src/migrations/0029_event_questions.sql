CREATE TABLE "event_questions" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"event_id" text NOT NULL,
	"label" text NOT NULL,
	"kind" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_questions_kind_check" CHECK ("event_questions"."kind" IN ('text', 'choice', 'yesno'))
);
--> statement-breakpoint
CREATE TABLE "registration_answers" (
	"registration_id" text NOT NULL,
	"question_id" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "registration_answers_registration_id_question_id_pk" PRIMARY KEY("registration_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "event_questions" ADD CONSTRAINT "event_questions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_answers" ADD CONSTRAINT "registration_answers_registration_id_event_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_answers" ADD CONSTRAINT "registration_answers_question_id_event_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."event_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_questions_event_position_idx" ON "event_questions" USING btree ("event_id","position");--> statement-breakpoint
CREATE INDEX "registration_answers_question_idx" ON "registration_answers" USING btree ("question_id");