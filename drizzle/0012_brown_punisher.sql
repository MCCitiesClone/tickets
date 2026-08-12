CREATE TYPE "public"."blacklist_target_type" AS ENUM('user', 'role');--> statement-breakpoint
CREATE TABLE "blacklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"target_type" "blacklist_target_type" NOT NULL,
	"target_id" text NOT NULL,
	"reason" text,
	"added_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blacklist_guild_target_unique" UNIQUE("guild_id","target_type","target_id")
);
--> statement-breakpoint
ALTER TABLE "blacklist" ADD CONSTRAINT "blacklist_guild_id_guild_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild"("guild_id") ON DELETE cascade ON UPDATE no action;