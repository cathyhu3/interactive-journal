# Journal

A personal journal web app that reads and writes directly to Google Docs. Supports two parallel journals — a **Life** journal and a **Career** journal — each with its own calendar view, AI-powered highlights, reflections, and season overviews. Toggle between them at any time without leaving your current page.

## Features

- **Two journals** — Life (green) and Career (blue), toggled from any page header
- **Multi-year support** — flip between years on the home page; add earlier years at any time
- **Calendar view** — click any day to read or write an entry, saved directly to your Google Doc
- **Highlights** — AI-generated bullet list of memorable moments, activities, and things learned that month
- **Reflect** — AI reflection on the current month informed by highlights and reflections saved from previous months
- **Season overview** — home page groups months by season with AI-generated and manually editable theme phrases
- **Highlights & Reflections logs** — every AI output is saved to a browsable, editable log per month
- **Persistent sign-in** — stays logged in between sessions on the same machine

## Prerequisites

- Node.js 18+
- A Google account
- Google Docs named according to the conventions below (one per year per journal type)
- A [Google Cloud](https://console.cloud.google.com/) project with OAuth configured
- An [Anthropic API key](https://console.anthropic.com/) for AI features

## Google Doc naming

The app searches your Google Drive for docs by exact name. You must name them as follows:

| Journal | Year | Required doc name |
|---------|------|-------------------|
| Life    | 2026 | `2026`            |
| Life    | 2025 | `2025`            |
| Career  | 2026 | `2026 career`     |
| Career  | 2025 | `2025 career`     |

The pattern is:
- **Life journal:** `{year}` (e.g. `2026`)
- **Career journal:** `{year} career` (e.g. `2026 career`)

The name must match exactly — casing, spacing, and all.

## Google Doc format

Each entry must be headed by a **bold date line**:

```
Wednesday, May 27th
```

The day-of-week prefix is optional — `May 27th` or `May 27` also work. When you create a new entry from the calendar the app inserts it in the correct chronological position with a bold heading automatically.

Documents are expected to be in **descending order** (newest entry at the top).

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project (or use an existing one).
2. Enable the **Google Docs API** and **Google Drive API** for the project.
3. Go to **APIs & Services → OAuth consent screen**:
   - Set user type to **External**
   - Fill in app name and your email
   - Under **Scopes**, add `auth/documents` and `auth/drive.readonly`
   - Under **Test users**, add your Google account email
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Under **Authorized JavaScript origins**, add:
     ```
     http://localhost:5173
     http://localhost:5174
     http://127.0.0.1:5173
     http://127.0.0.1:5174
     ```
5. Copy the generated **Client ID**.

### 3. Create `.env.local`

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in both values:

```
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

- `VITE_GOOGLE_CLIENT_ID` — OAuth Client ID from step 2 (safe to expose; only used in the browser)
- `ANTHROPIC_API_KEY` — Anthropic API key (never sent to the browser; proxied server-side by the dev server)

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). On first sign-in you'll be asked which year you started journaling — this sets the earliest year available in the year navigator.

> **"Google hasn't verified this app" warning:** Because the app runs in Google's testing mode, you'll see this on the first sign-in. Click **Advanced → Go to [app name] (unsafe)** to proceed. This is expected for personal/local apps.

## Using the app

### Switching journals

A **Life / Career** toggle appears in the top-right of every page. Clicking it takes you to the same year, month, or log page in the other journal.

### Navigating years

Use the `‹` and `›` arrows on the home page to move between years. When you're at your earliest year, a **+ year** button appears instead of `‹` — clicking it extends the range back by one year and navigates there.

### Writing entries

Click any day on the calendar to open the entry editor. If no entry exists for that day, creating one inserts it into the Google Doc in the correct chronological position (newest at top). Saving an existing entry updates it in place.

### AI features

Both journals have two AI buttons on each month page:

- **Highlights** — generates a bullet list of specific moments, activities, things learned, and reflections from that month's entries. Career mode focuses on skills, projects, and professional insights.
- **Reflect** — generates a flowing reflection on the month, drawing on the current entries plus any highlights and reflections previously saved from other months in the same year.

Every AI output is automatically saved to the month's log (accessible via the **Highlights Log** and **Reflections Log** buttons next to the calendar). Logs are editable and can also accept manually pasted notes.

### Season themes

The home page shows four seasonal sections. Each has three editable theme phrases. Click any phrase to edit it. The ✦ button (visible when entries exist) asks the AI to suggest three themes based on that season's journal entries.

## Commands

```bash
npm run dev      # start dev server at localhost:5173
npm run build    # production build
npm run preview  # preview the production build locally
```

There is no lint or test script.

## Building for production

The AI features use a `/api/claude` proxy that only exists in the Vite **dev server**. A production deployment would need a separate backend to forward requests to the Anthropic API securely.
