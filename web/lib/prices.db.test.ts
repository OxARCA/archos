// Runs against the throwaway Postgres started by test/global-setup.ts.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLog } from "@/db/app-schema";
import { user } from "@/db/schema";
import { getPrice, listPrices, removePrice, savePrice, type Price } from "./prices";

const price: Price = {
  input: 2.5,
  output: 15,
  cacheRead: 0.25,
  cacheWrite5m: 3.125,
  cacheWrite1h: 0,
  batchDiscountPercent: 50,
};

async function newAdmin(): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({ id, name: "Admin", email: `${id}@example.com`, role: "admin" });
  return id;
}

describe("model prices", () => {
  it("start with the three Claude models", async () => {
    expect(await getPrice("anthropic", "claude-opus-5")).toEqual({
      input: 5,
      output: 25,
      cacheRead: 0.5,
      cacheWrite5m: 6.25,
      cacheWrite1h: 10,
      batchDiscountPercent: 50,
    });
    expect((await listPrices()).map((p) => `${p.provider}:${p.model}`)).toEqual(
      expect.arrayContaining(["anthropic:claude-opus-5", "anthropic:claude-sonnet-5", "anthropic:claude-haiku-4-5"]),
    );
  });

  it("can be added, changed and removed, with every change in the audit log", async () => {
    const adminId = await newAdmin();
    const model = `test-model-${randomUUID()}`;
    expect(await getPrice("openai", model)).toBeUndefined();

    await savePrice(adminId, "openai", model, price);
    expect(await getPrice("openai", model)).toEqual(price);

    await savePrice(adminId, "openai", model, { ...price, output: 12 });
    expect((await getPrice("openai", model))?.output).toBe(12);

    await removePrice(adminId, "openai", model);
    expect(await getPrice("openai", model)).toBeUndefined();

    const entries = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.targetType, "model_price"), eq(auditLog.targetId, `openai:${model}`)));
    expect(entries.map((e) => e.action).sort()).toEqual(["price.changed", "price.changed", "price.removed"]);
    expect(entries.every((e) => e.actorId === adminId)).toBe(true);
  });
});
