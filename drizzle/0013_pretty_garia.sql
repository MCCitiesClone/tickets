ALTER TABLE "guild" ADD COLUMN "feedback_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transcript" ADD COLUMN "rating" integer;--> statement-breakpoint
ALTER TABLE "transcript" ADD COLUMN "feedback_comment" text;--> statement-breakpoint
ALTER TABLE "transcript" ADD COLUMN "rated_at" timestamp;