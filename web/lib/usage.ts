import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { usageEvents } from "@/db/app-schema";
import { budgetStatus, monthStart } from "./budget";
import { costMicroUsd, getPrice, type TokenUsage } from "./prices";

/** One model call, as the engine (or a web feature) reports it. */
export type UsageReport = {
  /** Unique per call; a report sent twice is recorded once. */
  eventId: string;
  userId: string;
  jobId?: string | null;
  provider: string;
  model: string;
  stage?: string | null;
  /** Sent through the provider's Batch API, which bills at a discount. */
  batch?: boolean;
  usage: TokenUsage;
};

export type RecordResult = { recorded: boolean; costMicroUsd: number | null; remainingMicroUsd: number };

/**
 * Writes one model call to the ledger (notes/03) and says how much budget is
 * left. A model without a price is recorded with no cost and leaves no
 * budget, so the job that used it stops.
 */
export async function recordUsage(report: UsageReport): Promise<RecordResult> {
  for (const [field, count] of Object.entries(report.usage)) {
    if (!Number.isSafeInteger(count) || count < 0) throw new Error(`Invalid ${field}: ${count}`);
  }

  const price = await getPrice(report.provider, report.model);
  const batch = report.batch ?? false;
  const cost = price ? costMicroUsd(price, report.usage, batch) : null;

  const inserted = await db
    .insert(usageEvents)
    .values({
      id: report.eventId,
      userId: report.userId,
      jobId: report.jobId ?? null,
      provider: report.provider,
      model: report.model,
      stage: report.stage ?? null,
      batch,
      ...report.usage,
      costMicroUsd: cost,
    })
    .onConflictDoNothing({ target: usageEvents.id })
    .returning({ id: usageEvents.id });

  const { remainingMicroUsd } = await budgetStatus(report.userId);
  return { recorded: inserted.length > 0, costMicroUsd: cost, remainingMicroUsd: price ? remainingMicroUsd : 0 };
}

export type ModelUsage = {
  provider: string;
  model: string;
  calls: number;
  batchCalls: number;
  /** All input: uncached, read from cache and written to cache. */
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
  unpricedCalls: number;
};

const totalCost = sql<number>`coalesce(sum(${usageEvents.costMicroUsd}), 0)`.mapWith(Number);

/** This month's calls grouped by model, most expensive first; for one user, or everyone. */
export async function usageByModelThisMonth(userId?: string): Promise<ModelUsage[]> {
  return db
    .select({
      provider: usageEvents.provider,
      model: usageEvents.model,
      calls: sql<number>`count(*)`.mapWith(Number),
      batchCalls: sql<number>`count(*) filter (where ${usageEvents.batch})`.mapWith(Number),
      inputTokens: sql<number>`coalesce(sum(${usageEvents.inputTokens} + ${usageEvents.cacheReadTokens} + ${usageEvents.cacheWrite5mTokens} + ${usageEvents.cacheWrite1hTokens}), 0)`.mapWith(
        Number,
      ),
      outputTokens: sql<number>`coalesce(sum(${usageEvents.outputTokens}), 0)`.mapWith(Number),
      costMicroUsd: totalCost,
      unpricedCalls: sql<number>`count(*) filter (where ${usageEvents.costMicroUsd} is null)`.mapWith(Number),
    })
    .from(usageEvents)
    .where(and(gte(usageEvents.createdAt, monthStart()), userId ? eq(usageEvents.userId, userId) : undefined))
    .groupBy(usageEvents.provider, usageEvents.model)
    .orderBy(desc(totalCost));
}

export type UsageRow = {
  id: string;
  provider: string;
  model: string;
  stage: string | null;
  batch: boolean;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number | null;
  createdAt: Date;
};

export async function recentUsage(userId: string, limit = 20): Promise<UsageRow[]> {
  return db
    .select({
      id: usageEvents.id,
      provider: usageEvents.provider,
      model: usageEvents.model,
      stage: usageEvents.stage,
      batch: usageEvents.batch,
      inputTokens: sql<number>`${usageEvents.inputTokens} + ${usageEvents.cacheReadTokens} + ${usageEvents.cacheWrite5mTokens} + ${usageEvents.cacheWrite1hTokens}`.mapWith(
        Number,
      ),
      outputTokens: usageEvents.outputTokens,
      costMicroUsd: usageEvents.costMicroUsd,
      createdAt: usageEvents.createdAt,
    })
    .from(usageEvents)
    .where(eq(usageEvents.userId, userId))
    .orderBy(desc(usageEvents.createdAt))
    .limit(limit);
}

/** Spend this month per user, for the admin list. */
export async function spentThisMonthByUser(): Promise<Map<string, number>> {
  const rows = await db
    .select({ userId: usageEvents.userId, spent: totalCost })
    .from(usageEvents)
    .where(gte(usageEvents.createdAt, monthStart()))
    .groupBy(usageEvents.userId);
  return new Map(rows.map((r) => [r.userId, r.spent]));
}
