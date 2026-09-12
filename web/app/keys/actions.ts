"use server";

import { revalidatePath } from "next/cache";
import { removeProviderKey, saveProviderKey } from "@/lib/provider-keys";
import { isProvider, PROVIDERS } from "@/lib/providers";
import { getSession, requireSession } from "@/lib/session";

/** Sent back to the browser, so it must never contain the key. */
export type SaveKeyState = { status: "idle" | "saved" | "error"; message: string };

export async function saveKeyAction(_prev: SaveKeyState, formData: FormData): Promise<SaveKeyState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Your session has ended. Sign in again." };

  const provider = formData.get("provider");
  if (!isProvider(provider)) return { status: "error", message: "Unknown provider." };

  const result = await saveProviderKey(session.user.id, provider, formData.get("apiKey"));
  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/keys");
  return {
    status: "saved",
    message: `Saved. Archos will use your ${PROVIDERS[provider].name} key ending ${result.key.last4}.`,
  };
}

export async function removeKeyAction(formData: FormData): Promise<void> {
  const session = await requireSession("/keys");
  const provider = formData.get("provider");
  if (!isProvider(provider)) return;

  await removeProviderKey(session.user.id, provider);
  revalidatePath("/keys");
}
