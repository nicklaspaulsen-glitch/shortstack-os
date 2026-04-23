# Screenshot audit setup

`scripts/screenshot-audit.mjs` walks the dashboard in a real Chromium, takes
full-page screenshots of every route, and flags broken UI (overlapping
popups, cut-off modals, z-index wars, overflow clipping, page 404s).

Output lands in `./screenshot-audit/<timestamp>/`:

```
screenshot-audit/20260423-214510/
├── dashboard.png
├── dashboard__crm.png
├── dashboard__deals.png
├── ...
└── report.json
```

`report.json` contains per-route findings, console/page errors, final URL
(post-redirect), and timing. The script exits non-zero if any route fails
to load or produces a severity `error` finding, so CI can gate releases.

---

## 1. Run locally

### Prerequisites

```bash
npm install --save-dev playwright
npx playwright install chromium
```

### Quick start — public routes only

```bash
# Against a local dev server
npm run dev          # in one terminal
npm run audit:screenshots   # in another
```

Without `AUTH_COOKIE`, protected dashboard routes redirect to `/login` — the
script still runs, still takes screenshots, and flags the redirects as
findings. Useful as a smoke test.

### Auth-gated routes

The audit uses a raw `Cookie` header string passed via `AUTH_COOKIE`.

1. Log into the app in a normal browser.
2. Open DevTools → Application → Cookies → copy the session cookies
   (for Supabase that's `sb-access-token`, `sb-refresh-token`, and any
   `sb-*-auth-token` entries).
3. Format them as a single header string:

   ```bash
   export AUTH_COOKIE="sb-access-token=eyJhbGc...; sb-refresh-token=..."
   ```

4. Run:

   ```bash
   BASE_URL=http://localhost:3000 \
   AUTH_COOKIE="$AUTH_COOKIE" \
   npm run audit:screenshots
   ```

### Env vars

| Var           | Default                    | Purpose                                     |
| ------------- | -------------------------- | ------------------------------------------- |
| `BASE_URL`    | `http://localhost:3000`    | Target origin.                              |
| `AUTH_COOKIE` | `""`                       | Raw `Cookie` header for protected routes.   |
| `HEADLESS`    | `true`                     | Set `false` to watch the browser.           |
| `TIMEOUT_MS`  | `30000`                    | Per-page navigation timeout.                |

### What the script checks

| Rule                              | Severity | What it catches                                                    |
| --------------------------------- | -------- | ------------------------------------------------------------------ |
| `dialog-missing-aria-modal`       | warn     | `[role="dialog"]` / `.modal` without `aria-modal="true"`.          |
| `dialog-missing-backdrop`         | warn     | Visible dialog but no backdrop element present.                    |
| `multiple-open-dialogs`           | warn     | More than one visible dialog — overlay stack war.                  |
| `fixed-highz-offscreen`           | error    | `position: fixed`, z-index > 100, rendered outside the viewport.   |
| `overflow-hidden-clipping`        | warn     | Child bounding box extends past an `overflow: hidden` ancestor.    |
| `empty-or-near-empty-page`        | error    | Body text under 40 chars (render failure / blank screen).          |
| `page-rendered-404`               | error    | "404" / "not found" in the first 500 chars of body text.           |

Console errors and unhandled page errors are captured per route without
being classified as findings — they land in `consoleErrors` / `pageErrors`
arrays in the report.

---

## 2. Vercel preview integration (concept)

Vercel preview deployments are the right target for this audit — each PR
gets its own URL, and the Vercel Deployments API gives you that URL for
GitHub Actions to hit.

### Shape

1. PR opens. Vercel builds a preview, posts the URL back to the PR.
2. A GitHub Action on `pull_request` + `deployment_status` waits for
   preview deploy to succeed.
3. Action checks out the repo, installs deps + Chromium, runs the audit
   against the preview URL with a service-account `AUTH_COOKIE` stored in
   GitHub Secrets.
4. Action uploads `screenshot-audit/` as an artifact on the run, and
   posts a PR comment summarizing failing routes + links to screenshots.

### Service-account cookie

Do not reuse a human session. Create a dedicated `audit@shortstack.com`
Supabase user, log in once, grab the cookies, paste into GitHub Secrets
as `AUDIT_AUTH_COOKIE`. Rotate on expiry (Supabase refresh tokens are
long-lived, but schedule a quarterly rotation).

---

## 3. GitHub Actions sample

`.github/workflows/screenshot-audit.yml`:

```yaml
name: Screenshot audit

on:
  # Run against preview deployments as they come up.
  deployment_status:
  # Allow manual dispatch against any URL.
  workflow_dispatch:
    inputs:
      base_url:
        description: "Base URL to audit"
        required: true
        default: "https://app.shortstack.com"

jobs:
  audit:
    # Only run when a preview deployment finished successfully, or on manual dispatch.
    if: >
      github.event_name == 'workflow_dispatch' ||
      (github.event.deployment_status.state == 'success' &&
       github.event.deployment_status.environment != 'Production')
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Install deps
        run: npm ci

      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium

      - name: Pick base URL
        id: target
        run: |
          if [ -n "${{ inputs.base_url }}" ]; then
            echo "url=${{ inputs.base_url }}" >> "$GITHUB_OUTPUT"
          else
            echo "url=${{ github.event.deployment_status.target_url }}" >> "$GITHUB_OUTPUT"
          fi

      - name: Run screenshot audit
        env:
          BASE_URL: ${{ steps.target.outputs.url }}
          AUTH_COOKIE: ${{ secrets.AUDIT_AUTH_COOKIE }}
        run: npm run audit:screenshots

      - name: Upload audit artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: screenshot-audit
          path: screenshot-audit/
          retention-days: 14

      - name: Comment on PR with summary
        if: always() && github.event_name == 'deployment_status'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require("fs");
            const path = require("path");
            const root = "screenshot-audit";
            if (!fs.existsSync(root)) return;
            const runs = fs.readdirSync(root);
            if (!runs.length) return;
            const latest = runs.sort().pop();
            const reportPath = path.join(root, latest, "report.json");
            if (!fs.existsSync(reportPath)) return;
            const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
            const { totals } = report;
            const body = [
              `### Screenshot audit: \`${report.baseUrl}\``,
              ``,
              `- routes: **${totals.routes}** (ok: ${totals.ok}, failed: ${totals.failed})`,
              `- findings: **${totals.findings}**`,
              `- console errors: ${totals.consoleErrors}`,
              `- page errors: ${totals.pageErrors}`,
              ``,
              `Artifact: \`screenshot-audit\` on this run.`,
            ].join("\n");
            // For deployment_status events there is no PR number in context;
            // find it from the SHA if needed (left as an exercise).
            console.log(body);
```

---

## 4. Troubleshooting

- **"`playwright` is not installed"** — the script no-ops and exits 0
  so CI doesn't spam failures. Run
  `npm install --save-dev playwright && npx playwright install chromium`.
- **All routes redirect to `/login`** — `AUTH_COOKIE` is missing or
  expired. Re-capture from a logged-in browser and re-export.
- **`multiple-open-dialogs` false positives** — some pages legitimately
  render a closed-but-mounted dialog. Ensure the component sets
  `display: none` or removes the element when closed, not just
  `aria-hidden`.
- **Screenshots include a scrollbar stub on the right** — that's the
  Chromium overlay scrollbar during full-page capture. Harmless, ignore.

---

## 5. Deferred

- **Auth flow automation.** Right now `AUTH_COOKIE` is captured manually.
  Next step: a small helper that logs in via the Supabase password grant
  and emits the cookie string, so CI can refresh it on its own without
  human intervention.
- **Visual regression.** Screenshots are captured but not diffed against
  a golden set. Wire in `pixelmatch` or Percy once the baseline UI
  stabilizes.
- **Per-viewport runs.** Currently audits one 1440×900 viewport. Add a
  `VIEWPORTS` list (desktop / tablet / mobile) once the dashboard has
  responsive parity.
- **Component-level selectors.** The dialog-detection rules use generic
  selectors (`[role="dialog"]`, `.modal`). Tighten to the project's
  actual modal primitives once they're unified.
