CREATE TABLE "multi_panel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text,
	"message_id" text,
	"title" text DEFAULT 'Open a ticket' NOT NULL,
	"description" text DEFAULT 'Select the type of ticket you''d like to open below.' NOT NULL,
	"color" integer DEFAULT 5793266 NOT NULL,
	"large_image_url" text,
	"small_image_url" text,
	"use_dropdown" boolean DEFAULT false NOT NULL,
	"panel_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "multi_panel" ADD CONSTRAINT "multi_panel_guild_id_guild_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild"("guild_id") ON DELETE cascade ON UPDATE no action;