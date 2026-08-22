CREATE TABLE "on_call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"note" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "on_call_guild_user_unique" UNIQUE("guild_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "guild" ADD COLUMN "on_call_ping_on_open" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "on_call" ADD CONSTRAINT "on_call_guild_id_guild_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild"("guild_id") ON DELETE cascade ON UPDATE no action;