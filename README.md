# 2026 Journal

A personal journal web app that reads and writes directly to a Google Doc named **"2026"** in your Google Drive. Each month has a calendar view where you can create and edit daily entries. AI-powered features let you explore themes and have reflective conversations about your entries.

## Features

- **Calendar view** for each month — click any day to read or write a journal entry, saved directly to your Google Doc
- **AI themes** — generate a thematic summary of a month's entries using Claude
- **AI chat** — have a conversation with Claude about what you wrote
- **Season overview** — home page groups months by season with editable theme phrases
- **Persistent sign-in** — stays logged in between sessions on the same machine

## Prerequisites

- Node.js 18+
- A Google account with a Google Doc named exactly **`2026`** in your Drive
- A [Google Cloud](https://console.cloud.google.com/) project with the OAuth consent screen configured
- An [Anthropic API key](https://console.anthropic.com/) (for AI features)

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

Copy the example file and fill in your keys:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local`:

```
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

- `VITE_GOOGLE_CLIENT_ID` — the OAuth Client ID from step 2
- `ANTHROPIC_API_KEY` — your Anthropic API key (never sent to the browser; used server-side by the dev server proxy)

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and sign in with the Google account that has your "2026" doc.

> **First sign-in note:** Because the app is in Google's "testing" mode, you may see a warning that says "Google hasn't verified this app." Click **Advanced → Go to [app name] (unsafe)** to proceed. This is expected for personal/local apps.

## Google Doc format

The app looks for section headers to identify journal entries. Each entry should be headed by a **bold date line** in your doc, e.g.:

```
Wednesday, May 27th
```

The day-of-week prefix is optional — `May 27th` or `May 27` also work. The app writes new entries in the same bold format when you create them from the site.

## Building for production

```bash
npm run build
npm run preview
```

Note: the AI features (`/api/claude` proxy) only work in the dev server. A production deployment would require a separate backend to proxy Anthropic API calls.
