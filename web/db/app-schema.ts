import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
