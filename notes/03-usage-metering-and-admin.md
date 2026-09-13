# 03 — Token metering, budgets, and the admin panel

## Principle

Every LLM call that happens because of a user becomes one row in `usage_events`, whether the call was made by the engine during a job or by the web app during an interactive feature. Cost is computed at insert time from a price table we maintain, so history stays correct when prices change. Budgets are compared against sums over this ledger. There is no second source of truth.

This works the same whether the key belongs to the user (they pay, we cap) or to OxARCA (grant pays, we cap harder).

## Where the numbers come from

| Caller | Source of token counts |
|---|---|
| Engine, Anthropic SDK | `response.usage.input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` |
| Engine, OpenAI Responses API | `response.usage.input_tokens`, `output_tokens`, `input_tokens_details.cached_tokens` |
| Engine, OpenAI Chat Completions (if still used) | `usage.prompt_tokens`, `completion_tokens`, `prompt_tokens_details.cached_tokens` |
| Web app, Vercel AI SDK (interactive features) | `result.usage.inputTokens`, `outputTokens` (plus provider metadata for cache counts) |

Streaming responses still deliver a final usage object; record it when the stream ends.

## Price table

*Update 2026-09-13: prices now live in the `model_prices` table and are edited on `/admin/prices`, so they change without a deploy, and every change is audited. Each call also records whether it went through the Batch API; batch calls are charged at the model's batch discount (usually 50%). The code sketch below was the original plan.*

Keep it in code, versioned, with a `verified_on` date. Prices are per million tokens. Anthropic first-party rates as of the last check (2026-06): Opus 5 $5 in / $25 out; Sonnet 5 $2 / $10; Haiku 4.5 $1 / $5; cache reads are typically 10% of input and cache writes 125%. Fill in the OpenAI rows from their pricing page on the day you set them.

```ts
// lib/prices.ts
export const PRICES = {
  "anthropic:claude-opus-5":    { input: 5,    output: 25,  cacheRead: 0.5,  cacheWrite: 6.25 },
  "anthropic:claude-sonnet-5":  { input: 2,    output: 10,  cacheRead: 0.2,  cacheWrite: 2.5  },
  "anthropic:claude-haiku-4-5": { input: 1,    output: 5,   cacheRead: 0.1,  cacheWrite: 1.25 },
  // "openai:<model>": { ... },   verify on platform.openai.com/pricing before enabling
} as const;                      // verified_on: 2026-09-11

export function costUsd(key: keyof typeof PRICES, u: Usage) {
  const p = PRICES[key];
  return (u.input * p.input + u.output * p.output
        + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1_000_000;
}
```

The admin UI shows which models are enabled; a model missing from the table cannot be selected, so cost is never unknown.

## Budgets

Per user, in `budgets`:

| Field | Meaning | Pilot default |
|---|---|---|
| `monthly_usd_cap` | hard stop for the calendar month | 0 until an admin sets it |
| `per_job_usd_cap` | hard stop for one run | 25 |
| `max_concurrent_jobs` | queued + running | 1 |
| `may_use_team_key` | may run on the shared OxARCA key if they have none | false |

Optional global settings: a team-wide monthly cap on the shared key, and a per-model allowlist.

### Enforcement, in three places

**1. Pre-flight, before the job is created**

```
remaining = min(monthly_usd_cap − month_to_date, per_job_usd_cap)
estimate  = tokens(corpus) × passes × price.input + expected_output × price.output
refuse if estimate > remaining, or running jobs ≥ max_concurrent_jobs
```

`tokens(corpus)` comes from Anthropic's free `count_tokens` endpoint for Anthropic models, and from a chars ÷ 4 heuristic (or `tiktoken`) for OpenAI. `passes` is a constant the engine team supplies per pipeline stage. Show the estimate on the submit form so the historian sees "about $9 of your remaining $40" before clicking Run.

**2. During the run, on every usage callback**

The web app inserts the event, recomputes `remaining`, and replies `{ "remaining_usd": 12.34 }`. The engine keeps going while that is positive. When it goes to zero the engine finishes the current section, writes a partial report, and calls `/complete` with `status: "over_budget"`. The historian gets what was produced, not nothing.

A second guard lives in the engine itself: it never exceeds `budget_usd` from the payload even if callbacks fail, so a broken network cannot cause unlimited spend.

**3. For interactive features in the web app**

Any chat-style route decrements the same budget with the same function before calling the model, and rate-limits per user (Upstash Redis with `@upstash/ratelimit` if needed; Better Auth's built-in limiter covers auth routes).

### Callback security

```
POST /api/internal/jobs/{id}/usage
X-Archos-Timestamp: 1757600000
X-Archos-Signature: hex(HMAC-SHA256(CALLBACK_SECRET, `${timestamp}.${rawBody}`))
{ "event_id": "…uuid…", "stage": "synthesis", "provider": "anthropic", "model": "claude-opus-5",
  "input_tokens": 41233, "output_tokens": 2210, "cache_read_tokens": 30000, "cache_write_tokens": 0 }
```

Reject if the timestamp is more than five minutes old, if the signature does not match (constant-time compare), or if `event_id` already exists (return 200 with the current `remaining_usd`, do not insert).

## Rollups and reporting

- `usage_monthly` is refreshed on every `/complete` and nightly by Vercel Cron. Dashboards read the rollup; drill-downs read `usage_events`.
- Per-job cost is cached on `jobs.cost_usd` at completion.
- Export: `/admin/usage?format=csv` for grant reporting. The headline "one research question cost $12.70" becomes a query, not a guess.

## The admin panel

Role `admin` only, checked server-side on every page and action.

| Page | Contents | Actions |
|---|---|---|
| `/admin/users` | table: name, email, role, status, key status per provider, month-to-date USD, monthly cap, running jobs | invite user, set role, ban / unban, open detail |
| `/admin/users/[id]` | budgets form, key cards (status + last4 only), job history, usage chart, sessions | set caps, toggle team-key access, revoke key, revoke sessions, impersonate (audited) |
| `/admin/jobs` | every job with status, model, tokens, cost, duration; filters by user and status | cancel a running job (web app calls Modal `FunctionCall.cancel`) |
| `/admin/usage` | monthly spend per user and per model; team-key spend versus cap | CSV export |
| `/admin/models` | price table view; enable / disable models | edit allowlist |
| `/admin/audit` | audit log, newest first | filter by actor and action |

Most of the user-management verbs (`listUsers`, `setRole`, `banUser`, `unbanUser`, `createUser`, `impersonateUser`, `revokeUserSessions`, `removeUser`) are the admin plugin's own API. We only add budgets, keys, jobs, and usage on top.

## Alerts

- Email the user (Resend) at 80% and 100% of the monthly cap, and when a job stops as `over_budget`.
- Email admins when the shared team key passes 80% of its cap, and when any key fails weekly re-validation.

## Optional later: Vercel AI Gateway

If the team wants a hosted dashboard on top of the ledger: route the web app's own calls (and, via `base_url`, the engine's) through AI Gateway with request-scoped BYOK (`providerOptions.gateway.byok.anthropic[0].apiKey = <user's key>`), and tag each request with the user ID via Custom Reporting. It records tokens, cost, latency, and every routing attempt. Caveats before adopting: it needs the paid tier with purchased credits; BYOK spend is not counted in gateway budgets; and a failing user key falls back to system credentials billed to OxARCA. The ledger above stays the authority either way.
