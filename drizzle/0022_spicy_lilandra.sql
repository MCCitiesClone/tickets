ALTER TABLE "guild" ADD COLUMN "support_timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "guild" ADD COLUMN "support_hours" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "guild" ADD COLUMN "support_response_hint" text;