ALTER TABLE "guild" ADD COLUMN "overflow_category_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "guild" ADD COLUMN "auto_create_overflow" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "guild" ADD COLUMN "auto_overflow_category_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;