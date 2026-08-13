ALTER TABLE "guild" ADD COLUMN "auto_close_hours" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "guild" ADD COLUMN "auto_close_warning_hours" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "guild" ADD COLUMN "auto_close_exclude_claimed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket" ADD COLUMN "last_activity_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket" ADD COLUMN "auto_close_warned_at" timestamp;