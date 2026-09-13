"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { setBudget } from "@/lib/budget";
import { formatUsd, MICRO_PER_USD, parseRate, parseUsd } from "@/lib/money";
import { removePrice, savePrice } from "@/lib/prices";
import { requireAdmin } from "@/lib/session";

export type BanState = { error: string | null };

/**
 * Bans or unbans a user. Better Auth refuses self-bans and signs a banned
 * user out of every session.
 */
export async function setBannedAction(_prev: BanState, formData: FormData): Promise<BanState> {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const ban = formData.get("ban") === "true";
  if (!userId) return { error: "No user selected." };

  try {
    const request = { body: { userId }, headers: await headers() };
    if (ban) await auth.api.banUser(request);
    else await auth.api.unbanUser(request);
  } catch (error) {
    return { error: error instanceof APIError ? error.message : "That didn't work. Try again." };
  }

  await recordAudit({
    actorId: session.user.id,
    action: ban ? "user.banned" : "user.unbanned",
    targetType: "user",
    targetId: userId,
  });
  revalidatePath("/admin");
  return { error: null };
}

export type BudgetFormState = {
  status: "idle" | "saved" | "error";
  message: string;
  // What was typed, so a refused entry stays in the fields (React resets the form after every action).
  entered?: { monthlyCap: string; perJobCap: string };
};

// A guard against typos such as an extra zero.
const MAX_CAP_MICRO_USD = 10_000 * MICRO_PER_USD;

/** Sets a user's monthly and per-job caps, entered in dollars. */
export async function saveBudgetAction(_prev: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const entered = {
    monthlyCap: String(formData.get("monthlyCap") ?? ""),
    perJobCap: String(formData.get("perJobCap") ?? ""),
  };
  const monthly = parseUsd(entered.monthlyCap);
  const perJob = parseUsd(entered.perJobCap);

  if (!userId) return { status: "error", message: "No user selected." };
  if (monthly === null || perJob === null) {
    return { status: "error", message: "Enter each cap in dollars, like 20 or 12.50.", entered };
  }
  if (monthly > MAX_CAP_MICRO_USD || perJob > MAX_CAP_MICRO_USD) {
    return { status: "error", message: `Caps above ${formatUsd(MAX_CAP_MICRO_USD)} aren't allowed here.`, entered };
  }

  await setBudget(session.user.id, userId, { monthlyCapMicroUsd: monthly, perJobCapMicroUsd: perJob });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin");
  return {
    status: "saved",
    message: `Saved. Monthly cap ${formatUsd(monthly)}, per-job cap ${formatUsd(perJob)}.`,
  };
}

export type PriceFormState = {
  status: "idle" | "saved" | "error";
  message: string;
  // What was typed, so a refused entry stays in the fields.
  entered?: Record<string, string>;
};

const RATE_FIELDS = ["input", "output", "cacheRead", "cacheWrite5m", "cacheWrite1h"] as const;

/** Adds a model's prices or changes them. Prices are US$ per million tokens. */
export async function savePriceAction(_prev: PriceFormState, formData: FormData): Promise<PriceFormState> {
  const session = await requireAdmin();
  const entered = Object.fromEntries(
    ["provider", "model", ...RATE_FIELDS, "batchDiscountPercent"].map((name) => [
      name,
      String(formData.get(name) ?? "").trim(),
    ]),
  );
  const fail = (message: string): PriceFormState => ({ status: "error", message, entered });

  const provider = entered.provider.toLowerCase();
  const { model } = entered;
  if (!/^[a-z0-9-]{1,40}$/.test(provider)) return fail("Enter the provider in lower case, like openai.");
  if (!/^[\w.:/-]{1,100}$/.test(model)) {
    return fail("Enter the model ID exactly as the engine reports it, with no spaces.");
  }

  // Cache prices may be left blank when a model doesn't charge for them.
  const rates = RATE_FIELDS.map((name) =>
    entered[name] === "" && name.startsWith("cache") ? 0 : parseRate(entered[name]),
  );
  if (rates.some((rate) => rate === null)) {
    return fail("Enter each price in US$ per million tokens, like 5 or 0.075.");
  }
  if (!/^\d{1,3}$/.test(entered.batchDiscountPercent) || Number(entered.batchDiscountPercent) > 100) {
    return fail("The batch discount is a whole percent from 0 to 100.");
  }

  const [input, output, cacheRead, cacheWrite5m, cacheWrite1h] = rates as number[];
  await savePrice(session.user.id, provider, model, {
    input,
    output,
    cacheRead,
    cacheWrite5m,
    cacheWrite1h,
    batchDiscountPercent: Number(entered.batchDiscountPercent),
  });
  revalidatePath("/admin/prices");
  return { status: "saved", message: `Saved ${provider} ${model}.` };
}

export async function removePriceAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const provider = String(formData.get("provider") ?? "");
  const model = String(formData.get("model") ?? "");
  if (!provider || !model) return;

  await removePrice(session.user.id, provider, model);
  revalidatePath("/admin/prices");
}
