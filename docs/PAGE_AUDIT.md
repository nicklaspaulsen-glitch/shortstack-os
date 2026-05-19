# Dashboard Page Audit — May 2026

**Goal:** Reduce from ~164 active routes to 20–30 core pages.

---

## Summary

| Category | Count |
|---|---|
| Total non-archived `page.tsx` | 164 |
| Already in `_archived/` | 22 |
| **True orphans** (no sidebar link) | **8** |
| Sidebar-linked merge candidates | 6 |

---

## TRUE ORPHANS — not linked from sidebar, safe to move to `_archived/`

These pages have a `page.tsx` but zero entry in `src/components/sidebar.tsx`.
They are currently unreachable from the UI. Safe to archive once confirmed.

| Route | Merge target / Action |
|---|---|
| `/dashboard/ab-tests` | Merge into `/dashboard/analytics` (A/B data tab) |
| `/dashboard/agent-controls` | Merge into `/dashboard/agent-office` |
| `/dashboard/agent-desktop` | Merge into `/dashboard/agent-office` |
| `/dashboard/commission-tracker` | Merge into `/dashboard/affiliates` |
| `/dashboard/surveys` | Merge into `/dashboard/forms` |
| `/dashboard/tags` | Settings > CRM tab or `/dashboard/crm` |
| `/dashboard/telegram-presets` | Merge into `/dashboard/telegram-bot` |
| `/dashboard/triggers` | Settings > Automations or `/dashboard/automations` |

---

## SIDEBAR-LINKED MERGE CANDIDATES — in nav but redundant

These ARE reachable but duplicate or overlap with another page.

| Route | Duplicate of | Action |
|---|---|---|
| `/dashboard/competitive-monitor` | `_archived/competitor-tracker` | Keep one, archive the other. `/competitive-monitor` is newer. |
| `/dashboard/telegram-bot` | `/dashboard/telegram-presets` (orphan) | Absorb presets into bot page; merge as `/dashboard/telegram` |
| `/dashboard/affiliates` | `/dashboard/commission-tracker` (orphan) | Absorb commission into affiliates; keep `/dashboard/affiliates` |
| `/dashboard/scraper` + `/dashboard/monitor` | Feature overlap | Hide behind feature flag or merge into `/dashboard/leads` |
| `/dashboard/forms` | `/dashboard/surveys` (orphan) | Absorb surveys into forms |

---

## PLACEHOLDER-ONLY PAGES — no real data, not product-critical

These exist in the sidebar but ship no real feature yet.

| Route | Status | Action |
|---|---|---|
| `/dashboard/community` | Placeholder | Redirect → coming-soon or archive |
| `/dashboard/courses` | Placeholder | Redirect → coming-soon or archive |
| `/dashboard/marketplace` | Stub | Redirect → coming-soon or archive |
| `/dashboard/productions` | Stub | Evaluate and archive if not in active dev |

---

## CORE KEEP LIST (26 routes — hits the 20–30 target)

### Top-level navigation
1. `/dashboard` — home
2. `/dashboard/analytics`
3. `/dashboard/clients` + `/dashboard/clients/[id]`
4. `/dashboard/ai-studio`
5. `/dashboard/ai-video`
6. `/dashboard/voice-studio`
7. `/dashboard/conversations`
8. `/dashboard/outreach-hub`
9. `/dashboard/crm`
10. `/dashboard/websites`
11. `/dashboard/landing-pages`
12. `/dashboard/social-studio`
13. `/dashboard/calendar`
14. `/dashboard/workflows`
15. `/dashboard/automations`
16. `/dashboard/billing`
17. `/dashboard/settings`
18. `/dashboard/team`
19. `/dashboard/integrations-hub`
20. `/dashboard/agent-office`
21. `/dashboard/trinity`
22. `/dashboard/proposals`
23. `/dashboard/invoices`
24. `/dashboard/leads`
25. `/dashboard/portal`
26. `/dashboard/dialer`

---

## NEXT STEPS

1. **Confirm orphan list above** — reply with "archive orphans" and I'll move all 8 to `_archived/`.
2. **Confirm placeholder redirects** — reply with "redirect placeholders" and I'll add 301s.
3. **Sidebar cleanup** — remove dead entries for anything archived.

This is an audit only — no files have been moved yet.
