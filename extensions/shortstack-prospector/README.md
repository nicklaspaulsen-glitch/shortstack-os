# ShortStack Prospector — Browser Extension

One-click prospect saving from LinkedIn (or any site) into your
ShortStack CRM, with an AI research panel for cold-outreach prep.

Manifest V3 only — works in Chrome and Edge. The legacy
`chrome-extension/` folder at the repo root remains the older
popup-only quick-actions extension; this one is purpose-built for
prospecting.

## Features

- **Save to ShortStack** floating button on every LinkedIn profile
  (`linkedin.com/in/<handle>`)
- **Popup UI** detects the current profile and lets you save with a
  single click
- **AI research panel** — company info, recent news, suggested cold
  email opener, and a "best time to reach out" heuristic
- **Cookie-based auth** — reads the Supabase session cookie from
  `app.shortstack.work` so signing in there automatically signs in the
  extension. No separate token management.
- **Options page** for self-hosted / staging URL overrides

## Architecture

```
extensions/shortstack-prospector/
├── src/
│   ├── manifest.config.ts        # CRX MV3 manifest (typed)
│   ├── shared/
│   │   ├── types.ts              # Message protocol + DTOs
│   │   └── config.ts             # Base URL, cookie name, settings
│   ├── background/
│   │   ├── index.ts              # SW message router
│   │   ├── auth.ts               # chrome.cookies → Supabase token
│   │   └── api.ts                # /api/extension/* + /api/ai/*
│   ├── content/
│   │   ├── index.ts              # Floating button + DOM watcher
│   │   ├── scrape.ts             # LinkedIn extractor
│   │   └── content.css
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx              # React entry
│   │   ├── Popup.tsx             # Main UI
│   │   ├── ResearchPanel.tsx
│   │   ├── messaging.ts          # Typed wrapper around runtime.sendMessage
│   │   └── popup.css
│   └── options/
│       ├── index.html
│       └── main.ts
├── public/icons/                 # 16 / 48 / 128 PNGs
├── manifest.json (generated)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Auth flow

1. User signs in at https://app.shortstack.work
2. Supabase sets the `sb-<ref>-auth-token` cookie on
   `app.shortstack.work`
3. Background SW reads the cookie via `chrome.cookies.get` (granted by
   `permissions: ["cookies"]` plus a host_permission entry for
   `app.shortstack.work`)
4. Each API call attaches the Supabase access token as a Bearer
   header. The token is **never** persisted to `chrome.storage`; the
   SW re-reads the cookie on every request, so logging out of the web
   app immediately invalidates the extension.

### Save flow

1. Content script detects a LinkedIn profile URL pattern
   (`/in/<handle>`)
2. Floating "Save to ShortStack" button is injected into the page
3. On click, content script scrapes name / headline / company / role /
   location / photo and asks the background SW to POST to
   `/api/extension/lead` (existing endpoint — already validates the
   Supabase token via `requireExtensionUser`)
4. Toast confirms success or shows the API error

### AI research flow

1. User clicks **Run AI research** in the popup
2. Background SW calls `/api/ai/research-prospect` with the LinkedIn
   URL, name, and company
3. The route runs `callLLM` (Claude with prompt caching) to produce:
   - Company info (description, industry, size, website)
   - Up to 3 recent news bullets
   - Suggested cold-email opener
   - Heuristic "best time to reach out"
4. Result is rendered in the popup with a Copy button on the opener

## Local install (Chrome / Edge)

1. From the repo root:
   ```bash
   cd extensions/shortstack-prospector
   npm install
   npm run build
   ```
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select `extensions/shortstack-prospector/dist/`
6. Pin the **ShortStack Prospector** icon from the puzzle-piece menu
7. Sign in once at https://app.shortstack.work — done

To point at a staging or local Next.js instance, open the extension's
**Options** page and set the instance URL.

## Development

`npm run dev` runs Vite in watch mode and rebuilds on every save.
After loading the unpacked extension once, hit the reload icon in
`chrome://extensions` to pick up changes (or just close + re-open the
popup for popup-only changes).

Type-check only:

```bash
npm run typecheck
```

## Constraints

- TypeScript `strict` mode, no `any` allowed
- Manifest V3 only — V2 is deprecated
- No heavy SDKs imported in the content script (lightweight DOM only)
- Auth via `chrome.cookies.get`, **not** localStorage — works for
  cross-origin (LinkedIn) tabs

## Backend route

This extension expects a backend route at
`/api/ai/research-prospect`. It's added in this same PR — see
`src/app/api/ai/research-prospect/route.ts`.
