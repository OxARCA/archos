import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({
  getSession: vi.fn(async () => ({ user: { id: "user-1" } })),
  requireSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/provider-keys", () => ({ saveProviderKey: vi.fn(), removeProviderKey: vi.fn() }));

import { saveProviderKey } from "@/lib/provider-keys";
import { getSession } from "@/lib/session";
import { saveKeyAction, type SaveKeyState } from "./actions";

const KEY = "sk-proj-test-secret-5678";
const idle: SaveKeyState = { status: "idle", message: "" };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("saveKeyAction", () => {
  it("never sends the key back to the browser after a save", async () => {
    vi.mocked(saveProviderKey).mockResolvedValueOnce({
      ok: true,
      replaced: false,
      key: { provider: "openai", last4: "5678", validatedAt: new Date(), createdAt: new Date() },
    });

    const state = await saveKeyAction(idle, form({ provider: "openai", apiKey: KEY }));

    expect(saveProviderKey).toHaveBeenCalledWith("user-1", "openai", KEY);
    expect(state).toEqual({ status: "saved", message: "Saved. Archos will use your OpenAI key ending 5678." });
    expect(JSON.stringify(state)).not.toContain(KEY);
  });

  it("never sends the key back when the save fails", async () => {
    vi.mocked(saveProviderKey).mockResolvedValueOnce({ ok: false, message: "OpenAI didn't accept this key." });

    const state = await saveKeyAction(idle, form({ provider: "openai", apiKey: KEY }));

    expect(state.status).toBe("error");
    expect(JSON.stringify(state)).not.toContain(KEY);
  });

  it("rejects an unknown provider before touching the vault", async () => {
    const state = await saveKeyAction(idle, form({ provider: "gemini", apiKey: KEY }));
    expect(state).toEqual({ status: "error", message: "Unknown provider." });
    expect(saveProviderKey).not.toHaveBeenCalled();
  });

  it("asks the user to sign in again when the session has ended", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const state = await saveKeyAction(idle, form({ provider: "openai", apiKey: KEY }));
    expect(state.status).toBe("error");
    expect(saveProviderKey).not.toHaveBeenCalled();
  });
});
