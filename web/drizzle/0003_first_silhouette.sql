CREATE TABLE "model_prices" (
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input" numeric(12, 4) NOT NULL,
	"output" numeric(12, 4) NOT NULL,
	"cache_read" numeric(12, 4) DEFAULT 0 NOT NULL,
	"cache_write_5m" numeric(12, 4) DEFAULT 0 NOT NULL,
	"cache_write_1h" numeric(12, 4) DEFAULT 0 NOT NULL,
	"batch_discount_percent" integer DEFAULT 50 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_prices_provider_model_pk" PRIMARY KEY("provider","model")
);
--> statement-breakpoint
ALTER TABLE "usage_events" ADD COLUMN "batch" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "model_prices" ADD CONSTRAINT "model_prices_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;