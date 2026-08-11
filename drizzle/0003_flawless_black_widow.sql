CREATE TABLE "panel_cooldown" (
	"panel_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "panel_cooldown_panel_id_user_id_pk" PRIMARY KEY("panel_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "panel" ADD COLUMN "color" integer DEFAULT 5793266 NOT NULL;--> statement-breakpoint
ALTER TABLE "panel" ADD COLUMN "large_image_url" text;--> statement-breakpoint
ALTER TABLE "panel" ADD COLUMN "small_image_url" text;--> statement-breakpoint
ALTER TABLE "panel" ADD COLUMN "disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "panel" ADD COLUMN "category_id" text;--> statement-breakpoint
ALTER TABLE "panel" ADD COLUMN "naming_scheme" text;--> statement-breakpoint
ALTER TABLE "panel" ADD COLUMN "welcome_message" text;--> statement-breakpoint
ALTER TABLE "panel" ADD COLUMN "support_role_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "panel" ADD COLUMN "mention_role_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "panel" ADD COLUMN "cooldown_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "panel" ADD COLUMN "access_control" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "panel" ADD COLUMN "hide_claim" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "panel" ADD COLUMN "hide_close" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "panel" ADD COLUMN "hide_close_with_reason" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "panel_cooldown" ADD CONSTRAINT "panel_cooldown_panel_id_panel_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."panel"("id") ON DELETE cascade ON UPDATE no action;