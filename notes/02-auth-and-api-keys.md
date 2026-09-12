# 02 — Login and the API key vault

## Authentication: Better Auth

**Why Better Auth.** It runs inside the Next.js app and stores users and sessions in our own Postgres, so there is no third-party user database, no per-user pricing, and the admin features we need (roles, ban, list users, impersonate) come from a first-party plugin. Auth.js (formerly NextAuth) has been maintained by the Better Auth team since September 2025, and their guidance for new projects is to start on Better Auth. Clerk would be quicker for the first login screen but adds a vendor, a monthly bill, and a second source of truth for users.

**Methods for the pilot**

| Method | Status | Notes |
|---|---|---|
| Email + password with verification | v1 | Resend sends the verification email |
| Google | v1 | Most collaborators have a Google identity; costs nothing |
| Magic link | v1, optional | Better Auth plugin; nice for non-technical historians |
| Microsoft (Oxford SSO) | later | Oxford's SSO is Microsoft Entra; Better Auth has a `microsoft` provider. Needs an app registration from Oxford IT |
| Passkeys / 2FA | later | plugins exist; enable 2FA for admins first |

**Sign-up policy.** For the pilot, keep sign-up closed: admins create accounts with the admin plugin's `createUser`, or open sign-up but gate it with an allowlist in a `databaseHooks.user.create.before` hook (for example, `@ox.ac.uk` plus named collaborators). Every new user starts with role `researcher`, `budgets.monthly_usd_cap = 0`, and no key, so a fresh account cannot spend anything until an admin sets a budget.

**Config sketch**

```ts
// lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  socialProviders: {
    google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! },
  },
  plugins: [admin({ defaultRole: "researcher" }), nextCookies()],
  // rate limiting is on by default; tune per route if needed
});
```

```ts
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
export const { GET, POST } = toNextJsHandler(auth);
```

```ts
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
export const authClient = createAuthClient({ plugins: [adminClient()] });
```

**Route protection.** Next.js 16 replaced `middleware.ts` with `proxy.ts`. Use `getSessionCookie()` there for an optimistic redirect to `/login`, then call `auth.api.getSession({ headers })` in every protected page and handler. The proxy check is a convenience; the server-side check is the security boundary.

**Roles.** Two roles for v1: `admin` and `researcher`. Use the admin plugin's access-control builder if a third role appears (for example `curator` who can upload collections but not run jobs).

## The key vault

### Requirements

1. A user's key is usable by the server (to run jobs) but never visible to anyone, including the user, after it is saved.
2. A leaked database dump must not expose keys.
3. A leaked environment variable must not expose keys on its own.
4. Keys are never sent to the browser, never logged, never in URLs.
5. Keys can be rotated (ours) and revoked (the user's) without downtime.
6. The engine sees a key only for the job it is running.

### Design: AES-256-GCM with a versioned master key

- **Master key (KEK)**: 32 random bytes, base64, stored in Vercel as `KEY_ENCRYPTION_KEY_V1` and marked **Sensitive** so it cannot be read back from the dashboard once set. Generate it with `openssl rand -base64 32` on a trusted machine and never paste it anywhere else.
- **Per-record**: a fresh 12-byte IV, the ciphertext, the 16-byte GCM tag, and `key_version`.
- **Additional authenticated data (AAD)** binds the ciphertext to `userId:provider`. A ciphertext copied into another user's row fails to decrypt. This is the detail most "encrypt the API key" tutorials skip.
- **Node's built-in `crypto`** does all of it. No extra dependency.

```ts
// lib/vault.ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEYS: Record<number, Buffer> = {
  1: Buffer.from(process.env.KEY_ENCRYPTION_KEY_V1!, "base64"),
  // 2: Buffer.from(process.env.KEY_ENCRYPTION_KEY_V2!, "base64"),  // add during rotation
};
const CURRENT = 1;

export function encryptSecret(plaintext: string, aad: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEYS[CURRENT], iv);
  cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext, iv, tag: cipher.getAuthTag(), keyVersion: CURRENT };
}

export function decryptSecret(
  row: { ciphertext: Buffer; iv: Buffer; tag: Buffer; keyVersion: number },
  aad: string,
) {
  const decipher = createDecipheriv("aes-256-gcm", KEYS[row.keyVersion], row.iv);
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(row.tag);
  return Buffer.concat([decipher.update(row.ciphertext), decipher.final()]).toString("utf8");
}

export const aadFor = (userId: string, provider: "openai" | "anthropic") => `${userId}:${provider}`;
```

Mark `lib/vault.ts` with `import "server-only"` so it can never be bundled into client code.

### Flows

**Save a key** (`/keys`, server action)
1. Session check; the user may hold one active key per provider.
2. Validate the key with a free call that spends no tokens:
   - OpenAI: `GET https://api.openai.com/v1/models` with `Authorization: Bearer <key>`
   - Anthropic: `GET https://api.anthropic.com/v1/models` with `x-api-key: <key>` and `anthropic-version: 2023-06-01`
   A 401 means "this key does not work"; show that and do not save.
3. `encryptSecret(key, aadFor(userId, provider))` → insert row with `last4`, `validated_at`.
4. Audit log `key.saved`. Return only `{provider, last4, validatedAt}` to the client.

**Use a key** (`POST /api/jobs`)
1. Load the row, check `revoked_at IS NULL`.
2. Decrypt in the request handler, put the plaintext in the engine payload, and let it go out of scope. Do not put it on the job row, in a queue message, or in a log line.

**Revoke a key** (`/keys`)
1. Set `revoked_at`; running jobs keep the in-memory copy until they finish, and the UI says so.
2. Optionally overwrite `ciphertext` with zeros. Audit log `key.revoked`.

**Re-validate** (cron, weekly): decrypt, call the models endpoint, update `validated_at` or flag the key as `invalid` so the user is warned before their next job.

### Rotation procedure

1. Add `KEY_ENCRYPTION_KEY_V2` to Vercel, redeploy with `CURRENT = 2` and both keys in `KEYS`.
2. Run a one-off script: for every row with `key_version = 1`, decrypt with v1, encrypt with v2, update.
3. When no rows reference v1, remove the v1 variable.

No downtime; decryption always picks the right key by `key_version`.

### Threat model

| Threat | Outcome |
|---|---|
| Postgres dump leaks | Ciphertext, IV, tag only. Useless without the KEK |
| Vercel env vars leak | KEK only. Useless without the database |
| Both leak | Keys exposed. Mitigations: rotate immediately, notify users, and this is the case where a cloud KMS (below) helps because the KEK never leaves the HSM |
| XSS in the app | Keys never reach the browser, so nothing to steal beyond a session; Better Auth cookies are `HttpOnly` |
| Malicious or compromised engine | Sees keys for jobs it is running. Mitigation: proxy-auth on the endpoint, EU region, Modal secrets for its own credentials, and users can revoke at any time |
| Logs | A lint rule and a test that the submit payload is never logged; redact `api_key` in any error reporter (Sentry `beforeSend`) |
| Admin abuse | Admins can run jobs on behalf of users via impersonation, but cannot read keys. Every impersonation is in the audit log |

### Upgrade paths, if the pilot grows

- **Cloud KMS envelope encryption**: keep the same table, but wrap a per-user data key with AWS KMS or Google Cloud KMS instead of a static env var. Same code shape, one extra network call, and the master key becomes non-exportable.
- **Supabase Vault**: only relevant if the team switches Postgres to Supabase; it does the same thing inside the database.
- **Provider-side spend limits**: encourage users to set a monthly hard limit in their OpenAI or Anthropic console. Our budget is a second line, not the only one.

### What the user sees

The `/keys` page shows one card per provider: status (none / valid / invalid / revoked), `last4`, when it was last checked, and two buttons: *Replace* and *Remove*. The input for a new key is a password field, submitted through a server action, and the page never re-renders the value.
