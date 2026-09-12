import { describe, expect, it, vi } from "vitest";

// One deployment answers on all of these; values are illustrative.
const VERCEL_HOSTS = {
  VERCEL_URL: "archos-abc123-oxarca.vercel.app",
  VERCEL_BRANCH_URL: "archos-git-main-oxarca.vercel.app",
  VERCEL_PROJECT_PRODUCTION_URL: "archos.vercel.app",
};

async function loadAuth(env: Record<string, string>) {
  vi.resetModules();
  // Better Auth switches its origin check off when it detects a test run
  // (NODE_ENV=test or TEST set), which Vitest does; load it as in development.
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("TEST", "");
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return (await import("./auth")).auth;
}

function signInFrom(origin: string) {
  return new Request("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email: "nobody@example.com", password: "not-the-password" }),
  });
}

describe("trusted origins", () => {
  it("accepts sign-in from every Vercel address of the deployment", async () => {
    const auth = await loadAuth({ ...VERCEL_HOSTS, BETTER_AUTH_URL: "https://archos.vercel.app" });

    for (const host of Object.values(VERCEL_HOSTS)) {
      const response = await auth.handler(signInFrom(`https://${host}`));
      // Past the origin check the lookup fails (no database here), but not with 403.
      expect(response.status, host).not.toBe(403);
    }
  });

  it("rejects sign-in from any other site", async () => {
    const auth = await loadAuth(VERCEL_HOSTS);
    const response = await auth.handler(signInFrom("https://evil.example.com"));
    expect(response.status).toBe(403);
  });
});
