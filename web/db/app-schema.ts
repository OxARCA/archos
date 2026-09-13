import { bigint, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./schema";

/**
 * Our own tables (notes/01-architecture.md, "Data model"). Better Auth's
 * tables live in ./schema.ts, which `npm run auth:generate` overwrites, so
 * nothing of ours goes there.
 */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Kept as null if the acting user is deleted, so the entry survives.
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_created_at_idx").on(table.createdAt),
    index("audit_log_target_idx").on(table.targetType, table.targetId),
  ],
);

// Money columns hold whole micro-dollars (lib/money.ts).

export const budgets = pgTable("budgets", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  // Hard stop for the calendar month (UTC). A user with no row has a cap of zero.
  monthlyCapMicroUsd: bigint("monthly_cap_micro_usd", { mode: "number" }).notNull().default(0),
  // Hard stop for one job; enforced once jobs exist.
  perJobCapMicroUsd: bigint("per_job_cap_micro_usd", { mode: "number" }).notNull().default(25_000_000),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** The ledger: one row per model call, never edited. */
export const usageEvents = pgTable(
  "usage_events",
  {
    // The reporter's event id, so a retried report is recorded once.
    id: uuid("id").primaryKey(),
    // Restrict: a user with recorded spend can't be deleted, only banned.
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    // Links to the jobs table once it exists.
    jobId: text("job_id"),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    stage: text("stage"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWrite5mTokens: integer("cache_write_5m_tokens").notNull().default(0),
    cacheWrite1hTokens: integer("cache_write_1h_tokens").notNull().default(0),
    // Worked out when recorded; null when the model had no price.
    costMicroUsd: bigint("cost_micro_usd", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("usage_events_user_created_idx").on(table.userId, table.createdAt),
    index("usage_events_job_idx").on(table.jobId),
  ],
);
