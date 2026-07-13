# Exposé-Assistent

Aus strukturierten Immobilien-Eckdaten generiert dieses Mini-Tool ein professionelles Wohnungs-Exposé. Nutzer:innen geben Adresse, Fläche, Zimmer, Zustand, Baujahr und ein paar Freitext-Notizen ein — Claude schreibt daraus vier saubere Abschnitte (**Lage, Ausstattung, Zustand, Fazit**), die einzeln neu generiert und gespeichert werden können.

**Stack:** Next.js 16 (App Router) · Supabase (Auth + Postgres + RLS) · Claude API · Vercel.

**Live-Demo:** [expose-generator-eight.vercel.app](https://expose-generator-eight.vercel.app) — „Demo ansehen" öffnet die App per anonymer Session in einem Klick, ganz ohne Anmeldung.

---

## Warum dieses Projekt

Es zeigt das Kernmuster von Gutachten-/Fachdokument-KI in Kleinformat: **strukturierte Daten + LLM → verlässliches Fachdokument** — ohne ein bestehendes Produkt nachzubauen. Andere Domäne, gleiches Problem.

Drei bewusste "Senior-Signale" im Code:

1. **Row Level Security auf allen Tabellen** (`user_id = auth.uid()`). Datentrennung passiert in der Datenbank, nicht in der App-Logik — der Browser spricht mit dem öffentlichen anon-Key direkt gegen Supabase und sieht trotzdem nur eigene Zeilen. Siehe [`supabase/schema.sql`](supabase/schema.sql).
2. **Strukturierte Speicherung als JSONB** (`documents.content = { lage, ausstattung, zustand, fazit }`) statt Textblob. Das macht einzelne Regeneration und verlässliche Weiterverarbeitung erst möglich, und die versionierte `prompt_version` hält gespeicherte Dokumente nachvollziehbar.
3. **Streaming + serverseitiger API-Key.** Die Generierung läuft über einen Route Handler ([`/api/generate`](src/app/api/generate/route.ts)); der Anthropic-Key erreicht den Browser nie. Der Text wird tokenweise gestreamt — alle vier Abschnitte parallel.

---

## Lokal starten

### 1. Abhängigkeiten

```bash
npm install
```

### 2. Supabase-Projekt

1. Projekt auf [supabase.com](https://supabase.com) anlegen.
2. SQL Editor öffnen und den Inhalt von [`supabase/schema.sql`](supabase/schema.sql) ausführen (Tabellen, RLS-Policies, Auto-Profil-Trigger).
3. Unter **Authentication → URL Configuration** die Redirect-URL `http://localhost:3000/auth/callback` (und später die Vercel-URL) eintragen.

### 3. Environment

`.env.example` nach `.env.local` kopieren und ausfüllen:

```bash
cp .env.example .env.local
```

| Variable | Quelle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |

### 4. Dev-Server

```bash
npm run dev
```

→ [http://localhost:3000](http://localhost:3000). Login per E-Mail/Passwort oder Ein-Klick-Demo (anonyme Session), dann Eckdaten eingeben und generieren.

---

## Architektur

```
Browser ──(anon key, RLS)──────────────► Supabase Postgres
   │                                         ▲
   │  POST /api/generate (streaming)         │ properties, documents
   ▼                                         │
Route Handler ──(ANTHROPIC_API_KEY)──► Claude API
   (serverseitig, auth-guarded)
```

- **Auth:** Supabase — E-Mail/Passwort als Hauptweg, Magic Link optional, plus Ein-Klick-Demo über anonyme Sessions. Session-Refresh + Routenschutz in [`src/proxy.ts`](src/proxy.ts) → [`src/lib/supabase/middleware.ts`](src/lib/supabase/middleware.ts).
- **Datenzugriff:** Lesen/Schreiben von `properties`/`documents` direkt über den Browser-Client — abgesichert durch RLS.
- **Generierung:** [`src/lib/anthropic.ts`](src/lib/anthropic.ts) kapselt Modell, System-Prompt-Vertrag und Prompt-Bau pro Abschnitt.

## Datenmodell

```
profiles     id (= auth.users.id), name, created_at
properties   id, user_id, address, size_sqm, rooms, year_built, condition, notes, created_at
documents    id, property_id, user_id, content (jsonb), model, prompt_version, created_at
```

## Deploy (Vercel)

1. Repo mit Vercel verbinden.
2. Die drei Environment-Variablen im Vercel-Projekt setzen.
3. In Supabase die Vercel-URL als Redirect-URL ergänzen (`https://<projekt>.vercel.app/auth/callback`).

---

## Gebaut an einem Wochenende mit Claude Code

Dieses Projekt ist von Anfang bis Ende mit [Claude Code](https://claude.com/claude-code) entstanden — Scaffolding, RLS-Policies, Streaming-Route und UI. Workflow:

- **Setup zuerst absichern:** Next.js + Supabase-Clients + RLS + Auth durchgestochen, bevor eine Zeile Feature-Code entstand — der Teil mit den meisten Stolpersteinen.
- **Der LLM-Kern als Schaufenster:** Prompt-Vertrag zentral in einer Lib, Streaming über einen Route Handler, Key strikt serverseitig.
- **Schmaler, polierter Scope** statt breit und halbfertig: bewusst weggelassen wurden Teams/Sharing, Zahlungen und weitere Dokumenttypen.
