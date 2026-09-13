# 05 — Roadmap

Estimates assume one engineer part-time with a second reviewing, and that the Python pipeline can already be called as a function with a clear input (question + sources) and output (report). If the pipeline needs restructuring first, add it to Phase 2.

## Phase 0 — Foundations (week 1)

Deliverables
- `archos-web` scaffolded (Next.js 16, Tailwind v4 with the site's palette, shadcn/ui) and deployed to Vercel from `main`.
- Neon and Blob attached; Drizzle schema for `budgets`, `provider_keys`, `collections`, `jobs`, `usage_events`, `usage_monthly`, `audit_log`; migrations run in the build.
- `archos-engine` repo with a stub `run_job` that sleeps, posts two fake usage events, and completes. Deployed on Modal with proxy auth.
- `.env.example`, Sentry, and the domain.

Done when: a push to `main` deploys, `/api/internal/*` rejects unsigned calls, and the stub engine round-trips a job.

## Phase 1 — Login and the key vault (weeks 2–3)

*Update 2026-09-12: the pilot uses one OxARCA team key, so the `/keys` page and the vault are shelved on branch `key-vault`. Phase 1 is now login, roles, ban and the audit log.*

Deliverables
- Better Auth with email + password (verified via Resend); admin plugin; `proxy.ts` protection; closed sign-up or domain allowlist.
- `/keys` page: save with validation call, show `last4`, replace, remove. Vault module with AAD and versioned master key.
- Audit log entries for key events.
- Tests: encrypt → decrypt round-trip; AAD mismatch fails; ciphertext is what lands in the DB; server action never returns the key.

Done when: two people can log in, store keys, and an admin can list and ban users.

## Phase 2 — Real jobs (weeks 3–5)

Deliverables
- Collection upload (client upload to private Blob; TXT, TEI/XML, CSV, PDF with text layer).
- `POST /api/jobs` with pre-flight estimate, decryption, engine call; job status page with polling.
- Engine: the real pipeline behind `run_job`, per-job provider client, `on_usage` hook wired to the reporter, graceful stop on `remaining_usd <= 0`, report upload.
- Report viewer: render the Evidence Report (PEEL sections, sentence-level footnotes, provenance cards) and a download button.

Done when: a historian submits a small real collection and reads the report in the browser, and every LLM call is in `usage_events`.

## Phase 3 — Budgets and the admin panel (weeks 5–6)

*Update 2026-09-12: budgets and the admin controls come next, ahead of Phase 2, because every job will run on the team key and needs a per-user cap first. Caps are in dollars.*

Deliverables
- Budget enforcement in all three places; `over_budget` partial reports.
- `/usage` for users; `/admin/users`, `/admin/users/[id]`, `/admin/jobs`, `/admin/usage`, `/admin/models`, `/admin/audit`.
- Cron rollups and weekly key re-validation; alert emails at 80% / 100%.
- The shared OxARCA key is the default, and for the pilot the only, key.

Done when: an admin can cap a user at $10, watch a job approach it, and see it stop.

## Phase 4 — Pilot (weeks 7–8)

- Invite three to five collaborators from the "Get involved" mailbox.
- Add magic-link login if password sign-up causes friction.
- Collect: time-to-first-report, cost per report, points where historians got stuck.
- Decide on Microsoft (Oxford SSO), Vercel AI Gateway, and a cloud KMS based on what the pilot shows.

## Later ideas, deliberately out of v1

- Interactive follow-up questions over a finished report (needs the interactive budget path and streaming UI).
- Sharing a report read-only by link, with an expiry.
- Team workspaces (Better Auth organization plugin) so a research group shares collections and a budget.
- OCR / HTR intake for untranscribed material, as a separate engine job type.

## Open questions for the team

1. **Who pays for tokens in the pilot?** Users' own keys only, or does OxARCA also fund a shared key with per-user allowances? The design supports both; the answer sets the default budgets. **Answered 2026-09-12: OxARCA's team key only, with per-user caps in dollars.**
2. **Data residency.** Is UK/EU hosting sufficient for the collections partners will send, or do some require on-premises processing (which would mean the Oxford VM variant of the engine)?
3. **Domain.** Is there an `oxarca.org`-style domain, or should we request an `ox.ac.uk` subdomain now given the lead time?
4. **Default models.** Which Anthropic and OpenAI models does the pipeline currently use, and which should be selectable by users?
5. **Pipeline shape.** Is there a single `archos.run(...)` entry point today, and where in the code do provider calls happen (so the usage hook can be added in one place)?
6. **Report format.** Is the Evidence Report produced as Markdown, HTML, or a structured JSON we can render? JSON is best for the viewer and the footnote and provenance UI.
7. **Vercel plan.** Does grant money pay anyone to build or run the app? If yes, Vercel treats the deployment as commercial and the free Hobby plan is not allowed, so budget Pro at $20 per developer seat per month from the pilot onward. See `04-tools-and-vercel-deployment.md`.
