import "server-only";

import { db, type Database } from "@/db";
import { auditLog } from "@/db/app-schema";

export type AuditAction = "key.saved" | "key.revoked" | "user.banned" | "user.unbanned";

type AuditEntry = {
  actorId: string;
  action: AuditAction;
  targetType: "provider_key" | "user";
  targetId: string;
  // Never put key material here: provider and last4 at most.
  metadata?: Record<string, unknown>;
};

/** Writes one audit_log row. Pass a transaction to commit it with the change it records. */
export async function recordAudit(entry: AuditEntry, executor: Pick<Database, "insert"> = db) {
  await executor.insert(auditLog).values(entry);
}
