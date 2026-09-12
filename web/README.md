# Archos web app

Next.js 16 front end for [Archos](https://oxarca.github.io/page/archos.html): sign-in, per-user
model keys, job submission and usage control. The Python pipeline runs separately as an engine
(see `../notes/01-architecture.md`).

## Status

- [x] Scaffold: Next.js 16 (App Router, TypeScript, Turbopack), Tailwind v4 with the OxARCA palette
- [x] Login: Better Auth with email + password, optional Google, roles (`admin`, `researcher`)
- [x] Database: Drizzle ORM over node-postgres; Neon on Vercel, embedded Postgres locally (`npm run db:local`)
- [x] Route protection (`proxy.ts`) and a server-side session layer (`lib/session.ts`)
- [x] Dashboard and a read-only admin user list
- [ ] Encrypted key vault (phase 1), jobs and engine integration (phase 2), budgets and admin controls (phase 3)

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
comma-separated. Whoever signs up with a listed email becomes an admin.

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

With both terminals running:

```bash
npm run test:smoke                  # HTTP checks: sign-up, roles, redirects, sign-out, sign-in
npm run typecheck && npm run lint
npm run db:studio                   # browse the user, session and account tables
```

The smoke test uses `admin@example.com` and `researcher@example.com` with the password
`correct-horse-battery`, so keep `admin@example.com` in `ADMIN_EMAILS`. It is safe to re-run.

**By hand in the browser**

1. Signed out, open `/dashboard`. You land on the sign-in page.
2. Create an account. The dashboard shows your role.
3. As a researcher, open `/admin`. You are sent back with "That page is for administrators only."
4. Sign out, then sign in with a wrong password. An error appears under the form.
5. Sign in with an `ADMIN_EMAILS` account. The Admin link appears and lists every user.

## Scripts

| Script | What it does |
|---|---|
| `npm run db:local` | local Postgres on port 5433, data in `.postgres/` |
| `npm run dev` | dev server |
| `npm run build` | runs migrations, then `next build` (what Vercel runs) |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm run auth:generate` | regenerate `db/schema.ts` from `lib/auth.ts` after changing auth plugins |
| `npm run db:generate` | write a new SQL migration into `drizzle/` from `db/schema.ts` |
| `npm run db:migrate` | apply migrations to `DATABASE_URL` |
| `npm run db:studio` | browse the database |
| `npm run test:smoke` | HTTP smoke test of login and route protection |

Schema workflow: edit `lib/auth.ts` or `db/schema.ts` → `npm run auth:generate` (auth tables only)
→ `npm run db:generate` → commit the new file in `drizzle/`.

## Deploy on Vercel

1. Import the repository; set **Root Directory** to `web`.
2. Storage → create **Neon** (London or Frankfurt); `DATABASE_URL` is injected.
3. Environment variables (mark secrets *Sensitive*): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
   `ADMIN_EMAILS`, optionally `ALLOWED_EMAIL_DOMAINS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
4. Deploy. The build script applies migrations before `next build`.

Full deployment notes: `../notes/04-tools-and-vercel-deployment.md`.

## Layout

```
app/                  routes (App Router)
  api/auth/[...all]/  Better Auth handler
  login/ signup/      auth pages
  dashboard/ admin/   protected pages
components/           UI primitives and auth forms
db/                   Drizzle client (db/index.ts) and schema (db/schema.ts, generated)
drizzle/              SQL migrations (committed)
lib/auth.ts           Better Auth server config
lib/auth-client.ts    Better Auth React client
lib/session.ts        session helpers for server components and actions
proxy.ts              optimistic route protection
```
