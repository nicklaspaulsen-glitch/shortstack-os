# E2E User-Journey Tests

Playwright tests that exercise full authenticated flows against ShortStack OS.

## Suites

| File | What it tests |
|---|---|
| `journeys/auth.spec.ts` | Sign in, verify dashboard loads, sign out |
| `journeys/clients.spec.ts` | Add a sentinel client, verify it appears in the table, deactivate (clean up) |
| `journeys/team-members.spec.ts` | Open invite modal, create a sentinel team member, verify list, delete |
| `journeys/self-test.spec.ts` | Navigate to `/dashboard/admin/self-test`, run sweep, assert >= 30 routes and 0 failures |

The existing public smoke tests in `playwright/smoke.spec.ts` still run alongside these.

## Running Tests

```bash
# All suites — headless, against production (https://app.shortstack.work)
npm run test:e2e

# With a browser window visible
npm run test:e2e:headed

# Interactive Playwright UI (pick suites, inspect traces)
npm run test:e2e:ui

# Against local dev server
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
```

Tests that require credentials will **skip gracefully** (not fail) if env vars are missing.
This means PRs from forks or CI jobs without secrets will still pass.

## Recording New Flows

```bash
npm run record
```

This opens Playwright Codegen pointed at production. Every click, fill, and navigation you perform is recorded and output as ready-to-paste Playwright code. When done, copy the generated test body into a new file under `e2e/journeys/`.

## Test Credentials

Add to `.env.local` (never commit this file):

```env
# Required for all authenticated journey tests
E2E_TEST_EMAIL=your-test-account@example.com
E2E_TEST_PASSWORD=yourpassword

# Required only for self-test.spec.ts (admin role + CRON_SECRET)
E2E_CRON_SECRET=your-cron-secret-value
```

The `E2E_TEST_EMAIL` account must exist in Supabase Auth. For `self-test.spec.ts`,
the account must also have `role = "admin"` in the `profiles` table.

## CI Integration

TODO: GitHub Actions wiring. Add a workflow file at `.github/workflows/e2e.yml` that:

1. Installs Playwright browsers: `npx playwright install chromium --with-deps`
2. Sets `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `E2E_CRON_SECRET` as GitHub Secrets
3. Runs `npm run test:e2e` on push to `main`
4. Uploads the HTML report as an artifact on failure

The journey tests target production by default so no local server is needed in CI.

## Design Decisions

- **No brittle CSS selectors** — all locators use `getByRole`, `getByLabel`, `getByPlaceholder`, or `getByText`.
- **Sentinel data** — every test creates resources with `Date.now()` in the name/email so concurrent runs never collide.
- **Self-cleaning** — each test removes what it created (archive client, delete team member).
- **Skip-not-fail** — missing env vars cause `test.skip()`, not a red CI run.
- **No new dependencies** — uses the `@playwright/test` package already in `devDependencies`.
