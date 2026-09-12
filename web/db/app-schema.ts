import { sql } from "drizzle-orm";
import {
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { PROVIDER_IDS } from "../lib/providers";
import { user } from "./schema";

/**
 * Our own tables (notes/01-architecture.md, "Data model"). Better Auth's
 * tables live in ./schema.ts, which `npm run auth:generate` overwrites, so
 * nothing of ours goes there.
 */

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const providerKeys = pgTable(
  "provider_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: PROVIDER_IDS }).notNull(),
    // AES-256-GCM output from lib/vault.ts; the ciphertext is wiped on revoke.
    ciphertext: bytea("ciphertext").notNull(),
    iv: bytea("iv").notNull(),
    tag: bytea("tag").notNull(),
    keyVersion: integer("key_version").notNull(),
    last4: text("last4").notNull(),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // At most one active key per user and provider.
    uniqueIndex("provider_keys_active_idx")
      .on(table.userId, table.provider)
      .where(sql`revoked_at is null`),
    check(
      "provider_keys_provider_check",
      sql.raw(`provider in (${PROVIDER_IDS.map((p) => `'${p}'`).join(", ")})`),
    ),
  ],
);

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
