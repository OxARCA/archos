# Archos web app

Next.js 16 front end for [Archos](https://oxarca.github.io/page/archos.html): sign-in, per-user
model keys, job submission and usage control. The Python pipeline runs separately as an engine
(see `../notes/01-architecture.md`).

## Status

- [x] Scaffold: Next.js 16 (App Router, TypeScript, Turbopack), Tailwind v4 with the OxARCA palette
- [x] Login: Better Auth with email + password, roles (`admin`, `researcher`),
  sign-up by invitation (`ADMIN_EMAILS`, `ALLOWED_EMAILS`), optional open registration by domain
  (`OPEN_REGISTRATION`, `ALLOWED_EMAIL_DOMAINS`; off by default)
- [x] Database: Drizzle ORM over node-postgres; Neon on Vercel, embedded Postgres locally (`npm run db:local`)
- [x] Route protection (`proxy.ts`) and a server-side session layer (`lib/session.ts`)
- [x] Dashboard, and an admin user list with ban and unban
- [x] Audit log of admin actions (`audit_log` table)
- [x] Unit tests with Vitest (`npm test`)
- [x] Budgets and usage tracking: per-user monthly caps in dollars (set on `/admin/users/[id]`), a
  usage ledger, `/usage` for each person, model prices (with batch discounts) edited on `/admin/prices`
- [ ] Jobs and engine integration, including the signed endpoint where the engine reports usage

The pilot runs on one OxARCA team key held by the engine, with per-user dollar caps. A per-user
API key vault was built and is shelved on the `key-vault` branch.

## Run locally

Needs Node 20.9 or newer. No Docker and no cloud account: `npm run db:local` runs real
Postgres binaries that npm installs.

**One-time setup**

```bash
cd web
npm install
cp .env.example .env.local
sed -i "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(openssl rand -base64 32)|" .env.local
```

Then edit `ADMIN_EMAILS` in `.env.local`: add your own email after `admin@example.com`,
comma-separated. Whoever signs up with a listed email becomes an admin. Sign-up is by
invitation: only addresses in `ADMIN_EMAILS` or `ALLOWED_EMAILS` can create an account.
`OPEN_REGISTRATION=true` also lets anyone at `ALLOWED_EMAIL_DOMAINS` sign up; it is off by default.

**Every time**

```bash
# terminal 1: the database; leave it running
npm run db:local

# terminal 2: the app
npm run db:migrate      # first run, and whenever drizzle/ gains a migration
npm run dev             # http://localhost:3000
```

Stop each with Ctrl+C. Data stays in `.postgres/`; delete that folder to start from an empty
database.

## Test

```bash
npm test                            # Vitest; starts its own throwaway Postgres, no server needed
npm run typecheck && npm run lint
```

With both terminals running:

```bash
npm run test:smoke                  # HTTP checks: sign-up, roles, redirects, sign-out, sign-in
npm run db:studio                   # browse the tables
```

The smoke test uses `admin@example.com` and `researcher@example.com` with the password
`correct-horse-battery`, so keep `admin@example.com` in `ADMIN_EMAILS` and
`researcher@example.com` in `ALLOWED_EMAILS`. It is safe to re-run.

**By hand in the browser**

1. Signed out, open `/dashboard`. You land on the sign-in page.
2. Create an account with an invited address (in `ADMIN_EMAILS` or `ALLOWED_EMAILS`). The
   dashboard shows your role. Any other address is refused.
3. As a researcher, open `/admin`. You are sent back with "That page is for administrators only."
4. Sign out, then sign in with a wrong password. An error appears under the form.
5. Sign in with an `ADMIN_EMAILS` account. The Admin link appears and lists every user.
6. As an admin, press **Ban** next to another user and confirm. They are signed out at once and
   cannot sign in until you press **Unban**.
7. As an admin, open a user and set their monthly cap. They see it, and what they have spent,
   on `/usage`.
8. As an admin, open **Model prices** on `/admin` to add a model or change its rates and batch
   discount. Changes apply from the next recorded call.

## Scripts

| Script | What it does |
|---|---|
| `npm run db:local` | local Postgres on port 5433, data in `.postgres/` |
| `npm run dev` | dev server |
| `npm run build` | runs migrations, then `next build` (what Vercel runs) |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm test` | unit tests (Vitest) |
| `npm run auth:generate` | regenerate `db/schema.ts` from `lib/auth.ts` after changing auth plugins |
| `npm run db:generate` | write a new SQL migration into `drizzle/` from `db/schema.ts` |
| `npm run db:migrate` | apply migrations to `DATABASE_URL` |
| `npm run db:studio` | browse the database |
| `npm run test:smoke` | HTTP smoke test of login and route protection |

Schema workflow: our tables live in `db/app-schema.ts`. Better Auth's are generated into
`db/schema.ts`, so never edit that file by hand; after changing auth plugins in `lib/auth.ts`, run
`npm run auth:generate`. Then run `npm run db:generate` and commit the new file in `drizzle/`.

## Deploy on Vercel

1. Import the repository; set **Root Directory** to `web`.
2. Storage → create **Neon** (London or Frankfurt); `DATABASE_URL` is injected.
3. Environment variables (mark secrets *Sensitive*): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
   `ADMIN_EMAILS`, `ALLOWED_EMAILS` (everyone else who may sign up), and optionally
   `OPEN_REGISTRATION` with `ALLOWED_EMAIL_DOMAINS` (leave unset to keep it off) and
   `TEAM_MONTHLY_USD_CAP` (team-wide monthly limit).
4. Deploy. The build script applies migrations before `next build`.

Full deployment notes: `../notes/04-tools-and-vercel-deployment.md`.

## Layout

```
app/                  routes (App Router)
  api/auth/[...all]/  Better Auth handler
  login/ signup/      auth pages
  dashboard/ admin/   protected pages; admin/actions.ts bans and unbans
components/           UI primitives, auth forms, admin controls
db/                   Drizzle client (index.ts), Better Auth tables (schema.ts, generated), ours (app-schema.ts)
drizzle/              SQL migrations (committed)
lib/auth.ts           Better Auth server config
lib/auth-client.ts    Better Auth React client
lib/session.ts        session helpers for server components and actions
lib/audit.ts          writes audit_log entries
lib/prices.ts         model prices (model_prices table) and what a call costs
lib/budget.ts         caps, spend this month, what is left
lib/usage.ts          the usage ledger: record a model call, summaries
lib/money.ts          dollars ↔ micro-dollars
proxy.ts              optimistic route protection
test/                 Vitest helpers (tests sit next to the code as *.test.ts)
```
