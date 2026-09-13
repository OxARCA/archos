import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/session", () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: "admin-1", role: "admin" } })),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { banUser: vi.fn(), unbanUser: vi.fn() } } }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/budget", () => ({ setBudget: vi.fn() }));
vi.mock("@/lib/prices", () => ({ savePrice: vi.fn(), removePrice: vi.fn() }));

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { setBudget } from "@/lib/budget";
import { removePrice, savePrice } from "@/lib/prices";
import {
  removePriceAction,
  saveBudgetAction,
  savePriceAction,
  setBannedAction,
  type BanState,
  type BudgetFormState,
  type PriceFormState,
} from "./actions";

const noError: BanState = { error: null };
const idle: BudgetFormState = { status: "idle", message: "" };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("setBannedAction", () => {
  it("bans a user and records which admin did it", async () => {
    const state = await setBannedAction(noError, form({ userId: "user-2", ban: "true" }));

    expect(state).toEqual({ error: null });
    expect(auth.api.banUser).toHaveBeenCalledWith(expect.objectContaining({ body: { userId: "user-2" } }));
    expect(auth.api.unbanUser).not.toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledWith({
      actorId: "admin-1",
      action: "user.banned",
      targetType: "user",
      targetId: "user-2",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("unbans a user", async () => {
    const state = await setBannedAction(noError, form({ userId: "user-2", ban: "false" }));

    expect(state).toEqual({ error: null });
    expect(auth.api.unbanUser).toHaveBeenCalledWith(expect.objectContaining({ body: { userId: "user-2" } }));
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "user.unbanned" }));
  });

  it("shows Better Auth's reason when it refuses, and records nothing", async () => {
    vi.mocked(auth.api.banUser).mockRejectedValueOnce(
      new APIError("BAD_REQUEST", { message: "You cannot ban yourself" }),
    );

    const state = await setBannedAction(noError, form({ userId: "admin-1", ban: "true" }));

    expect(state).toEqual({ error: "You cannot ban yourself" });
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("does nothing when no user is given", async () => {
    const state = await setBannedAction(noError, form({ ban: "true" }));

    expect(state).toEqual({ error: "No user selected." });
    expect(auth.api.banUser).not.toHaveBeenCalled();
  });
});

describe("saveBudgetAction", () => {
  it("saves caps entered in dollars", async () => {
    const state = await saveBudgetAction(idle, form({ userId: "user-2", monthlyCap: "20", perJobCap: "12.50" }));

    expect(setBudget).toHaveBeenCalledWith("admin-1", "user-2", {
      monthlyCapMicroUsd: 20_000_000,
      perJobCapMicroUsd: 12_500_000,
    });
    expect(state).toEqual({ status: "saved", message: "Saved. Monthly cap $20.00, per-job cap $12.50." });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users/user-2");
  });

  it("refuses amounts that aren't plain dollars", async () => {
    const state = await saveBudgetAction(idle, form({ userId: "user-2", monthlyCap: "-5", perJobCap: "10" }));

    expect(state.status).toBe("error");
    // Handed back so the form shows what was typed, not the old caps.
    expect(state.entered).toEqual({ monthlyCap: "-5", perJobCap: "10" });
    expect(setBudget).not.toHaveBeenCalled();
  });

  it("refuses caps above $10,000", async () => {
    const state = await saveBudgetAction(idle, form({ userId: "user-2", monthlyCap: "50000", perJobCap: "10" }));

    expect(state).toEqual({
      status: "error",
      message: "Caps above $10,000.00 aren't allowed here.",
      entered: { monthlyCap: "50000", perJobCap: "10" },
    });
    expect(setBudget).not.toHaveBeenCalled();
  });
});

describe("savePriceAction", () => {
  const idlePrice: PriceFormState = { status: "idle", message: "" };
  const gpt = {
    provider: "OpenAI",
    model: "gpt-5.6-sol",
    input: "5",
    output: "30",
    cacheRead: "0.5",
    cacheWrite5m: "6.25",
    cacheWrite1h: "",
    batchDiscountPercent: "50",
  };

  it("saves a model's prices, with a blank cache price as 0", async () => {
    const state = await savePriceAction(idlePrice, form(gpt));

    expect(savePrice).toHaveBeenCalledWith("admin-1", "openai", "gpt-5.6-sol", {
      input: 5,
      output: 30,
      cacheRead: 0.5,
      cacheWrite5m: 6.25,
      cacheWrite1h: 0,
      batchDiscountPercent: 50,
    });
    expect(state).toEqual({ status: "saved", message: "Saved openai gpt-5.6-sol." });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/prices");
  });

  it.each([
    [{ input: "" }, "US$ per million"],
    [{ output: "abc" }, "US$ per million"],
    [{ batchDiscountPercent: "150" }, "0 to 100"],
    [{ model: "gpt 5" }, "no spaces"],
    [{ provider: "Open AI" }, "lower case"],
  ])("refuses %o and keeps what was typed", async (change, text) => {
    const state = await savePriceAction(idlePrice, form({ ...gpt, ...change }));

    expect(state).toMatchObject({ status: "error", message: expect.stringContaining(text) });
    expect(state.entered).toMatchObject(change);
    expect(savePrice).not.toHaveBeenCalled();
  });
});

describe("removePriceAction", () => {
  it("removes a model's prices", async () => {
    await removePriceAction(form({ provider: "openai", model: "gpt-5.6-sol" }));

    expect(removePrice).toHaveBeenCalledWith("admin-1", "openai", "gpt-5.6-sol");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/prices");
  });
});
