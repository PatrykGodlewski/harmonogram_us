ALTER TABLE "agenda_items" ADD COLUMN "speakers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agenda_items" ADD COLUMN "materials" jsonb DEFAULT '[]'::jsonb NOT NULL;