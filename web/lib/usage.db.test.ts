// Runs against the throwaway Postgres started by test/global-setup.ts.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { auditLog, usageEvents } from "@/db/app-schema";
import { user } from "@/db/schema";
import { budgetStatus, setBudget } from "./budget";
import { savePrice, type TokenUsage } from "./prices";
import { recordUsage, usageByModelThisMonth } from "./usage";

const none: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWrite5mTokens: 0,
  cacheWrite1hTokens: 0,
};
const TEN_DOLLARS = 10_000_000;

async function newUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({ id, name: "Test", email: `${id}@example.com` });
  return id;
}

async function userWithCap(capMicroUsd: number): Promise<string> {
  const [userId, adminId] = await Promise.all([newUser(), newUser()]);
  await setBudget(adminId, userId, { monthlyCapMicroUsd: capMicroUsd, perJobCapMicroUsd: 25_000_000 });
  return userId;
}

/** 1M input and 100k output tokens on Claude Opus 5: $5 + $2.50. */
function opusCall(userId: string, usage: Partial<TokenUsage> = { inputTokens: 1_000_000, outputTokens: 100_000 }, eventId = randomUUID()) {
  return recordUsage({ eventId, userId, provider: "anthropic", model: "claude-opus-5", usage: { ...none, ...usage } });
}

describe("recordUsage", () => {
  it("records each call once, however often it is reported", async () => {
    const userId = await newUser();
    const eventId = randomUUID();

    expect((await opusCall(userId, undefined, eventId)).recorded).toBe(true);
    expect((await opusCall(userId, undefined, eventId)).recorded).toBe(false);
    expect(await db.select().from(usageEvents).where(eq(usageEvents.userId, userId))).toHaveLength(1);
  });

  it("works out and stores the cost when the call is recorded", async () => {
    const userId = await newUser();

    expect((await opusCall(userId)).costMicroUsd).toBe(7_500_000);
    const [row] = await db.select().from(usageEvents).where(eq(usageEvents.userId, userId));
    expect(row.costMicroUsd).toBe(7_500_000);
  });

  it("reports what is left of the monthly cap, never below zero", async () => {
    const userId = await userWithCap(TEN_DOLLARS);

    expect((await opusCall(userId)).remainingMicroUsd).toBe(2_500_000);
    expect((await opusCall(userId)).remainingMicroUsd).toBe(0);
    expect(await budgetStatus(userId)).toMatchObject({ spentMicroUsd: 15_000_000, remainingMicroUsd: 0 });
  });

  it("counts only this month's calls against the cap", async () => {
    const userId = await userWithCap(TEN_DOLLARS);
    const lastMonth = new Date();
    lastMonth.setUTCDate(0);
    await db.insert(usageEvents).values({
      id: randomUUID(),
      userId,
      provider: "anthropic",
      model: "claude-opus-5",
      costMicroUsd: 9_000_000,
      createdAt: lastMonth,
    });

    expect(await budgetStatus(userId)).toMatchObject({ spentMicroUsd: 0, remainingMicroUsd: TEN_DOLLARS });
  });

  it("leaves no budget after a call to a model without a price, and flags it", async () => {
    const userId = await userWithCap(TEN_DOLLARS);
    const result = await recordUsage({
      eventId: randomUUID(),
      userId,
      provider: "openai",
      model: "not-priced",
      usage: { ...none, inputTokens: 500 },
    });

    expect(result).toEqual({ recorded: true, costMicroUsd: null, remainingMicroUsd: 0 });
    expect(await usageByModelThisMonth(userId)).toEqual([
      expect.objectContaining({ model: "not-priced", calls: 1, unpricedCalls: 1, costMicroUsd: 0 }),
    ]);
  });

  it("charges batch calls at the model's batch discount, and marks them", async () => {
    const userId = await newUser();
    const result = await recordUsage({
      eventId: randomUUID(),
      userId,
      provider: "anthropic",
      model: "claude-opus-5",
      batch: true,
      usage: { ...none, inputTokens: 1_000_000, outputTokens: 100_000 },
    });

    expect(result.costMicroUsd).toBe(3_750_000);
    const [row] = await db.select().from(usageEvents).where(eq(usageEvents.userId, userId));
    expect(row.batch).toBe(true);
  });

  it("prices a model from the next call once an admin adds it", async () => {
    const userId = await userWithCap(TEN_DOLLARS);
    const adminId = await newUser();
    const model = `new-model-${randomUUID()}`;
    const call = () =>
      recordUsage({ eventId: randomUUID(), userId, provider: "openai", model, usage: { ...none, inputTokens: 1_000_000 } });

    expect((await call()).costMicroUsd).toBeNull();
    await savePrice(adminId, "openai", model, {
      input: 1,
      output: 6,
      cacheRead: 0.1,
      cacheWrite5m: 0,
      cacheWrite1h: 0,
      batchDiscountPercent: 50,
    });
    expect(await call()).toMatchObject({ costMicroUsd: 1_000_000, remainingMicroUsd: 9_000_000 });
  });

  it("refuses negative or fractional token counts", async () => {
    const userId = await newUser();
    await expect(opusCall(userId, { inputTokens: -1 })).rejects.toThrow("inputTokens");
    await expect(opusCall(userId, { outputTokens: 1.5 })).rejects.toThrow("outputTokens");
  });
});

describe("budgets", () => {
  it("give a user with no budget a cap of zero", async () => {
    const userId = await newUser();
    expect(await budgetStatus(userId)).toMatchObject({ monthlyCapMicroUsd: 0, remainingMicroUsd: 0 });
  });

  it("record every change in the audit log, with the old and new caps", async () => {
    const [userId, adminId] = await Promise.all([newUser(), newUser()]);
    await setBudget(adminId, userId, { monthlyCapMicroUsd: 5_000_000, perJobCapMicroUsd: 1_000_000 });
    await setBudget(adminId, userId, { monthlyCapMicroUsd: 20_000_000, perJobCapMicroUsd: 1_000_000 });

    const entries = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "budget.changed"), eq(auditLog.targetId, userId)));
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.actorId === adminId)).toBe(true);
    expect(entries.map((e) => e.metadata)).toContainEqual({
      before: { monthlyCapMicroUsd: 5_000_000, perJobCapMicroUsd: 1_000_000 },
      after: { monthlyCapMicroUsd: 20_000_000, perJobCapMicroUsd: 1_000_000 },
    });
  });

  it("never let anyone spend past the team cap", async () => {
    const userId = await userWithCap(TEN_DOLLARS);
    await opusCall(userId); // $7.50 of their $10, and at least that much for the team

    vi.stubEnv("TEAM_MONTHLY_USD_CAP", "5");
    expect((await budgetStatus(userId)).remainingMicroUsd).toBe(0);

    vi.stubEnv("TEAM_MONTHLY_USD_CAP", "100000");
    expect((await budgetStatus(userId)).remainingMicroUsd).toBe(2_500_000);
  });
});
