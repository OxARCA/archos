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
const allowedDomains = csv(process.env.ALLOWED_EMAIL_DOMAINS);

function baseURL(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const ROLES = ["admin", "researcher"] as const;
export type Role = (typeof ROLES)[number];

export const auth = betterAuth({
  appName: "Archos",
  baseURL: baseURL(),
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
          const email = user.email.toLowerCase();
          const domain = email.split("@")[1] ?? "";

          if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
            throw new APIError("FORBIDDEN", {
              message:
                "Sign-up is limited to invited institutions. Contact the OxARCA team for access.",
            });
          }

          const role: Role = adminEmails.includes(email) ? "admin" : "researcher";
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
