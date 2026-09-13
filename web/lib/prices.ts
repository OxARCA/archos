import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { modelPrices } from "@/db/app-schema";
import { recordAudit } from "./audit";

/**
 * Model prices in US dollars per million tokens, kept in the model_prices
 * table and edited on /admin/prices (notes/03). Cost is worked out when a
 * call is recorded, so a price change applies from the next call and never
 * rewrites past costs. A model with no row has no price, and a job using it
 * stops at once.
 */
export type Price = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  /** Percent off every token for calls sent through the Batch API. */
  batchDiscountPercent: number;
};

export type PriceRow = Price & { provider: string; model: string; updatedAt: Date };

/** Token counts for one model call, split the way the providers bill them. */
export type TokenUsage = {
  /** Input not read from or written to the cache. */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
};

/** Cost in micro-dollars: tokens times dollars-per-million is micro-dollars. */
export function costMicroUsd(price: Price, usage: TokenUsage, batch = false): number {
  const full =
    usage.inputTokens * price.input +
    usage.outputTokens * price.output +
    usage.cacheReadTokens * price.cacheRead +
    usage.cacheWrite5mTokens * price.cacheWrite5m +
    usage.cacheWrite1hTokens * price.cacheWrite1h;
  return Math.round(batch ? (full * (100 - price.batchDiscountPercent)) / 100 : full);
}

const priceColumns = {
  input: modelPrices.input,
  output: modelPrices.output,
  cacheRead: modelPrices.cacheRead,
  cacheWrite5m: modelPrices.cacheWrite5m,
  cacheWrite1h: modelPrices.cacheWrite1h,
  batchDiscountPercent: modelPrices.batchDiscountPercent,
};

function sameModel(provider: string, model: string) {
  return and(eq(modelPrices.provider, provider), eq(modelPrices.model, model));
}

export async function getPrice(provider: string, model: string): Promise<Price | undefined> {
  const [row] = await db.select(priceColumns).from(modelPrices).where(sameModel(provider, model));
  return row;
}

export async function listPrices(): Promise<PriceRow[]> {
  return db
    .select({ provider: modelPrices.provider, model: modelPrices.model, ...priceColumns, updatedAt: modelPrices.updatedAt })
    .from(modelPrices)
    .orderBy(asc(modelPrices.provider), asc(modelPrices.model));
}

/** Adds a model or changes its prices, and records the change in the audit log. */
export async function savePrice(adminId: string, provider: string, model: string, price: Price): Promise<void> {
  await db.transaction(async (tx) => {
    const [before] = await tx.select(priceColumns).from(modelPrices).where(sameModel(provider, model));
    const values = { ...price, updatedBy: adminId, updatedAt: new Date() };
    await tx
      .insert(modelPrices)
      .values({ provider, model, ...values })
      .onConflictDoUpdate({ target: [modelPrices.provider, modelPrices.model], set: values });
    await recordAudit(
      {
        actorId: adminId,
        action: "price.changed",
        targetType: "model_price",
        targetId: `${provider}:${model}`,
        metadata: { before: before ?? null, after: price },
      },
      tx,
    );
  });
}

/** Removes a model's prices; calls to it then have no price. */
export async function removePrice(adminId: string, provider: string, model: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [removed] = await tx.delete(modelPrices).where(sameModel(provider, model)).returning(priceColumns);
    if (!removed) return;
    await recordAudit(
      {
        actorId: adminId,
        action: "price.removed",
        targetType: "model_price",
        targetId: `${provider}:${model}`,
        metadata: { before: removed },
      },
      tx,
    );
  });
}
