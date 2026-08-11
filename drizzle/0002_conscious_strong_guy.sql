ALTER TABLE "panel" ADD COLUMN "questions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket" ADD COLUMN "form_responses" jsonb DEFAULT '[]'::jsonb NOT NULL;