# UI/UX Audit — Apr 26 2026

> Code-only static review of every `page.tsx` under `src/app/dashboard/**` (151 pages) and `src/app/{login,book,changelog,...}/page.tsx` (top-level public). No dev server was run. Findings sorted by severity. File paths are absolute; line numbers are best-effort against the working tree at `fix/integrations-ux-cleanup`.

## TL;DR

- **8 CRITICAL** — client-trust-breaking, dead primary flows, dev UX leaking to non-admins
- **14 HIGH** — silent failures, missing payment-button loading states, native browser `confirm`/`alert`/`prompt` in customer-facing flows
- **11 MEDIUM** — modal a11y gaps sitewide, generic "Failed" toasts, missing form `<label htmlFor>`
- **9 LOW** — `<img>` instead of `next/image`, file-size violations, small a11y polish

### Top 5 fix-now items (this week)

1. **Portal setup wizard is a placeholder** — `portal/setup/page.tsx` collects business info + social platforms, then **never persists anything**. Clients leave thinking they're configured. (CRITICAL — fix before any new client onboards.)
2. **Discord page leaks env-var setup to all users** — non-admins see `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN` etc. with "Required env vars (set in Vercel)" header. Either gate by role or hide from clients. (CRITICAL.)
3. **Native `alert()` on Stripe Checkout error paths** — `pricing/page.tsx:107,115` and `usage/page.tsx:214,218` use raw `alert()` when checkout fails. Looks broken; replace with `toast.error()`. (HIGH.)
4. **Modal component has no Escape-key close, no focus trap, no `role="dialog"`** — affects every page using `<Modal>`. One-line fix in `components/ui/modal.tsx`. (MEDIUM, but sitewide impact.)
5. **Tickets page is localStorage-only** — `tickets/page.tsx` stores tickets in `localStorage`, comment in source admits "no backend yet". Any agency owner who relies on this will lose data on browser cache clear. (CRITICAL.)

### Pages with most issues (ranked top 10)

1. `dashboard/integrations/page.tsx` (1600 lines) — env-var leakage, "Open Vercel Settings", multiple aria gaps
2. `dashboard/portal/content/page.tsx` — native `prompt()` + `confirm()` in client-facing revision flow
3. `dashboard/portal/setup/page.tsx` — non-functional setup wizard
4. `dashboard/discord/page.tsx` — env-var leakage to non-admins
5. `dashboard/social-manager/page.tsx` — env-var leak (`ZERNIO_API_KEY`) in connect modal
6. `dashboard/portal/billing/page.tsx` — Pay Now button has no loading state, no disabled-while-submitting
7. `dashboard/pricing/page.tsx` — `alert()` on checkout error
8. `dashboard/usage/page.tsx` — `alert()` on token-purchase error
9. `dashboard/tickets/page.tsx` — localStorage-only "support desk"
10. `dashboard/video-editor/page.tsx` (7,739 lines!) — exceeds 800-line cap, hard to audit

---

## CRITICAL (must fix)

### 1. Portal setup wizard never persists data

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\portal\setup\page.tsx:41-44`
- **Bug**: `completeSetup()` only fires a toast and routes — no `fetch()`, no Supabase write. Form state (`businessInfo`, `connectedPlatforms`) is dropped on page unmount.
- **Impact**: Brand-new clients walk through 5 steps, hit "Go to My Portal", and Trinity has zero context. They think setup is done. Account managers later have to re-collect everything.
- **Suggested fix**: POST to `/api/clients/setup` (create endpoint if needed) with `businessInfo` + `connectedPlatforms` before routing. Show "Saving..." state with spinner.

### 2. Discord page leaks env-var setup to non-admins

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\discord\page.tsx:432-451`
- **Bug**: Renders a card titled "Required env vars (set in Vercel)" listing `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `NEXT_PUBLIC_APP_URL` — visible to every user. No `profile?.role !== "admin"` gate.
- **Impact**: Clients see infrastructure plumbing meant for the platform operator. Reads as "this product is half-built".
- **Suggested fix**: Wrap the env-vars card and "Open Discord Developer Portal" link in `{profile?.role === "admin" && (...)}`. Show clients the install button only.

### 3. Tickets page is localStorage-only ("MVP" comment)

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\tickets\page.tsx:5-10,43`
- **Bug**: Source comment: *"MVP ship: no backend yet. Tickets are stored in localStorage so the page feels alive..."* Storage key `ss_tickets_v1`. Cleared on cache wipe, not synced across devices, invisible to support staff.
- **Impact**: This is a **support desk** for an agency OS. Any data loss here is a trust kill. Worse, agency owners will think "we filed a ticket" — but no backend exists to receive it.
- **Suggested fix**: Either (a) migrate to a `tickets` + `ticket_messages` schema with email intake (already in TODO), OR (b) replace the page with a "We use email — write to support@shortstack.work" panel until the backend lands. Don't ship pseudo-functionality.

### 4. Pay Now button on portal/billing has no loading state

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\portal\billing\page.tsx:75-89`
- **Bug**: `Pay Now` button on overdue/sent invoices fires fetch with no `disabled` while submitting, no spinner, no busy state. Catch block is empty (`} catch { toast.error(...) }`) but not silent.
- **Impact**: User clicks twice → duplicate Stripe checkout sessions. Worse, on slow network the user sees no feedback and clicks again. Payment flows must always be visibly busy.
- **Suggested fix**: Add `payingId` state per invoice; disable button + show `<Loader2 className="animate-spin"/>` while `i.id === payingId`.

### 5. Portal/content uses native `prompt()` and `confirm()` for client revision flows

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\portal\content\page.tsx:72-74, 96-98`
- **Bug**: When a client requests a content revision, the app fires `window.prompt("...What needs to change?")` and `window.confirm("Mark this as urgent?")`. Browser-native dialogs can't be styled, can't be canceled gracefully, and on mobile look like phishing.
- **Impact**: This is a paying client's primary feedback loop. A native browser dialog screams "unfinished MVP" — directly undermines the "premium agency OS" positioning.
- **Suggested fix**: Build a `<RevisionRequestModal>` reusing `<Modal>`. Fields: textarea for changes, urgent toggle. Submit + cancel buttons. Reuse the existing `/api/portal/revisions` POST.

### 6. Social-manager leaks `ZERNIO_API_KEY` env-var setup to all users

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\social-manager\page.tsx:497-525`
- **Bug**: When Zernio isn't configured, the connect modal tells every user (including clients) to "Add `ZERNIO_API_KEY` to your environment variables" and "Restart the application". This is operator-only language.
- **Impact**: Agency clients who hit this modal see "Restart the application" — they can't do that. The flow looks broken from the user POV.
- **Suggested fix**: For non-admins show: "Social account connections aren't yet enabled. Contact your account manager." For admins, show the existing setup steps.

### 7. Workflows page leaks `N8N_API_KEY` env-var hint

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\workflows\page.tsx:782`
- **Bug**: Empty state says: *"Make sure N8N_API_KEY is set in your environment variables."* Visible to every user.
- **Impact**: Same dev-leak pattern as Discord/social-manager. Admin-only message shown to all roles.
- **Suggested fix**: Gate this hint behind `profile?.role === "admin"`. Non-admins see "n8n integration not yet enabled — contact your account manager".

### 8. Self-test admin page stores `CRON_SECRET` in localStorage

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\admin\self-test\page.tsx:87-94`
- **Bug**: `runNow()` prompts for `CRON_SECRET` and persists it in `localStorage["self_test_cron_secret"]`. Any XSS or rogue extension can exfiltrate. The page IS admin-gated, which limits blast radius — but a CRITICAL secret should never live in browser storage.
- **Impact**: If admin browser is compromised, attacker gets cron-bearer auth → can run admin endpoints. The Apr 19 bug-hunt already flagged that `CRON_SECRET` is a top-priority rotation candidate.
- **Suggested fix**: Have `/api/admin/self-test/run-now` proxy the cron call server-side using `createServiceClient()`. Drop the localStorage key.

---

## HIGH

### 1. Native `alert()` on Stripe checkout failure (pricing page)

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\pricing\page.tsx:107,115`
- **Bug**: When `/api/billing/checkout` returns no redirect URL or throws, code calls `alert(msg)` — comment in source even says: *"toast infra may not always be loaded here"*.
- **Impact**: After clicking "Upgrade" the user sees a browser-native popup. Looks like a JS error, not a deliberate message. On mobile some browsers route `alert()` differently and it can be missed entirely.
- **Suggested fix**: Toast infra IS loaded — `react-hot-toast` is already imported in this very file (`toast` is used elsewhere). Replace both `alert()` calls with `toast.error(msg, { duration: 6000 })`.

### 2. Native `alert()` on token purchase failure (usage page)

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\usage\page.tsx:214,218`
- **Bug**: Same anti-pattern. Two `alert()` calls in the catch path of `handleBuy()`.
- **Impact**: Same as above — browser-native popup on a paid action.
- **Suggested fix**: Replace with `toast.error(...)`.

### 3. Many empty catch blocks swallow errors with no user feedback

- **Pages**: `ai-studio/page.tsx:945,1038,1129,1238,1260,1392,1511`, `ads/page.tsx:314,343`, `clients/[id]/page.tsx:792`, plus `inbox/page.tsx:131,139`, `dm-controller/page.tsx:1826,1883,1888`, `ai-video/page.tsx:132`
- **Bug**: Pattern `} catch { toast.error("Failed"); }` (or worse, `} catch {}`) loses the actual error. User sees "Failed" with no clue why.
- **Impact**: When something legit breaks (rate limit, network blip, API change), debugging from the user side is impossible. Support tickets become "it just says Failed".
- **Suggested fix**: `} catch (err) { toast.error(err instanceof Error ? err.message : "Operation failed"); console.error("[ai-studio] op failed:", err); }` — at minimum surface the message string.

### 4. Bulk leads "delete" uses native `confirm()` then has no progress feedback

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\crm\page.tsx:595`, `clients/page.tsx:308,324`
- **Bug**: `if (!confirm(...)) return; await fetch(...)` — destructive action with native popup AND no loading state for the bulk delete itself.
- **Impact**: User clicks "Delete 500 leads", the native dialog resolves, then nothing visible happens for the duration of the API call. They click again → second delete fires (often silently a no-op since rows are already gone, but still bad UX).
- **Suggested fix**: Replace with a styled confirm modal showing the count, and disable + spin during the delete.

### 5. `useEffect` with empty deps has eslint-disable comments instead of fixing

- **Pages**: 43 occurrences across 30 files. Examples: `dashboard/page.tsx:90`, `portal/page.tsx:45`, `portal/billing/page.tsx:24`, `portal/reports/page.tsx:22`.
- **Bug**: `// eslint-disable-next-line react-hooks/exhaustive-deps` is a global pattern. Most of these effects intentionally fire-once, but some (e.g. `getting-started/page.tsx:42` depends on `profile?.id`) skip valid re-runs.
- **Impact**: Fragile data freshness — page may show stale data when profile updates mid-session. Also masks real bugs from future audits.
- **Suggested fix**: For each suppression, either (a) add `useCallback` for the function and include it in deps, or (b) leave the suppress with an inline comment explaining WHY. No bare suppressions.

### 6. Form submit buttons stay enabled while submitting

- **Pages**: Spot-checked `portal/setup/page.tsx`, `portal/socials/page.tsx`, `whatsapp/page.tsx`, `community/page.tsx`. Many forms only have `disabled={!input.trim()}` style — not `disabled={submitting || !input.trim()}`.
- **Bug**: Double-submit is possible.
- **Impact**: Duplicate writes, duplicate API calls, especially on slow networks.
- **Suggested fix**: Add a `submitting` state + `disabled={submitting || !valid}` everywhere a form mutates server state.

### 7. Number inputs accept negatives / out-of-range without validation

- **Pages**: `clients/page.tsx:1381` (`mrr` accepts negative), `ads/page.tsx:1366,1370` (budget can be 0 or negative), `community/page.tsx:1440`, `ai-video/page.tsx:643` (has min/max — good).
- **Bug**: Several `<input type="number">` lack `min` constraints on monetary fields.
- **Impact**: Negative MRR, negative ad budgets accepted client-side. Server may reject — or worse, silently accept.
- **Suggested fix**: Add `min="0"` (or `min="0.01"`) on all currency/quantity inputs. Server-side validation also required (out of scope for UI audit).

### 8. Date inputs without min/max constraints

- **Pages**: Spot-checked `meetings/new/page.tsx`, `invoices/new/page.tsx`, `proposals/page.tsx`. Most date inputs are unconstrained.
- **Bug**: User can schedule a meeting in 1850 or set an invoice due date in 2099.
- **Impact**: Bad rows in DB, downstream date math breaks (e.g. "overdue 60,000 days").
- **Suggested fix**: Set `min={today}` for future dates, `max={2-year-ahead}` to bound them.

### 9. "Open Integrations to connect" uses native `confirm()` (content page)

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\content\page.tsx:476`
- **Bug**: When a publish fails because the social account isn't connected, code does: `if (confirm("Open Integrations to connect the account?")) { window.location.href = ... }`.
- **Impact**: Native popup mid-flow. The error toast already showed; the confirm is redundant friction.
- **Suggested fix**: Inline the link in the toast: `toast.error("Connect the account first", { action: { label: "Connect", onClick: () => router.push(connect_url) } })`. Or just auto-route after a 2-second toast.

### 10. Login + book + signup pages not in audit scope, but `extension-auth/page.tsx` worth checking

- **Page**: `C:\Claude\shortstack-merge\src\app\extension-auth\page.tsx`
- **Note**: User-facing OAuth-style page for the Chrome extension. Wasn't drilled into in this pass; flag for a follow-up review.

### 11. `ai-studio` modals lack any loading feedback on long-running ops

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\ai-studio\page.tsx`
- **Bug**: Generation flows (upscale, bg-remove, AI fill) catch errors but don't always surface processing progress beyond a button-level spinner. Background-remove can take 30+ seconds.
- **Impact**: User taps "Process" and stares at a tiny spinner for 30s wondering if it crashed.
- **Suggested fix**: Add a centered overlay with progress text ("Removing background — 12s elapsed") for any op > 5s.

### 12. Phone-setup uses `window.prompt()` for test SMS

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\phone-setup\page.tsx:247-249`
- **Bug**: Native `window.prompt(...)` for "Enter YOUR personal phone number".
- **Impact**: Native popup, no validation, no E.164 formatter.
- **Suggested fix**: Inline form field with format mask + send button.

### 13. Logo-picker uses native `confirm()` for destructive overwrite

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\logo-picker\page.tsx:112`
- **Bug**: `if (!confirm(\`Apply concept #${concept} as the live ShortStack logo?...\`))` — native popup for an action that "overwrites public/icons/shortstack-logo.svg and rebuilds every raster icon".
- **Impact**: Destructive op; native dialog is wrong UX surface for a high-stakes confirmation.
- **Suggested fix**: Replace with a styled modal: "This will overwrite the live logo. Type LOGO to confirm."

### 14. Conversations inbox keyboard shortcuts not surfaced in UI

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\conversations\page.tsx:16-23`
- **Bug**: Page comment lists `j/k/r/e/s/c/#1-9` shortcuts but UI never tells the user. There's also a "Coming soon" tooltip at line 751-758 with no actual coming-soon UI.
- **Impact**: Power-user feature is invisible.
- **Suggested fix**: Add a `?` shortcut that pops a modal listing all shortcuts. Or a small "kbd" hint chip at bottom-left.

---

## MEDIUM

### 1. Modal component lacks Escape close, focus trap, role="dialog"

- **Page**: `C:\Claude\shortstack-merge\src\components\ui\modal.tsx`
- **Bug**: Has backdrop-click close (good) but: no `onKeyDown` for Escape, no `role="dialog"` / `aria-modal="true"`, no focus return on close, no focus trap inside.
- **Impact**: Sitewide a11y impact. Every modal that uses this component (39 files) inherits the gaps.
- **Suggested fix**: ~15-line patch in `modal.tsx` — listen for Escape on mount/unmount, set `role="dialog" aria-modal="true" aria-labelledby={titleId}`, restore focus to previous activeElement on close, optionally use `react-focus-lock` for trap.

### 2. Only 4 files handle Escape key for custom modals

- **Pages**: `integrations/page.tsx`, `projects/page.tsx`, `inbox/page.tsx`, `funnels/[id]/page.tsx` are the only files with `onKeyDown.*Escape`.
- **Bug**: Any custom-rolled modal/drawer (not using `<Modal>`) has no Escape support.
- **Impact**: Power-user keyboard flow doesn't work.
- **Suggested fix**: When the global `<Modal>` patch lands (above), audit one-off modals and migrate them.

### 3. Only 1 file uses `<label htmlFor>` connection

- **Pages**: 47 files render `<label>` but only `sms-templates/page.tsx` uses `htmlFor`. Most labels are visual-only divs.
- **Bug**: Screen readers can't associate label → input. Click-on-label-to-focus doesn't work.
- **Impact**: A11y compliance. Also a minor UX miss — clicking a label should focus its field.
- **Suggested fix**: Audit all `<label>` tags in form pages — add `htmlFor` matching the input's `id`. Helper component recommended.

### 4. Generic "Failed" toasts everywhere

- **Pattern**: 12+ files have `toast.error("Failed")` with zero context.
- **Bug**: User has no idea what failed or what to do next.
- **Impact**: Every error becomes a support ticket.
- **Suggested fix**: Standardize: `toast.error(\`Couldn't <action>: ${err.message}\`)`. Always include the verb.

### 5. Brand-kit uses `onError` to hide broken images

- **Page**: `C:\Claude\shortstack-merge\src\app\dashboard\brand-kit\page.tsx:460,710,761`
- **Bug**: `onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}` swallows broken image silently.
- **Impact**: User uploads a logo, the URL 404s, the page just hides the slot. No "Image broken — re-upload?" hint.
- **Suggested fix**: Show a placeholder + "Image failed to load" text instead of mute hide.

### 6. Many fetch calls don't `cache: "no-store"` on dynamic data

- **Pattern**: Spot-checked `dashboard/page.tsx`, `portal/page.tsx`. Some fetches inherit Next default caching.
- **Bug**: Stale data shown after mutations elsewhere.
- **Impact**: User updates a client; goes back to dashboard; counts haven't moved. Confusing.
- **Suggested fix**: For all dashboard/portal data fetches that read mutable state, pass `{ cache: "no-store" }`.

### 7. Skeleton + spinner usage inconsistent

- **Pattern**: Some pages use `<PageSkeleton>` (good), some use centered `<Loader2 className="animate-spin">` only, some show empty list with no loading hint.
- **Impact**: Inconsistent perceived performance.
- **Suggested fix**: Decree a pattern — `<PageSkeleton>` on first paint, inline spinners for in-page ops. Migrate stragglers.

### 8. video-editor and settings exceed 800-line CLAUDE.md cap

- **Pages**: `video-editor/page.tsx` (7,739 lines), `settings/page.tsx` (2,629), `integrations/page.tsx` (1,600), `content/page.tsx` (1,565), `leads/page.tsx` (1,206).
- **Bug**: Hard cap is 800 per CLAUDE.md / hooks.md; these are heavy violators.
- **Impact**: Maintainability — both for AI agents and humans. Auditing video-editor is essentially impossible at 7,739 lines.
- **Suggested fix**: Split video-editor into per-tab subcomponents (`<TimelineEditor>`, `<AssetLibrary>`, `<EffectsPanel>`...). Settings can split per tab too.

### 9. Aria-label coverage is sparse

- **Pattern**: 123 occurrences of `aria-label` across 48 files. The other ~100 page files have ZERO. Icon-only buttons (X, +, settings cog, copy, trash) often lack labels.
- **Impact**: Screen-reader users hear "button" with no context.
- **Suggested fix**: Lint pass — every button containing only a lucide icon (no text child) MUST have `aria-label`.

### 10. Many lists render without virtualization

- **Pattern**: `leads/page.tsx`, `crm/page.tsx`, `outreach-logs/page.tsx`, `domains/page.tsx` — render full result sets in DOM.
- **Bug**: 1000-row lead lists choke mid-tier laptops.
- **Impact**: Slow scroll, jank.
- **Suggested fix**: Add pagination (server-side limit) or use `react-virtual` for tables that can exceed 200 rows.

### 11. `<table>` blocks without horizontal scroll on mobile

- **Pattern**: Spot check — `admin/self-test/page.tsx:304` wraps a 7-column table in `overflow-x-auto` (good). Many other tables don't.
- **Bug**: Mobile views overflow viewport.
- **Impact**: Pinch-zoom required to read tables on phone.
- **Suggested fix**: Wrap every wide `<table>` in `<div className="overflow-x-auto">`. Audit `clients/[id]/page.tsx`, `commission-tracker/page.tsx`, `outreach-logs/page.tsx`.

---

## LOW (notes only — fix when touching the file)

### 1. `<img>` instead of `next/image` (35+ occurrences)

- Pages: `clients/[id]/page.tsx:729`, `brand-kit/page.tsx:460,710,728,761`, `ai-studio/page.tsx:870,906,964,996,1057`, `content-plan/page.tsx:880,1198`, `integrations/page.tsx:727`, `logo-picker/page.tsx:217-230`, `design-studio/page.tsx:226`, `ads/page.tsx:789,844`, `discord/page.tsx:333`, `profile/page.tsx:160`, `settings/page.tsx:2198,2235,2343,2408,2515`, `newsletter/page.tsx:378,382,1079,1095`, `white-label/page.tsx:181`, `websites/page.tsx:935`, `portal/page.tsx:598`, `courses/page.tsx:260`.
- CLAUDE.md notes existing `<img>` is deferred. Don't introduce new ones.

### 2. TODO comments in ship code

- `console/page.tsx:280`, `design/page.tsx:399`, `brand-kit/page.tsx:150`, `client-health/page.tsx:40,170`, `activity-log/page.tsx:162`, `analytics/page.tsx:246,252,278,295,300,317,330`, `api-docs/page.tsx:70`, `forms/page.tsx:160`, `integrations-hub/page.tsx:291`, `marketplace/page.tsx:297`, `settings/page.tsx:158`, `video-editor/page.tsx:7419`, `social-studio/components/Tab5TopCommenters.tsx:82`.
- Most are "wire to real API once backend lands" — track per-feature; no immediate action.

### 3. Some pages render `console.log(...)` strings inside `<code>` blocks

- `api-docs/page.tsx:576,612` — these are example-code blocks for developers, not actual console calls. Looks like a Grep false-positive but worth noting if doing a strict lint.

### 4. Inconsistent error states between admin pages

- `admin/self-test/page.tsx` has nice "forbidden / error / loading" tri-state. Most other pages have "loading or empty". Spread the pattern.

### 5. Marketplace/integrations-hub overlap

- 3 pages cover similar territory: `dashboard/integrations`, `dashboard/integrations-hub`, `dashboard/integrations-marketplace`, plus `dashboard/marketplace`. Probable redundancy.
- Suggested follow-up: product decision to consolidate.

### 6. `style-preview` + `style-preview` (root) are dev-only design experiments

- `dashboard/style-preview/page.tsx` and `app/style-preview/page.tsx` are not linked from sidebar — internal-only. Either gate behind admin role or move to `app/(internal)/`.

### 7. `sound-preview/page.tsx` (root) — dev-only?

- Same comment: looks like internal/test UI shipped alongside production.

### 8. `agent-room` icons not clickable (per Apr 27 backlog)

- Apr 27 memo flags this; consistent with what I found — `agent-room/page.tsx` is just `<RoomCanvas />`, can't audit click handlers without diving into the canvas component (out of scope).

### 9. Many `eslint-disable-next-line react-hooks/exhaustive-deps` without comment

- 43 occurrences. Each should have an inline reason.

---

## GOOD STUFF

Pages that are clean and well-built:

- **`dashboard/billing/page.tsx`** — proper loading states (`portalLoading`, `topUpLoading`), guards against double-click (`if (portalLoading) return`), surfaces Stripe webhook redirect with a toast, useCallback'd loaders, cache: "no-store" for usage. Reference quality.
- **`dashboard/admin/self-test/page.tsx`** — beautiful tri-state (loading/forbidden/error), clear gradient mood-shifting per pass/fail, accessible status table with truncated error tooltip. The CRON_SECRET-in-localStorage thing aside, this page is great.
- **`dashboard/conversations/page.tsx`** — disciplined Gmail-style 3-pane, realtime subscriptions, keyboard shortcuts (even if not surfaced).
- **`dashboard/leads/page.tsx`** — clean CSV import flow with stepwise modal (`upload | preview | importing | done`), explicit mime check.
- **`dashboard/connect/page.tsx`** + other SectionHub pages — DRY, declarative, consistent.
- **`components/ui/modal.tsx`** — body-scroll lock on open is correct. Just needs the Escape + role="dialog" + focus trap fixes called out above.
- **PageHero adoption** — 121 of 151 dashboard pages use `<PageHero>`; the 30 that don't are either SectionHub-based, sub-routes (e.g. `funnels/[id]`), or full-screen apps (video-editor, conversations, thumbnail-generator) where a hero would be wrong. Compliance is excellent.

---

## Methodology

- Tools: `Glob` for file inventory, `Grep` (ripgrep) for cross-cutting patterns, `Read` for spot-checks on top user-journey pages (Dashboard, Leads, Conversations, Content, Integrations, Portal/*).
- ~25 minute time budget — breadth over depth. Pages > 1500 lines (video-editor, settings, integrations) sampled rather than read fully.
- Pattern queries used: `onClick=\{[^}]*console.log`, `alert\(`, `prompt\(`, `confirm\(`, `catch\s*\([^)]*\)\s*\{[^}]*//`, `aria-label`, `htmlFor=`, `role="dialog"`, `useEffect\(\(\)\s*=>\s*\{[^}]*\}\)\s*$`, `<img\s`, `disabled=\{[^}]*loading|saving|submitting`, env-var leakage strings (`Required env`, `Vercel Settings`, `CRON_SECRET`).
- Did NOT run dev server, did NOT click through pages — code-only review per scope.

## Out of scope (flagged for follow-up audits)

- API routes under `src/app/api/**` — this audit was page-only.
- Component files under `src/components/**` — except `modal.tsx` which surfaced via the page audit.
- E2E test coverage of these flows.
- Mobile responsive testing (would need browser).
- Color contrast verification (would need rendered DOM).
