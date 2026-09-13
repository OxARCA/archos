CREATE TABLE "budgets" (
	"user_id" text PRIMARY KEY NOT NULL,
	"monthly_cap_micro_usd" bigint DEFAULT 0 NOT NULL,
	"per_job_cap_micro_usd" bigint DEFAULT 25000000 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"stage" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_5m_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_1h_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micro_usd" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_events_user_created_idx" ON "usage_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_events_job_idx" ON "usage_events" USING btree ("job_id");