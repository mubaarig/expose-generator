# Exposé Assistant

From structured property facts this mini tool generates a professional apartment exposé. Users enter address, size, rooms, condition, year built and a few free-text notes — Claude turns them into four clean sections (**Lage, Ausstattung, Zustand, Fazit** — location, features, condition, summary), each of which can be regenerated individually and saved.

**Stack:** Next.js 16 (App Router) · Supabase (Auth + Postgres + RLS) · Claude API · Vercel.

**Live demo:** [expose-generator-eight.vercel.app](https://expose-generator-eight.vercel.app) — "Demo ansehen" opens the app via an anonymous session in one click, no sign-up required.

---

## Why this project

It shows the core pattern of assessment/technical-document AI in miniature: **structured data + LLM → reliable technical document** — without cloning an existing product. Different domain, same problem.

Three deliberate "senior signals" in the code:

1. **Row Level Security on all tables** (`user_id = auth.uid()`). Data separation happens in the database, not in app logic — the browser talks to Supabase directly with the public anon key and still sees only its own rows. See [`supabase/schema.sql`](supabase/schema.sql).
2. **Structured storage as JSONB** (`documents.content = { lage, ausstattung, zustand, fazit }`) instead of a text blob. This is what makes individual regeneration and reliable downstream processing possible, and the versioned `prompt_version` keeps stored documents traceable.
3. **Streaming + server-side API key.** Generation runs through a route handler ([`/api/generate`](src/app/api/generate/route.ts)); the Anthropic key never reaches the browser. Text is streamed token by token — all four sections in parallel.

---

## Run locally

### 1. Dependencies

```bash
npm install
```

### 2. Supabase project

1. Create a project on [supabase.com](https://supabase.com).
2. Open the SQL editor and run the contents of [`supabase/schema.sql`](supabase/schema.sql) (tables, RLS policies, auto-profile trigger).
3. Under **Authentication → URL Configuration** add the redirect URL `http://localhost:3000/auth/callback` (and later the Vercel URL).

### 3. Environment

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

| Variable | Source |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |

### 4. Dev server

```bash
npm run dev
```

→ [http://localhost:3000](http://localhost:3000). Log in with email/password or the one-click demo (anonymous session), then enter the property facts and generate.

---

## Architecture

```
Browser ──(anon key, RLS)──────────────► Supabase Postgres
   │                                         ▲
   │  POST /api/generate (streaming)         │ properties, documents
   ▼                                         │
Route handler ──(ANTHROPIC_API_KEY)──► Claude API
   (server-side, auth-guarded)
```

- **Auth:** Supabase — email/password as the primary path, magic link optional, plus a one-click demo via anonymous sessions. Session refresh + route protection in [`src/proxy.ts`](src/proxy.ts) → [`src/lib/supabase/middleware.ts`](src/lib/supabase/middleware.ts).
- **Data access:** reading/writing `properties`/`documents` directly through the browser client — secured by RLS.
- **Generation:** [`src/lib/anthropic.ts`](src/lib/anthropic.ts) encapsulates the model, the system-prompt contract and per-section prompt building.

## Data model

```
profiles     id (= auth.users.id), name, created_at
properties   id, user_id, address, size_sqm, rooms, year_built, condition, notes, created_at
documents    id, property_id, user_id, content (jsonb), model, prompt_version, created_at
```

## Deploy (Vercel)

1. Connect the repo to Vercel.
2. Set the three environment variables in the Vercel project.
3. In Supabase add the Vercel URL as a redirect URL (`https://<project>.vercel.app/auth/callback`).

---

## Built in a weekend with Claude Code

This project was built end to end with [Claude Code](https://claude.com/claude-code) — scaffolding, RLS policies, streaming route and UI. Workflow:

- **Nail the setup first:** wire Next.js + Supabase clients + RLS + auth end to end before a single line of feature code — the part with the most pitfalls.
- **The LLM core as the showcase:** prompt contract centralized in a lib, streaming through a route handler, key strictly server-side.
- **Narrow, polished scope** instead of broad and half-finished: teams/sharing, payments and further document types were deliberately left out.
