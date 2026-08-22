CREATE TABLE "form_question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"style" text DEFAULT 'short' NOT NULL,
	"placeholder" text,
	"required" boolean DEFAULT true NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"multiple" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "panel" ADD COLUMN "shared_question_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "form_question" ADD CONSTRAINT "form_question_guild_id_guild_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guild"("guild_id") ON DELETE cascade ON UPDATE no action;