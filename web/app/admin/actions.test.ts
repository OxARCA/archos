import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/session", () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: "admin-1", role: "admin" } })),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { banUser: vi.fn(), unbanUser: vi.fn() } } }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { setBannedAction, type BanState } from "./actions";

const noError: BanState = { error: null };

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
