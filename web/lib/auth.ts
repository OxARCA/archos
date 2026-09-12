// Server-only module: never import from client components (kept free of the
// `server-only` guard so the Better Auth and drizzle CLIs can load it in plain Node).
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db, schema } from "@/db";

/** Comma-separated env var → lower-cased, trimmed list. */
function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const adminEmails = csv(process.env.ADMIN_EMAILS);
// Sign-up is by invitation: admins and these addresses may create an account.
const invitedEmails = csv(process.env.ALLOWED_EMAILS);
// Open registration (off unless OPEN_REGISTRATION=true) also admits anyone at these
// domains or their subdomains. It never opens sign-up to everyone: with no domain
// listed it admits nobody extra.
const openDomains = csv(process.env.ALLOWED_EMAIL_DOMAINS).map((d) => d.replace(/^@/, ""));
const openRegistrationRequested = process.env.OPEN_REGISTRATION?.trim().toLowerCase() === "true";
const registrationOpen = openRegistrationRequested && openDomains.length > 0;
if (openRegistrationRequested && !registrationOpen) {
  console.warn(
    "[auth] OPEN_REGISTRATION is true but ALLOWED_EMAIL_DOMAINS is empty, so sign-up stays invitation-only.",
  );
}

function baseURL(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Vercel serves each deployment at several addresses: its own URL, its branch
 * URL and the project's production domain. Better Auth refuses sign-ins from
 * any origin it doesn't trust, so list them all. Empty outside Vercel.
 */
function vercelOrigins(): string[] {
  return [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter((host): host is string => Boolean(host))
    .map((host) => `https://${host}`);
}

const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const ROLES = ["admin", "researcher"] as const;
export type Role = (typeof ROLES)[number];

/** How sign-up works right now; the sign-up page uses it to explain itself. */
export const signUpPolicy: { open: boolean; domains: readonly string[] } = {
  open: registrationOpen,
  domains: openDomains,
};

function atOpenDomain(address: string): boolean {
  const domain = address.split("@")[1] ?? "";
  return openDomains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** The role for a new account, or null when the address may not sign up. */
export function roleForNewAccount(email: string): Role | null {
  const address = email.trim().toLowerCase();
  if (adminEmails.includes(address)) return "admin";
  if (invitedEmails.includes(address)) return "researcher";
  if (registrationOpen && atOpenDomain(address)) return "researcher";
  return null;
}

export const auth = betterAuth({
  appName: "Archos",
  baseURL: baseURL(),
  trustedOrigins: vercelOrigins(),
  database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    // TODO(phase 1): switch on once Resend is wired up; see notes/02-auth-and-api-keys.md
    requireEmailVerification: false,
  },

  socialProviders: googleConfigured
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},

  databaseHooks: {
    user: {
      create: {
        // Runs for every new account, whatever the sign-up method.
        before: async (user) => {
          const role = roleForNewAccount(user.email);
          if (!role) {
            throw new APIError("FORBIDDEN", {
              message: registrationOpen
                ? `Sign-up is open to addresses at ${openDomains.join(", ")}. For another address, ask the OxARCA team to invite you.`
                : "Sign-up is by invitation only. Ask the OxARCA team to add your email address.",
            });
          }
          return { data: { ...user, role } };
        },
      },
    },
  },

  plugins: [
    admin({ defaultRole: "researcher", adminRoles: ["admin"] }),
    // Must stay last: lets server actions set auth cookies.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];

/** True when Google sign-in is configured; used by the UI to show the button. */
export const authProviders = { google: googleConfigured } as const;
