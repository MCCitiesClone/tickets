CREATE TABLE "canned_response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"template" jsonb DEFAULT '{"embeds":[]}'::jsonb NOT NULL,
	"access_role_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "canned_response_guild_name_unique" UNIQUE("guild_id","name")
);
--> statement-breakpoint
ALTER TABLE "canned_response" ADD CONSTRAINT "canned_response_guild_id_guild_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild"("guild_id") ON DELETE cascade ON UPDATE no action;