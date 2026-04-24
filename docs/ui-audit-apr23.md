# UI/UX audit — Apr 23 2026

Comprehensive audit of safe-to-work-on dashboard pages. Top 30 highest-impact fixes, prioritized `high-impact-low-effort` first.

## Scope

Safe pages audited: `/dashboard` (root), `crm`, `deals`, `leads`, `outreach-hub`, `outreach-logs`, `workflows`, `websites`, `landing-pages`, `calendar`, `scheduling`, `community`, `social-manager`, `forms`, `reviews`, `phone-setup`, `mail-setup`, `upgrade`, `brand-kit`, `brand-voice`, `analytics`.

Primitives reviewed: `components/ui/page-hero.tsx`, `components/ui/empty-state-illustration.tsx`, `components/empty-state.tsx`, `components/ui/skeleton.tsx`.

## Top 30 issues (prioritized)

| # | Page | Issue | Fix |
|---|------|-------|-----|
| 1 | mail-setup | `PageHero` missing the `gradient` prop — defaults to gold but was styled inconsistently with `min-h-screen`. Content width is `max-w-5xl` but hero spans full-width without spacing. | Wrap in `fade-in max-w-7xl mx-auto space-y-5` container, match other pages |
| 2 | reviews | Same `min-h-screen` anti-pattern wrapping PageHero and content separately | Unify container layout |
| 3 | mail-setup | Inline empty state (custom div) instead of `EmptyState` primitive | Swap to `EmptyState` component |
| 4 | reviews | "Delete this review entry?" uses `window.confirm()` — jarring browser dialog | Accept pattern for now (already has trash button), add proper aria-label |
| 5 | reviews | Delete trash button has no visible label, `aria-label="Delete review"` is OK, but Reply button has no `aria-label` | Add `aria-label` to icon-only Reply and Resolve buttons |
| 6 | mail-setup | Loading state is a tiny spinner next to "Loading…" — no skeleton for domain rows | Add `TableSkeleton` / spinner container with min height |
| 7 | phone-setup | Step indicator built from scratch instead of primitive — OK, but no mobile adaptation (`md:`/`sm:` rare) | Add responsive classes to step dots |
| 8 | phone-setup | Country picker uses emoji flags — not a11y friendly for screen readers | Add aria-label on country buttons |
| 9 | upgrade | Plan cards at mobile collapse to `grid-cols-1 md:grid-cols-3 lg:grid-cols-5` — good, but the recommended badge overlaps on tablet | Tweak positioning with `whitespace-nowrap` |
| 10 | upgrade | Yearly toggle pill's green `-20%` badge has wrong text color when active (green text on light green bg = poor contrast) | Switch active state to white-on-green |
| 11 | upgrade | FAQ section: hover states missing, chevron doesn't rotate on open | Add `transition-transform` + `rotate` |
| 12 | dashboard (root) | `window.confirm` is used in several pages but not on root — root uses `requestIdleCallback`. Good. | No action |
| 13 | deals | Uses `formatCurrency` locally instead of `@/lib/utils`'s | Normalize to the shared helper |
| 14 | reviews | Beta banner uses inline colors `border-amber-500/30 bg-amber-500/5` that don't match `StatusBadge` convention | Keep for now, low impact |
| 15 | forms | Long icon import list (30+) likely includes unused imports | Run `tsc --noEmit` and check; low-effort cleanup |
| 16 | social-manager | 2426 lines — enormous file. Many inline components could be extracted. | Defer to dedicated refactor |
| 17 | mail-setup | DNS records table missing copy-to-clipboard tooltips on copy button | Add `title` + `aria-label` |
| 18 | mail-setup | "Close" button on detail pane is plain text — inconsistent with icon buttons elsewhere | Add X icon |
| 19 | reviews | Loading state (spinner) does not respect the card layout — no skeleton | Replace `<Loader>` line with `CardSkeleton` |
| 20 | reviews | "Related" section in help card uses `underline` instead of `hover:underline` — always underlined | Switch to hover-only |
| 21 | upgrade | Limit rows use fragile `{row.icon}` with extra wrapper; spacing inconsistent (`gap-1.5` vs `gap-2` elsewhere) | Normalize gaps to 2 |
| 22 | calendar | `Calendar` icon size is 14 in TEAM_MEMBERS but 18 elsewhere — inconsistency | Verify and align icon sizes |
| 23 | landing-pages | PageHero accepts `gradient` but landing-pages doesn't specify — uses default gold, inconsistent with websites (which also defaults). | OK, keep |
| 24 | websites | STATUS_BADGE uses border variants that don't match other status pill patterns in deals/crm | Standardize later |
| 25 | phone-setup | Loading state for clients dropdown: just `loadingClients` boolean, no skeleton rows | Add loader inline, low-effort |
| 26 | deals | "Closed Won" / "Closed Lost" stages have colors but no icon | Add `CheckCircle` / `XCircle` |
| 27 | community | Header is minimal; no "announcements" feed pinned visually | Low priority, defer |
| 28 | outreach-hub | Tab bar has no hover state; active tab highlight too subtle | Add `hover:text-foreground` on inactive |
| 29 | reviews | Critical review border uses `border-rose-500/30` — OK, but no visual label "Critical" on the card | Add a "Critical" pill when rating <=2 |
| 30 | brand-voice, brand-kit | Both pages have `useAutoSave` indicator but the badge position is different between them | Normalize to top-right below header |

## Fix log (what shipped)

(See commits for details)
