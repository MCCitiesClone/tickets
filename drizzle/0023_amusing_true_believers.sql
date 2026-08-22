CREATE TYPE "public"."ticket_waiting_on" AS ENUM('staff', 'user');--> statement-breakpoint
ALTER TABLE "guild" ADD COLUMN "status_board_channel_id" text;--> statement-breakpoint
ALTER TABLE "guild" ADD COLUMN "status_board_message_id" text;--> statement-breakpoint
ALTER TABLE "ticket" ADD COLUMN "waiting_on" "ticket_waiting_on" DEFAULT 'staff' NOT NULL;