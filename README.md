# Archos

Monorepo for the Archos web application (OxARCA, University of Oxford).

| Path | Contents |
|---|---|
| `web/` | Next.js 16 app: login, model-key vault, jobs, usage control. Deployed on Vercel with **Root Directory = `web`** |
| `notes/` | Planning notes: architecture, auth and key vault, metering, deployment, roadmap. Start with `notes/00-summary.md` |

The Python pipeline (the "engine") lives outside this repo; see `notes/01-architecture.md` for the
HTTP contract between the two.
