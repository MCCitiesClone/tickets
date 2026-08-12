ALTER TABLE "guild" ADD COLUMN "message_templates" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "panel" ADD COLUMN "welcome_template" jsonb;