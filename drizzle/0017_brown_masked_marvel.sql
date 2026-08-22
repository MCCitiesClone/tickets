CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
ALTER TABLE "guild" ADD COLUMN "auto_close_exclude_high_priority" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket" ADD COLUMN "priority" "ticket_priority" DEFAULT 'normal' NOT NULL;