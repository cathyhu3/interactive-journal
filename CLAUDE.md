# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (localhost:5173)
npm run build     # production build
npm run preview   # preview production build locally
```

There is no lint or test script.

## Environment setup

Copy `.env.local.example` to `.env.local` and fill in both keys:

```
VITE_GOOGLE_CLIENT_ID=...   # Google OAuth client ID (client-side, VITE_ prefix intentional)
ANTHROPIC_API_KEY=...       # Anthropic key (server-side only, never exposed to browser)
```

The Google OAuth client must have `http://localhost:5173` (and 5174) in its Authorized JavaScript Origins in Google Cloud Console, and the user's email must be in the OAuth consent screen test users list while the app is unverified.

## Architecture

**Stack:** React 18 + Vite, React Router v6, no backend — all persistence is `localStorage`.

**Year is hardcoded to 2026** throughout the codebase (cache keys, doc name search, date formatting, etc.).

### Auth flow (`src/context/AuthContext.jsx`)

Uses Google Identity Services (GIS) `window.google.accounts.oauth2.initTokenClient` (loaded via `<script>` tag in `index.html`). On mount, if a fresh token exists in `localStorage` (`journal-auth-2026`), it's used immediately. If the stored email exists but the token is expired, a silent re-auth (`prompt: ''`) is attempted. The `handleAuthExpired` callback is wired to `useGoogleDocs` so 401 responses trigger a silent token refresh automatically.

### Data layer (`src/hooks/useGoogleDocs.js`)

Accepts `(token, onAuthExpired)` — does not manage auth itself.

- Finds the Google Doc named `"2026"` via Drive API, then fetches it via Docs API.
- Parses section headers by detecting either `HEADING_` paragraph styles **or** fully-bold paragraphs (`isBoldSectionHeader`). This is how dated entries are identified.
- Date heading format: `"Wednesday, May 27th"` — the parser strips the day-of-week prefix then matches month+day with optional ordinal/year suffixes.
- Cache key `gdoc-cache-2026` stores `{entries, docId, lastRefreshed}`. Auto-fetches only on first load (no cache); subsequent fetches require explicit `refresh()` call or a write operation.
- `saveEntry` / `createEntry` both fetch a fresh document copy first (to get current indices), then call `batchUpdate` with `deleteContentRange` + `insertText`. `createEntry` sorts all existing entries to find the correct chronological insertion index.

### AI proxy (`vite.config.js`)

`claudeApiPlugin` adds a `/api/claude` middleware to the Vite **dev** server that proxies SSE-streaming requests to `https://api.anthropic.com/v1/messages`. The `ANTHROPIC_API_KEY` is read server-side only and never sent to the browser. **This proxy does not exist in the production build** — `npm run build` produces a static site with no API backend.

### AI streaming (`src/hooks/useClaudeStream.js`)

`useClaudeStream()` returns `{ stream, streaming, abort }`. The `stream()` call POSTs to `/api/claude` and reads the SSE response via an async generator (`readSSE`), accumulating `text_delta` chunks. Anthropic error shape is `{ error: { type, message } }`.

### localStorage keys

| Key | Contents |
|-----|----------|
| `journal-auth-2026` | `{ token, expiry, email, name, picture }` |
| `gdoc-cache-2026` | `{ entries, docId, lastRefreshed }` — parsed doc entries keyed by `[monthIndex][day]` |
| `season-themes-2026-{0-3}` | JSON array of 3 theme strings per season |
| `log-2026-{monthIndex}-{themes\|chat}` | Array of `{ id, timestamp, text }` log entries |

### Routes

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `HomePage` | Year overview — 4 seasonal sections with month links and editable AI themes |
| `/month/:monthIndex` | `MonthPage` | Monthly calendar grid + AI themes/chat panel |
| `/month/:monthIndex/log/:logType` | `LogPage` | Editable log of saved AI outputs (`logType`: `themes` or `chat`) |

`LogPage` also exports `readLog` and `appendLog` utilities used by `MonthAI` to auto-save AI outputs.
