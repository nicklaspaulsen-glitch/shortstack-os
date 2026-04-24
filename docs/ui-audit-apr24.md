# UI/UX Audit — April 24 2026

**Scope:** 20 safe dashboard pages  
**Auditor:** Claude Sonnet 4.6 (automated agent)  
**Criteria:** Empty states · Loading skeletons · aria-labels · PageHero subtitle quality · CTA clarity · Status pill consistency · Mobile breakpoints

---

## Summary of Fixes Applied

| # | Page | File | Issue | Status |
|---|------|------|-------|--------|
| 1 | Leads | `dashboard/leads/page.tsx` | Raw `<h1>` instead of `PageHero` — inconsistent with all other pages | **FIXED** — replaced with `PageHero` incl. gradient, icon, subtitle, and action buttons moved in |
| 2 | Leads | `dashboard/leads/page.tsx` | Icon-only action buttons (Phone/Mail/MessageSquare per-row) missing `aria-label` | **FIXED** — added `aria-label="Call lead"` etc. |
| 3 | Calendar | `dashboard/calendar/page.tsx` | Page-level spinner (`animate-spin` Loader) instead of skeleton | **FIXED** — replaced with `<TableSkeleton rows={4} />` |
| 4 | Calendar | `dashboard/calendar/page.tsx` | "New Event" CTA floated below hero in a separate div — weak prominence | **FIXED** — moved into `PageHero` actions |
| 5 | Calendar | `dashboard/calendar/page.tsx` | Filter button missing `aria-label` | **FIXED** — `aria-label="Toggle calendar filters"` |
| 6 | Calendar | `dashboard/calendar/page.tsx` | Subtitle too brief | **FIXED** — expanded to mention Google/Outlook sync + AI conflict detection |
| 7 | Scheduling | `dashboard/scheduling/page.tsx` | Full-page spinner instead of skeleton | **FIXED** — replaced with `<PageSkeleton />` |
| 8 | Scheduling | `dashboard/scheduling/page.tsx` | Weak subtitle | **FIXED** — now describes booking pages, smart availability, client prep cards |
| 9 | Deals | `dashboard/deals/page.tsx` | Kanban inline spinner instead of skeleton | **FIXED** — replaced with `<TableSkeleton rows={3} />` |
| 10 | Deals | `dashboard/deals/page.tsx` | Delete button in kanban card icon-only, no `aria-label` | **FIXED** — `aria-label={\`Delete deal: ${deal.title}\`}` |
| 11 | Deals | `dashboard/deals/page.tsx` | Weak subtitle | **FIXED** — now mentions drag-drop kanban, revenue forecasting, commission tracking |
| 12 | Websites | `dashboard/websites/page.tsx` | Project delete (Trash2) and regenerate buttons icon-only, no `aria-label` | **FIXED** — added contextual labels |
| 13 | Workflows | `dashboard/workflows/page.tsx` | Four icon-only buttons missing `aria-label` (Trash2, Eye, RotateCcw, clear preview) | **FIXED** — added descriptive labels to all four |
| 14 | Community | `dashboard/community/page.tsx` | Weak subtitle ("Discussions, resources & events for Trinity.") | **FIXED** — expanded to describe value prop clearly |
| 15 | Forms | `dashboard/forms/page.tsx` | Weak subtitle ("Lead capture forms that flow into CRM.") | **FIXED** — now mentions drag-drop editor, AI, embed, CRM flow |
| 16 | Social Manager | `dashboard/social-manager/page.tsx` | Full-page spinner instead of skeleton | **FIXED** — replaced with `<PageSkeleton />` |
| 17 | Social Manager | `dashboard/social-manager/page.tsx` | Weak subtitle ("Post everywhere at once. AI plans, writes, and schedules for you.") | **FIXED** — clearer value prop with approve step mentioned |
| 18 | CRM | `dashboard/crm/page.tsx` | Weak subtitle | **FIXED** — now mentions contact database, activity log, AI enrichment, bulk actions |
| 19 | Brand Kit | `dashboard/brand-kit/page.tsx` | Weak subtitle ("Extract colors, fonts & logos from any URL.") | **FIXED** — expanded to include auto-apply across client assets |
| 20 | Dashboard Root | `dashboard/page.tsx` | Full-page spinner (`dashboardLoading`) instead of skeleton | **FIXED** — replaced with `<PageSkeleton />` |
| 21 | Outreach Hub | `dashboard/outreach-hub/page.tsx` | Delete campaign button (Trash2 only) missing `aria-label` | **FIXED** — `aria-label={\`Delete campaign: ${campaign.name}\`}` |
| 22 | Outreach Hub | `dashboard/outreach-hub/page.tsx` | Remove custom sequence step button icon-only, no `aria-label` | **FIXED** — `aria-label="Remove this step"` |

---

## Pages Audited — No Changes Needed

| Page | File | Finding |
|------|------|---------|
| Analytics | `dashboard/analytics/page.tsx` | No page-level spinner; subtitle adequate; buttons have text labels |
| Phone Setup | `dashboard/phone-setup/page.tsx` | Spinners inline only (pipeline steps, button states); subtitle clear |
| Mail Setup | `dashboard/mail-setup/page.tsx` | Spinners inline only (button states); subtitle clear |
| System Status | `dashboard/system-status/page.tsx` | RefreshCw spinner is intentional UI; subtitle descriptive |
| Download | `dashboard/download/page.tsx` | No loading state needed; subtitle adequate |
| Upgrade | `dashboard/upgrade/page.tsx` | Button-level spinner only; subtitle adequate |

---

## Pre-Existing TypeScript Errors (NOT introduced by this audit)

The following TSC errors existed before this audit and are unrelated to touched files:

- `commission-tracker/page.tsx(352)` — `Property 'type' does not exist`
- `roi-calculator/page.tsx(195)` — `Property 'suffix'/'prefix' does not exist`
- `settings/page.tsx(839, 864)` — `plan_tier` type mismatch (`null` vs `undefined`)

**All 22 changes pass `npx tsc --noEmit` cleanly** (no new errors introduced).

---

## Deferred / Out-of-Scope

| Item | Reason |
|------|--------|
| Empty state illustrations in scheduling (booking pages tab) | Already has `EmptyState` with CTA — uses simpler variant but functional |
| Empty state in calendar "no events" day cell | Inline inline text already present (`"No events"`) |
| Mobile breakpoint additions | Existing responsive classes adequate; no regressions observed |
| Status pill standardization across all pages | Would require cross-page refactor — flagged for dedicated sprint |
| Pages on exclusion list (video-editor, ai-studio, settings, referrals, etc.) | Not touched per audit spec |

---

## Files Changed

```
src/app/dashboard/page.tsx
src/app/dashboard/leads/page.tsx
src/app/dashboard/calendar/page.tsx
src/app/dashboard/scheduling/page.tsx
src/app/dashboard/deals/page.tsx
src/app/dashboard/websites/page.tsx
src/app/dashboard/workflows/page.tsx
src/app/dashboard/community/page.tsx
src/app/dashboard/forms/page.tsx
src/app/dashboard/social-manager/page.tsx
src/app/dashboard/crm/page.tsx
src/app/dashboard/brand-kit/page.tsx
src/app/dashboard/outreach-hub/page.tsx
docs/ui-audit-apr24.md
```
