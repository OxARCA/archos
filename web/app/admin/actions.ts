"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { setBudget } from "@/lib/budget";
import { formatUsd, MICRO_PER_USD, parseUsd } from "@/lib/money";
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
