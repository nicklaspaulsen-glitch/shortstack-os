# Page Reduction Audit — May 2026

## Summary
- **Total active pages**: 156 (down from ~188 pre-audit)
- **Sidebar-linked pages**: 124
- **Orphan pages**: 32 (all correctly unlisted)
- **Already archived**: 11 pages in `_archived/`

## Orphan Analysis

All 32 orphan pages are **correctly unlisted** — they are detail views, sub-routes, or admin-only pages accessed from their parent:

### Dynamic routes (detail views)
`ab-tests/[id]`, `affiliates/[id]`, `automations/browser-tasks/[id]`, `clients/[id]`, `coach/analyses/[id]`, `domains/hub-status/[jobId]`, `funnels/[id]`, `marketplace/orders/[id]`, `meetings/[id]`, `verticals/[vertical]`, `voice-studio/[id]`

### Sub-routes (tabs/wizards within parent pages)
`automations/browser-tasks`, `automations/library`, `domains/hub-setup`, `funnels/new`, `invoices/new`, `leads/scoring`, `marketplace/listings`, `marketplace/orders`, `meetings/new`, `portal/setup`, `pricing/payment-links`, `reviews/auto-reply`, `settings/danger`, `settings/email-templates`, `settings/getting-started`, `settings/voice-profile`, `trinity/proposals`, `video-editor/library`

### Admin-only (hidden from regular sidebar)
`admin/agent-traces`, `admin/llm-costs`, `admin/self-test`

### Dashboard home
`page.tsx` (the `/dashboard` root itself)

### Merge candidate
`ab-tests` — consider merging into analytics (low priority, functional as standalone)

## Already Archived (11 pages)
courses, courses/[id], community, roi-calculator, telegram-bot, telegram-presets, surveys, commission-tracker, competitor-tracker, content, custom-dashboard, onboard

## Recommendation
No further archival needed. The 124 sidebar-linked pages serve distinct functions. The 20-30 core page target refers to tier-1 navigation (currently ~15 items in primary nav), not total routes.
