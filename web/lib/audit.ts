import "server-only";

import { db, type Database } from "@/db";
import { auditLog } from "@/db/app-schema";

export type AuditAction = "user.banned" | "user.unbanned" | "budget.changed";

type AuditEntry = {
  actorId: string;
  action: AuditAction;
  targetType: "user";
  targetId: string;
  // Never put secrets here.
  metadata?: Record<string, unknown>;
};

/** Writes one audit_log row. Pass a transaction to commit it with the change it records. */
export async function recordAudit(entry: AuditEntry, executor: Pick<Database, "insert"> = db) {
  await executor.insert(auditLog).values(entry);
}
