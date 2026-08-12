CREATE TABLE "transcript" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"guild_id" text NOT NULL,
	"token" text NOT NULL,
	"close_reason" text,
	"message_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transcript_ticket_id_unique" UNIQUE("ticket_id"),
	CONSTRAINT "transcript_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "ticket_message" ALTER COLUMN "discord_message_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ticket_message" ADD COLUMN "author_avatar_url" text;--> statement-breakpoint
ALTER TABLE "ticket_message" ADD COLUMN "author_bot" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_message" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_message" ADD COLUMN "embeds" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_message" ADD COLUMN "mentions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_message" ADD COLUMN "reply_to_id" text;--> statement-breakpoint
ALTER TABLE "ticket_message" ADD COLUMN "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "ticket_message" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "transcript" ADD CONSTRAINT "transcript_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript" ADD CONSTRAINT "transcript_guild_id_guild_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_ticket_id_discord_message_id_unique" UNIQUE("ticket_id","discord_message_id");