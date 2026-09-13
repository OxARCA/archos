# 04 — Tools, platforms, and deploying on Vercel

## Tools and why each one

| Need | Tool | Why this one | Considered instead |
|---|---|---|---|
| Framework | **Next.js 16** (App Router, TypeScript, Turbopack) | First-class on Vercel; server components keep secrets server-side by construction; Active LTS | SvelteKit, Remix: fine, smaller auth ecosystem |
| Styling | **Tailwind CSS v4** + **shadcn/ui** | The oxarca site already uses Tailwind v4 with an `oxford` / `parchment` / `bronze` palette; reuse those tokens so the app feels like the site | Mantine, Chakra |
| Auth | **Better Auth** + admin plugin | Own the user table; roles, ban, impersonation built in; maintains Auth.js now | Clerk (paid, vendor), Supabase Auth (ties you to Supabase) |
| Database | **Neon Postgres** via Vercel Marketplace | Provisioned from the Vercel dashboard, env vars injected, branch per preview, UK/EU regions | Supabase (also on the Marketplace, brings Vault and Storage; choose it if you want one vendor for DB + files) |
| ORM / migrations | **Drizzle ORM** + `drizzle-kit` | Type-safe, SQL-shaped, Better Auth has a Drizzle adapter | Prisma |
| File storage | **Vercel Blob** (private) | Client uploads for large collections; report files; same billing | Cloudflare R2 / S3 if collections grow past tens of GB |
| Email | **Resend** | Verification, magic links, budget alerts; React email templates | Postmark, SES |
| Python job host | **Modal** | Python-native, jobs up to 24 h, per-second billing, secrets, web endpoints with proxy auth, scale to zero | Oxford VM + FastAPI + `arq` (no vendor, more ops); Railway / Fly.io (always-on containers) |
| LLM SDKs | `openai` and `anthropic` (Python, in the engine); **Vercel AI SDK** (TypeScript, in the web app, for any interactive feature) | Official SDKs expose `usage`; AI SDK gives one interface across providers | Direct HTTP |
| Rate limiting | **Upstash Redis** (Marketplace) with `@upstash/ratelimit` | Only if interactive endpoints appear; auth routes are already limited by Better Auth | Postgres counters |
| Errors and logs | **Sentry** (web app + engine) and Vercel's built-in logs | Redact `api_key` in `beforeSend` | Axiom, Better Stack |
| Background schedules | **Vercel Cron** | Monthly rollups, weekly key re-validation | GitHub Actions cron |
| Repo hosting | **GitHub**, org `OxArca` | Vercel Git integration deploys on push | |

## Vercel: Hobby (free) or Pro?

*Checked against Vercel's docs on 2026-09-11.*

The architecture does not need Pro. Long work runs on Modal, so every Vercel function returns in seconds, well inside Hobby's 300 s limit. The nightly and weekly crons fit Hobby's once-a-day cron rule. Preview deployments can be protected with Vercel Authentication on Hobby. The reasons to pay are about who may use Hobby and what happens at its limits.

| | Hobby | Pro |
|---|---|---|
| Price | $0 | $20 per developer seat per month, $20 usage credit included; viewer seats free |
| Allowed use | Personal, non-commercial only | Any |
| Who can deploy | The account owner only; commits from anyone else do not deploy | Every developer seat |
| Function duration | 300 s | 300 s default, up to 800 s |
| Included usage per month | 4 CPU-hours active CPU, 360 GB-hours memory, 1M invocations, 100 GB transfer | Pay as you go beyond the credit |
| When a limit is hit | The feature stops, usually for 30 days; you cannot pay to lift it | Billed on demand; spend alerts and caps available |
| Cron | Once per day at most, ±59 min | Once per minute |
| Runtime logs kept | 1 hour | 1 day |
| Preview protection | Vercel Authentication | Same, plus paid add-ons |

**Commercial use is the deciding question.** Vercel defines commercial use as any deployment used "for the purpose of financial gain of anyone involved in any part of the production of the project, including a paid employee or consultant writing the code." OxARCA has no ads or payments, but it is grant-funded. If grant money pays anyone to build or run the app, Vercel's wording counts it as commercial. When unsure, Vercel asks you to contact its support team.

**Recommendation**
- Prototype on Hobby under the lead engineer's own account through phases 0 to 3. It costs nothing, and the prototype has no outside users.
- Move to a Pro team before inviting pilot users. That is when a second engineer needs to deploy, a limit hit would take the app offline for a month, and the commercial-use question becomes real. Budget $20 to $40 a month, depending on whether one or both engineers need developer seats. Sebastian and Ashley can be free viewers.
- Vercel's Open Source Program gives $3,600 of platform credit over three years to open-source projects hosted on Vercel. It asks for an actively developed public repo, a code of conduct, and measurable impact. The current cohort closes on 13 September 2026 and applications reopen every three months, so the next cohort is the realistic target once `archos-web` has real code. The engine repo can stay private.

**The other services on their free tiers**

| Service | Free allowance | What happens at the limit |
|---|---|---|
| Neon Postgres | 0.5 GB storage, 100 compute-hours, 10 branches per project per month; scales to zero after 5 idle minutes | Compute is suspended until next month. With 10 branches, delete old preview branches or turn off branch-per-preview |
| Vercel Blob | Free within Hobby usage limits | Blob is unavailable until 30 days pass. Large collections are the likely trigger |
| Resend | 3,000 emails a month, 100 a day | Sending stops |
| Modal Starter | $30 of compute credit a month | Billed per second after that |

## Accounts to create (one-time)

1. **Vercel**: start on Hobby under the lead engineer's account; create a team "OxARCA" on Pro before the pilot (see above).
2. **GitHub repos**: `OxArca/archos-web` (Next.js) and `OxArca/archos-engine` (Python). The engine repo can be private.
3. **Neon** and **Vercel Blob**: created from the Vercel dashboard, no separate signup.
4. **Modal** workspace "oxarca"; add the two engineers.
5. **Resend** account; verify the sending domain.
6. *Not needed: Google sign-in was dropped on 2026-09-13.*
7. **Domain**. `github.io` cannot host the app. Buy `oxarca.org` (or similar) and point `app.oxarca.org` at Vercel; the static site can move to `www.oxarca.org` later. An `ox.ac.uk` subdomain via Oxford IT is possible but slow to obtain.
8. **Sentry** project (optional in week 1, wanted before the pilot).

## Repository layout

```
archos-web/
  app/                      routes (see 01-architecture.md)
  lib/auth.ts  lib/auth-client.ts  lib/vault.ts  lib/prices.ts  lib/budget.ts  lib/engine.ts
  db/schema.ts  db/index.ts  drizzle/   (migrations)
  proxy.ts                  route protection (Next.js 16 name for middleware)
  vercel.json               crons, function region
  .env.example

archos-engine/
  app.py                    Modal app: submit endpoint + run_job
  archos/                   the existing pipeline as an importable package
  reporter.py               HMAC-signed usage / complete callbacks
  pyproject.toml
```

## Deploying the web app on Vercel, step by step

### 1. Scaffold locally

```bash
npx create-next-app@latest archos-web --typescript --tailwind --app --src-dir=false --import-alias "@/*"
cd archos-web
npm i better-auth drizzle-orm pg @vercel/functions @vercel/blob resend ai @ai-sdk/anthropic @ai-sdk/openai
npm i -D drizzle-kit @types/pg embedded-postgres
npx shadcn@latest init
git init && git add -A && git commit -m "scaffold"
gh repo create OxArca/archos-web --private --source=. --push
```

### 2. Import into Vercel

Vercel dashboard → *Add New → Project* → pick `OxArca/archos-web`. Framework preset is detected as Next.js. Do not deploy yet; add storage and env vars first (or deploy and redeploy after, it does not matter).

### 3. Add Postgres and Blob from the Storage tab

- *Storage → Create Database → Neon* (Marketplace). Region: London or Frankfurt. Vercel injects `DATABASE_URL` and `POSTGRES_URL*` into all environments automatically.
- *Storage → Create → Blob*. Vercel injects `BLOB_READ_WRITE_TOKEN`.

Turn on Neon's **branch per preview deployment** option in the integration settings so preview builds never touch production data.

### 4. Environment variables

*Project → Settings → Environment Variables.* Mark secrets as **Sensitive** (write-only after saving).

| Name | Value | Sensitive |
|---|---|---|
| `DATABASE_URL` | injected by Neon | yes |
| `BLOB_READ_WRITE_TOKEN` | injected by Blob | yes |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | yes |
| `BETTER_AUTH_URL` | `https://app.oxarca.org` (preview: leave unset, Better Auth reads `VERCEL_URL`) | no |
| `KEY_ENCRYPTION_KEY_V1` | `openssl rand -base64 32`, generated on a trusted machine, stored nowhere else | **yes** |
| `RESEND_API_KEY` | Resend | yes |
| `ENGINE_SUBMIT_URL` | Modal endpoint URL from step 8 | no |
| `MODAL_PROXY_TOKEN_ID`, `MODAL_PROXY_TOKEN_SECRET` | Modal proxy-auth token | yes |
| `ENGINE_CALLBACK_SECRET` | `openssl rand -hex 32`, same value in the Modal secret | yes |
| `CRON_SECRET` | `openssl rand -hex 32`; Vercel sends it on cron requests | yes |
| `SENTRY_DSN` | Sentry | no |

Keep a `.env.example` in the repo with every name and no values. Use `vercel env pull .env.local` for local development.

### 5. Migrations

Generate with `npx drizzle-kit generate` locally and commit the SQL. Apply during build so every deployment (including previews on their Neon branch) is migrated:

```json
// package.json
"scripts": { "build": "drizzle-kit migrate && next build" }
```

Better Auth's tables come from `npx @better-auth/cli generate`, which emits Drizzle schema you commit alongside your own.

### 6. Functions and crons

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/rollup", "schedule": "15 2 * * *" },
    { "path": "/api/cron/revalidate-keys", "schedule": "0 3 * * 1" }
  ]
}
```

- Set the function region to **London (lhr1)** in *Settings → Functions* so functions sit next to Neon.
- Fluid Compute is on by default for new projects. Only routes that talk to an LLM directly need a long `maxDuration` (`export const maxDuration = 300` in that route file). Job submission returns in seconds.

### 7. Domain and previews

- *Settings → Domains*: add `app.oxarca.org`; create the CNAME Vercel shows at the registrar.
- *Settings → Deployment Protection*: enable **Vercel Authentication** for preview deployments so unfinished builds are not public.
- Production deploys from `main`; every pull request gets a preview URL with its own database branch.

### 8. Deploy the engine on Modal

```bash
pip install modal && modal setup                      # once, per engineer
modal secret create archos-engine \
  ENGINE_CALLBACK_SECRET=<same as Vercel> \
  BLOB_READ_WRITE_TOKEN=<Blob token>                   # engine uploads reports
modal deploy app.py                                    # prints the /submit endpoint URL
```

Then in the Modal dashboard create a **proxy auth token** and put its ID and secret into the Vercel env vars above. Every deploy of `archos-engine` (GitHub Action on push to `main`: `modal deploy app.py`) keeps the same URL.

### 9. First run checklist

- [ ] Sign up as the first user, promote to `admin` with `npx @better-auth/cli` or a one-off SQL `UPDATE "user" SET role='admin'`.
- [ ] Save a test key on `/keys`, confirm `validated_at` is set and the row holds ciphertext, not the key.
- [ ] Set your own budget to $5 and submit a tiny collection; confirm a `usage_events` row per LLM call and a `/complete` callback.
- [ ] Set the budget to $0.01 and confirm the job stops as `over_budget` with a partial report.
- [ ] Check Vercel logs and Sentry for any line containing `sk-` or `api_key`. There must be none.
- [ ] Rotate `KEY_ENCRYPTION_KEY_V1` → `V2` on the preview environment once, to prove the procedure.

## Where the engine actually lives and runs

**Modal is the host.** There is no server to rent or maintain. The Python code lives in the `archos-engine` GitHub repo; `modal deploy app.py` uploads it, Modal builds a container image from the declarations in `app.py`, and when the web app calls `/submit` Modal starts a container on its own cloud, runs `run_job`, and scales back to zero. You pay only for the seconds the container runs.

```python
# engine/app.py — how the existing pipeline gets into the container
image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("anthropic", "openai", "httpx", "lxml", "pypdf")   # third-party deps
    .add_local_python_source("archos")                              # your own package, from this repo
)

@app.function(image=image, region=["eu"], timeout=24 * 60 * 60, secrets=secrets)
def run_job(job: dict) -> None: ...
```

- `add_local_python_source("archos")` forwards your own package; `add_local_dir` / `add_local_file` do the same for data files such as the constitution prompts.
- `region=["eu"]` keeps containers in the European Economic Area; `"eu-west"` pins Dublin. Narrow regions carry a price multiplier, so start with `"eu"`.
- Optional: a `modal.Volume` for caching embeddings or retrieval indexes between runs, so a re-run over the same collection does not rebuild them.
- Deploy from CI: a GitHub Action on push to `main` runs `modal deploy app.py` with `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` as repository secrets. The endpoint URL stays the same across deploys.

**If you would rather not use Modal**, the contract is two endpoints and outbound callbacks, so any of these work unchanged from the web app's point of view:

| Host | Shape | When it fits |
|---|---|---|
| Oxford department VM or ARC node | FastAPI + `arq` worker in a `systemd` unit, behind the department's reverse proxy | Collections that must not leave the university; zero vendor cost; you do the ops |
| Railway / Render / Fly.io | One always-on container from a Dockerfile | Simple, ~$5–20/month, but an idle container still bills and a single box limits concurrency |
| Hetzner or similar VPS | Same as the VM, self-managed | Cheapest always-on option; you patch it |

Modal remains the recommendation for the pilot because it is Python-native, scales to zero, isolates each job in its own container, and takes minutes to set up.

## Local development

```bash
npm run db:local                  # terminal 1: local Postgres from npm, no Docker (see web/README.md)
npm run db:migrate && npm run dev # terminal 2: http://localhost:3000
modal serve app.py                # hot-reloading engine with a temporary URL; set ENGINE_SUBMIT_URL to it
```

To work against the shared Neon dev branch instead, run `vercel env pull .env.local` once the project is linked.

Sensitive variables are not pulled; generate local-only values for `KEY_ENCRYPTION_KEY_V1` and `BETTER_AUTH_SECRET` in `.env.local`.

## Monitoring

- Vercel: *Observability* tab for function durations and error rates; alert on 5xx spikes.
- Modal: per-function logs and a call history for every `run_job`; failures are visible with the job's `call_id`, which we store on `jobs.engine_call_id`.
- Sentry in both tiers, with `api_key` and `Authorization` scrubbed.
- A `/admin/usage` glance each Monday is the real cost monitor.
