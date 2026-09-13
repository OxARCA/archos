import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { budgets, usageEvents } from "@/db/app-schema";
import { recordAudit } from "./audit";
import { MICRO_PER_USD, parseUsd } from "./money";

/**
 * Per-user budgets in micro-dollars (notes/03). A user without a budget row
 * has a monthly cap of zero, so a new account cannot spend anything until an
 * admin sets one. Months are calendar months in UTC.
 */
export const DEFAULT_PER_JOB_CAP_MICRO_USD = 25 * MICRO_PER_USD;

export type Budget = { monthlyCapMicroUsd: number; perJobCapMicroUsd: number };
export type BudgetStatus = Budget & { spentMicroUsd: number; remainingMicroUsd: number };

const NO_BUDGET: Budget = { monthlyCapMicroUsd: 0, perJobCapMicroUsd: DEFAULT_PER_JOB_CAP_MICRO_USD };

/** Midnight UTC on the 1st of this month, when budgets reset. */
export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function nextMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/**
 * Team-wide cap from TEAM_MONTHLY_USD_CAP (dollars), or null when unset. A
 * value that isn't a dollar amount counts as zero, so a typo stops spending
 * instead of removing the limit.
 */
export function teamCapMicroUsd(): number | null {
  const raw = process.env.TEAM_MONTHLY_USD_CAP?.trim();
  if (!raw) return null;
  const cap = parseUsd(raw);
  if (cap === null) {
    console.warn(`[budget] TEAM_MONTHLY_USD_CAP="${raw}" is not a dollar amount; treating it as $0.`);
    return 0;
  }
  return cap;
}

/** What a user may still spend: their own cap minus their spend, and never more than is left of the team cap. */
export function remainingMicroUsd(input: {
  capMicroUsd: number;
  spentMicroUsd: number;
  teamCapMicroUsd: number | null;
  teamSpentMicroUsd: number;
}): number {
  const own = Math.max(0, input.capMicroUsd - input.spentMicroUsd);
  if (input.teamCapMicroUsd === null) return own;
  return Math.min(own, Math.max(0, input.teamCapMicroUsd - input.teamSpentMicroUsd));
}

export async function getBudget(userId: string): Promise<Budget> {
  const [row] = await db
    .select({ monthlyCapMicroUsd: budgets.monthlyCapMicroUsd, perJobCapMicroUsd: budgets.perJobCapMicroUsd })
    .from(budgets)
    .where(eq(budgets.userId, userId));
  return row ?? NO_BUDGET;
}

export async function allBudgets(): Promise<Map<string, Budget>> {
  const rows = await db.select().from(budgets);
  return new Map(
    rows.map((r) => [r.userId, { monthlyCapMicroUsd: r.monthlyCapMicroUsd, perJobCapMicroUsd: r.perJobCapMicroUsd }]),
  );
}

/** Spend since the start of this month, for one user or the whole team. Unpriced calls count as $0. */
async function spentThisMonth(userId?: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${usageEvents.costMicroUsd}), 0)`.mapWith(Number) })
    .from(usageEvents)
    .where(and(gte(usageEvents.createdAt, monthStart()), userId ? eq(usageEvents.userId, userId) : undefined));
  return row?.total ?? 0;
}

export function teamSpentThisMonthMicroUsd(): Promise<number> {
  return spentThisMonth();
}

export async function budgetStatus(userId: string): Promise<BudgetStatus> {
  const teamCap = teamCapMicroUsd();
  const [budget, spent, teamSpent] = await Promise.all([
    getBudget(userId),
    spentThisMonth(userId),
    teamCap === null ? 0 : spentThisMonth(),
  ]);
  return {
    ...budget,
    spentMicroUsd: spent,
    remainingMicroUsd: remainingMicroUsd({
      capMicroUsd: budget.monthlyCapMicroUsd,
      spentMicroUsd: spent,
      teamCapMicroUsd: teamCap,
      teamSpentMicroUsd: teamSpent,
    }),
  };
}

/** Sets a user's caps and records the change, old and new, in the audit log. */
export async function setBudget(adminId: string, userId: string, next: Budget): Promise<void> {
  await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ monthlyCapMicroUsd: budgets.monthlyCapMicroUsd, perJobCapMicroUsd: budgets.perJobCapMicroUsd })
      .from(budgets)
      .where(eq(budgets.userId, userId));
    const values = { ...next, updatedBy: adminId, updatedAt: new Date() };
    await tx
      .insert(budgets)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: budgets.userId, set: values });
    await recordAudit(
      {
        actorId: adminId,
        action: "budget.changed",
        targetType: "user",
        targetId: userId,
        metadata: { before: before ?? null, after: next },
      },
      tx,
    );
  });
}
