"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
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
