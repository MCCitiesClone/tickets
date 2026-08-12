ALTER TABLE "ticket" ADD COLUMN "close_requested_by" text;--> statement-breakpoint
ALTER TABLE "ticket" ADD COLUMN "close_request_reason" text;--> statement-breakpoint
ALTER TABLE "ticket" ADD COLUMN "close_request_expires_at" timestamp;