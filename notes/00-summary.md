# Archos web app — plan summary

*Written 2026-09-11. Companion notes: `01-architecture.md`, `02-auth-and-api-keys.md`, `03-usage-metering-and-admin.md`, `04-tools-and-vercel-deployment.md`, `05-roadmap.md`.*

## Where things stand today

- **oxarca.github.io** is a static academic site built with oxie (Python + Jinja2 + Tailwind v4). It has Home, Archos, People, Publications, Get involved, News and Awards pages. It describes Archos, the pipeline, and the epistemic constitution, and it shows one headline run: 261 sources, 1,688 citations, 85,789 words, about $12.70 of compute.
- **There is no user-facing application yet.** Collaborators are asked to email Sebastian with a collection and a research question; the team runs the pipeline by hand.
- **The GitHub org has one public repo** (the website). The Archos pipeline itself is private Python code.
- The `archos/` folder was empty when this was written (see the progress log at the end for what has been built since).

## What we are building (v1)

A web app where a historian can:

1. **Sign in** (email + password, Google; Oxford SSO later).
2. **Use the OxARCA team model key**, held by the engine, within a dollar cap an admin sets. (A per-user key vault was built and shelved; see the progress log.)
3. **Submit a research question plus a collection** and have Archos run it.
4. **Read the Evidence Report** in the browser and download it.
5. **See their own token and dollar usage**.

And where an admin (the OxARCA team) can:

6. **Manage users**: invite, set roles, ban.
7. **Set budgets** per user (monthly USD cap, per-job cap, concurrency) and watch spend live.
8. **See every job and every LLM call** in a ledger, with cost.

## Decisions at a glance

| Question | Decision | Why |
|---|---|---|
| Where does the UI and control plane run? | **Next.js 16 (App Router, TypeScript) on Vercel** | Best-supported framework on Vercel; mature auth and UI ecosystem; Tailwind v4 matches the existing site |
| Where does the Archos pipeline run? | **Separate Python "engine" on Modal** (or an Oxford VM with the same HTTP contract) | Vercel functions cap at 800 s on Pro (1,800 s beta). A real run takes far longer. Modal runs Python jobs up to 24 h and bills per second |
| Authentication | **Better Auth** with the admin plugin | Owns your user table in your Postgres; Auth.js is now maintained by the same team; admin plugin gives roles, ban, list users, impersonate for free |
| Database | **Neon Postgres via Vercel Marketplace**, Drizzle ORM | One-click provisioning, env vars injected, DB branching per preview deploy, EU/UK regions |
| Model key | **One OxARCA team key per provider, held in the engine's Modal secrets**; per-user caps in dollars (decided 2026-09-12) | Historians need no API account, and admins control each user's spend. A per-user AES-256-GCM key vault is built and shelved on branch `key-vault`, in case users later bring their own keys |
| Token control | **Own usage ledger in Postgres**, fed by both the web app and the engine; budgets enforced before and during a run | Provider-neutral, auditable, and works for user keys *and* a shared OxARCA key. Vercel AI Gateway is an optional add-on for observability |
| File storage | **Vercel Blob** for uploaded collections and generated reports | Same dashboard and billing; private access; large-file client uploads |
| Email | **Resend** | Verification and magic-link emails; generous free tier |

## The stack in one picture

```
Browser ──► Next.js 16 on Vercel ──────────────┐
             │  Better Auth (sessions, roles)   │
             │  Drizzle ──► Neon Postgres       │   Modal (Python)
             │  Audit log                       ├──► Archos engine ──► OpenAI / Anthropic
             │  Usage ledger + budgets          │        │ (team key, from Modal secrets)
             │  Vercel Blob (collections, reports) ◄─────┘ signed callbacks: progress, usage, result
             └─ Admin panel
```

## Rough running cost (verify current prices before budgeting)

| Item | Approximate cost |
|---|---|
| Vercel | Hobby is free but personal, non-commercial, and only its owner can deploy. Pro is $20 per developer seat per month with $20 of usage credit included; viewer seats are free. Prototype on Hobby, move to Pro before the pilot; see `04-tools-and-vercel-deployment.md` |
| Neon Postgres | Free plan: 0.5 GB storage and 100 compute-hours per project per month. Launch plan is pay-as-you-go with no monthly minimum |
| Modal | Starter plan: $0/month, $30 of free compute credit each month, then $0.0000131 per core-second and $0.00000222 per GiB-second. A 3-hour run on 2 cores and 4 GiB is about $0.38, so roughly 75 such runs a month fit in the free credit |
| Vercel Blob, Resend, domain | A few dollars a month |
| LLM tokens | Paid by OxARCA through the team key, capped per user. A headline run was ~$12.70 |

### Who bills whom

Three separate accounts, three separate bills. None of them flows through another.

| Bill | Paid by | For |
|---|---|---|
| Vercel (card on the team) | OxARCA | Pro seats; Neon, Blob, and any Marketplace add-ons appear on this same invoice |
| Modal (card on the workspace) | OxARCA | Engine compute, per second, after the free monthly credit. Modal runs containers on its own fleet rented from the major clouds, not on Vercel; the `region` you set decides where |
| OpenAI / Anthropic | OxARCA | Tokens, on the team key. Our ledger caps each user; a monthly limit set on the provider's project is the backstop |

## Reading order

1. `01-architecture.md` — components, job lifecycle, data model.
2. `02-auth-and-api-keys.md` — login and the key vault, with the threat model.
3. `03-usage-metering-and-admin.md` — the ledger, budgets, and the admin panel.
4. `04-tools-and-vercel-deployment.md` — every tool, every account, and the deploy steps.
5. `05-roadmap.md` — phases, acceptance criteria, open questions for the team.

## Progress log

- **2026-09-11 — Phase 0 and the login half of Phase 1 are built** in `web/`. Next.js 16 scaffold with the site palette; Better Auth (email + password, optional Google, `admin` / `researcher` roles, `ADMIN_EMAILS` bootstrap, `ALLOWED_EMAIL_DOMAINS` allowlist); Drizzle schema and first migration; `proxy.ts` route protection; dashboard and a read-only admin user list. Type-check, lint and production build pass. A 24-check HTTP smoke test (`npm run test:smoke`) and a browser walkthrough of the forms both pass locally.
  Decision taken: **local development runs real Postgres from npm** (`npm run db:local`, the embedded-postgres package, port 5433), so there is no Docker or account to set up. The app talks to Postgres through node-postgres (`pg`) both locally and on Vercel, where the pool is registered with `attachDatabasePool` for Fluid Compute. An in-process PGlite database was tried first and dropped, because Next spawns helper processes that each opened the same data directory.
  Not yet done from Phase 1: email verification via Resend, the encrypted key vault, and the `/keys` page.
- **2026-09-12 — Team key decided; admin ban and audit log built.** Decision: the pilot uses **one OxARCA team key**, held by the engine as a Modal secret, with **per-user caps in dollars** enforced by our usage ledger. The per-user key vault (AES-256-GCM, a `/keys` page, 26 unit tests) was built first and is shelved on branch `key-vault`; it was never tested in a browser, and its migration must be regenerated before it is revived.
  On `main`: admins can ban and unban users from `/admin` (Better Auth signs a banned user out everywhere); each ban and unban is written to a new `audit_log` table; Vitest runs unit tests (`npm test`). Fixed a redirect loop: `proxy.ts` sent anyone with a session cookie from `/login` to `/dashboard`, even when the session behind the cookie had been deleted (as a ban does), so the two pages bounced forever. `/login` and `/signup` now check the real session instead.
  Next: budgets and the usage ledger, moved ahead of Phase 2.
- **2026-09-12 (later) — Sign-up by invitation; ready to deploy.** Only addresses in `ADMIN_EMAILS` or `ALLOWED_EMAILS` can create an account. Open registration by domain (`OPEN_REGISTRATION` with `ALLOWED_EMAIL_DOMAINS`) is kept as a switch but is off, because without email verification anyone could claim an address at an allowed domain. Sign-in now works from every Vercel address of a deployment, and the repo is public so the free Hobby plan can deploy it. Email verification (Resend) is still needed before the two lists can be fully trusted.
