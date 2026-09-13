import { describe, expect, it, vi } from "vitest";

// One deployment answers on all of these; values are illustrative.
const VERCEL_HOSTS = {
  VERCEL_URL: "archos-abc123-oxarca.vercel.app",
  VERCEL_BRANCH_URL: "archos-git-main-oxarca.vercel.app",
  VERCEL_PROJECT_PRODUCTION_URL: "archos.vercel.app",
};

/** Imports lib/auth.ts afresh, so it reads `env` at load time. */
async function loadAuthModule(env: Record<string, string>) {
  vi.resetModules();
  // Better Auth switches its origin check off when it detects a test run
  // (NODE_ENV=test or TEST set), which Vitest does; load it as in development.
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("TEST", "");
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return import("./auth");
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
    const { auth } = await loadAuthModule({ ...VERCEL_HOSTS, BETTER_AUTH_URL: "https://archos.vercel.app" });

    for (const host of Object.values(VERCEL_HOSTS)) {
      const response = await auth.handler(signInFrom(`https://${host}`));
      // Past the origin check the sign-in fails (there is no such user), but not with 403.
      expect(response.status, host).not.toBe(403);
    }
  });

  it("rejects sign-in from any other site", async () => {
    const { auth } = await loadAuthModule(VERCEL_HOSTS);
    const response = await auth.handler(signInFrom("https://evil.example.com"));
    expect(response.status).toBe(403);
  });
});

describe("who may sign up", () => {
  it("with open registration off, admits only admins and invited addresses, even at allowed domains", async () => {
    const { roleForNewAccount, signUpPolicy } = await loadAuthModule({
      ADMIN_EMAILS: "Boss@Example.com",
      ALLOWED_EMAILS: "guest@example.com, colleague@ox.ac.uk",
      // Ignored while open registration is off.
      ALLOWED_EMAIL_DOMAINS: "ox.ac.uk",
    });

    expect(signUpPolicy.open).toBe(false);
    expect(roleForNewAccount("boss@example.com")).toBe("admin");
    expect(roleForNewAccount(" Guest@Example.com ")).toBe("researcher");
    expect(roleForNewAccount("colleague@ox.ac.uk")).toBe("researcher");
    expect(roleForNewAccount("someone.else@ox.ac.uk")).toBeNull();
    expect(roleForNewAccount("stranger@example.com")).toBeNull();
  });

  it("admits only admins when nobody is invited", async () => {
    const { roleForNewAccount } = await loadAuthModule({ ADMIN_EMAILS: "boss@example.com", ALLOWED_EMAILS: "" });

    expect(roleForNewAccount("boss@example.com")).toBe("admin");
    expect(roleForNewAccount("anyone@example.com")).toBeNull();
  });

  it("stays closed unless OPEN_REGISTRATION is true", async () => {
    for (const value of ["", "false", "yes", "1"]) {
      const { signUpPolicy } = await loadAuthModule({ OPEN_REGISTRATION: value });
      expect(signUpPolicy.open, `OPEN_REGISTRATION=${value}`).toBe(false);
    }
  });

  it("with open registration, also admits anyone at an allowed domain or its subdomains", async () => {
    const { roleForNewAccount, signUpPolicy } = await loadAuthModule({
      OPEN_REGISTRATION: "true",
      ALLOWED_EMAIL_DOMAINS: "ox.ac.uk, @cam.ac.uk",
      ALLOWED_EMAILS: "guest@example.com",
    });

    expect(signUpPolicy).toEqual({ open: true, domains: ["ox.ac.uk", "cam.ac.uk"] });
    expect(roleForNewAccount("someone@ox.ac.uk")).toBe("researcher");
    expect(roleForNewAccount("someone@history.ox.ac.uk")).toBe("researcher");
    expect(roleForNewAccount("someone@cam.ac.uk")).toBe("researcher");
    expect(roleForNewAccount("someone@evilox.ac.uk")).toBeNull();
    expect(roleForNewAccount("someone@ox.ac.uk.evil.com")).toBeNull();
    expect(roleForNewAccount("guest@example.com")).toBe("researcher");
    expect(roleForNewAccount("stranger@example.com")).toBeNull();
  });

  it("never opens sign-up to everyone: with no domains listed it stays invitation-only", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { roleForNewAccount, signUpPolicy } = await loadAuthModule({
      OPEN_REGISTRATION: "true",
      ALLOWED_EMAIL_DOMAINS: "",
      ALLOWED_EMAILS: "guest@example.com",
    });

    expect(signUpPolicy.open).toBe(false);
    expect(roleForNewAccount("anyone@anywhere.org")).toBeNull();
    expect(roleForNewAccount("guest@example.com")).toBe("researcher");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ALLOWED_EMAIL_DOMAINS is empty"));
    warn.mockRestore();
  });
});
