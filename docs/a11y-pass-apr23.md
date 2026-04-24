# Accessibility Pass — Apr 23, 2026

Scope: tier-1 primitives across the ShortStack OS dashboard targeting WCAG 2.1 AA. Intentionally excluded: video-editor, thumbnail-generator, ai-video, ai-studio, content-library, settings, referrals, report-generator, conversations, logo-picker, clients/*, and all D14-D17 ComingSoon pages.

## 1. What shipped

### SkipToContent component
- New file: `src/components/a11y/SkipToContent.tsx`
- Hidden off-screen by default; becomes visible on keyboard focus (Tab as first interaction). Clicking/Enter jumps to `#main`.
- Mounted once in `src/app/dashboard/layout.tsx` immediately inside `<QuotaWallProvider>` so it is the first tabbable element on every dashboard route.
- Satisfies WCAG 2.4.1 Bypass Blocks.

### Landmarks
- `src/app/dashboard/layout.tsx`
  - Outer right-column `<main>` was repurposed to a `<div>` wrapper (it previously wrapped both the site-level chrome AND the page content, which mixed landmark roles).
  - New semantic `<header>` landmark for the top bar (search, notifications, plan badge, client switcher).
  - New `<main id="main" tabIndex={-1}>` wrapping page `children`. `tabIndex={-1}` lets the skip link programmatically focus the region on activation without making the region part of the normal tab order.
- The `Sidebar` component already uses `<aside>` + `<nav>` landmarks, so no change needed there.

### Focus-visible ring
- `src/app/globals.css` already contained a universal `*:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` rule (line 708). Verified it applies globally to all buttons, links, inputs, and the new skip link's custom ring colors layer on top.
- There is no shared `<Button>` / `<Input>` React primitive in this codebase — the app uses Tailwind utility classes + the `.btn-primary / .btn-secondary / .btn-ghost / .input` classes. Focus-visible behaviour is driven by the global rule, which is the simplest correct implementation for that architecture.
- `.input:focus` also has a custom gold ring via `box-shadow` (line 236-244).

### aria-label additions on icon-only buttons
Added `aria-label` + `aria-hidden="true"` on the icon where missing. Files touched:

| File | Count | What |
|---|---|---|
| `src/app/dashboard/layout.tsx` | 2 | Mobile menu open + close |
| `src/components/notifications.tsx` | 2 | Bell trigger (dynamic unread count), Clear-all |
| `src/components/client-switcher.tsx` | 1 | Close panel |
| `src/components/global-search.tsx` | 1 | Clear query + search input aria-label |
| `src/components/sidebar.tsx` | 2 | Collapse + Expand sidebar |
| `src/app/dashboard/content-plan/page.tsx` | 2 | Calendar prev/next month |
| `src/app/dashboard/leads/page.tsx` | 2 | Modal close buttons (Import CSV, Add Lead) |
| `src/app/dashboard/inbox/page.tsx` | 1 | Close message details |
| `src/app/dashboard/scraper/page.tsx` | 1 | Save current search |
| `src/app/dashboard/websites/page.tsx` | 1 | Close publish dialog |
| **Total** | **15** | |

Also added `aria-haspopup="menu"` + `aria-expanded={open}` on the notifications bell (disclosure pattern).

Icon-only buttons that already had aria-labels were left alone (calendar prev/next week, portal calendar, tickets delete, proposals delete, dm-controller edit rule, discord edit/delete, mail-setup remove, integrations close).

## 2. Color contrast spot-check

Tested five common pairs with WCAG 2.1 AA thresholds (4.5:1 for normal body text, 3:1 for large/bold).

| Pair | Foreground | Background | Ratio | WCAG AA | Notes |
|---|---|---|---|---|---|
| Body text on background | `#e2e8f0` text | `#06080c` bg (dark) | ~15.4:1 | PASS | |
| Muted text on surface | `#64748b` muted | `#0c1017` surface (dark) | ~4.23:1 | **FAIL normal** | Passes 3:1 for non-text UI; fails AA for body copy. Shows up as stat-card captions, timestamps, placeholder text. |
| Accent on background | `#C9A84C` gold | `#06080c` bg (dark) | ~9.4:1 | PASS | |
| Primary button text on gold | `#0a0a0a` ink | `#C9A84C` gold | ~10.5:1 | PASS | |
| Muted text on surface-light | `#64748b` muted | `#131923` surface-light (dark) | ~3.91:1 | **FAIL normal** | Same root cause as above — `var(--color-muted)` is too light for small body text on non-black surfaces. |

Light-theme pair `#6B7280` muted on `#FAFAF7` background is ~4.52:1 (borderline PASS).

### Recommended (not shipped, out of scope)
- Bump `--color-muted` in dark themes from `#64748b` → `#94a3b8` (ratio ~7:1) to comfortably clear AA.
- Leave the light-mode value alone — it passes.
- Re-test all `.stat-label`, `.text-muted`, and `text-[9px] text-muted` consumers after the change — those are the visual risks.

## 3. Form labels

Spot-checked top-bar GlobalSearch input (now has `aria-label="Global search"`). A broader pass on every form would be a tier-2 task: most modal forms use a visible `<label>` + wrapping `<div>` pattern (verified in leads/page.tsx, websites/page.tsx modals), but a handful of inline search boxes and filter inputs across ~40 pages should be swept.

## 4. What was found but NOT fixed

### Excluded paths (hands-off)
- `/dashboard/video-editor`, `/dashboard/thumbnail-generator` (E1)
- `/dashboard/ai-video`, `/dashboard/ai-studio`, `/dashboard/content-library` (E2)
- `/dashboard/settings` (E4)
- `/dashboard/referrals`, `/dashboard/report-generator`, `/dashboard/conversations`, `/dashboard/logo-picker`, `/dashboard/clients/*`
- All `ComingSoon` D14/D15/D16/D17 placeholder pages

### Complex patterns deferred
- **Timeline (`src/components/video-editor/timeline.tsx`)** — excluded by path; drag/drop + keyboard semantics need a dedicated design pass (ARIA for `role="slider"` on playhead, arrow-key scrubbing, region labels).
- **Trinity orb (`/dashboard/trinity`)** — audio/voice UI with animated canvas needs live-region announcements and labels for mic/mute/record controls. Not touched; deserves its own spec.
- **Command palette** (`src/components/command-palette.tsx`) — lazy-loaded, uses listbox pattern. Already has its own focus trap but not audited here.
- **Toast region (`react-hot-toast`)** — verify `aria-live="polite"` is set by the library, and add `role="alert"` for error toasts specifically.

### Color contrast failures flagged (see section 2)
- `--color-muted` is ~4.2:1 on dark surfaces — fails WCAG AA for normal body text. Affects stat-card labels and the app's "quiet" metadata text.

## 5. Suggestions for tier-2

1. **Shared Button/Input primitives.** Create `src/components/ui/button.tsx` + `input.tsx` with a `className` merge util. Centralize `focus-visible:ring-2 focus-visible:ring-offset-2` there and migrate `<button className="btn-primary">` callsites over time.
2. **Input label sweep.** One-time grep: `<input\\b(?![^>]*(?:aria-label|id=))` and associate every hit with either a visible `<label htmlFor>` or `aria-label`. Estimated 30-50 hits across filter bars and modal forms.
3. **Live regions.** Wrap the `<Notifications />` panel in `aria-live="polite"` so new items are announced. Same for `<ManagedClientBanner />` state changes.
4. **Keyboard trap audit** for every overlay modal (Leads Import, Websites Publish, Inbox details). Verify Esc closes and Tab cycles within the modal only.
5. **Prefers-reduced-motion** already honored in globals.css — good. Add a user-level toggle in settings so users can opt in without OS-level config.
6. **Contrast theme preset** — ship a "High contrast" theme option alongside Midnight/Dawn that raises `--color-muted` + `--color-text` to AAA levels.
7. **Automated lint.** Add `eslint-plugin-jsx-a11y` with `recommended` ruleset — catches most icon-only-button regressions at PR time.
