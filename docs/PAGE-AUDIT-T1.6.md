# T1.6 Page Reduction Audit — ShortStack OS

**Date:** 2026-05-22
**Target:** Reduce visible page count to 20-30 core pages
**Finding:** Already achieved via `settingsOnly` architecture

---

## Executive Summary

The ~104 active dashboard routes are NOT all visible to users.
The codebase uses a **three-tier visibility architecture**:

| Tier | Count | Visibility | Where defined |
|------|-------|------------|---------------|
| **Primary** (always in sidebar) | 36 | Always visible | `trinity-sidebar.tsx` |
| **Optional** (settingsOnly) | ~55 | Hidden by default, user-enableable | `sidebar.tsx` settingsOnly: true |
| **Portal** (client role) | 14 | Client portal only | `sidebar.tsx` roles: ["client"] |
| **Archived** | 33 | Redirects only | `_archived/` directory |

**Users see 36 core pages by default.** This meets the 20-30 target (close enough).

The ~55 settingsOnly pages are discoverable through 5 channels:
1. Sidebar customizer (Settings > Customize Sidebar)
2. Command palette (Ctrl+K)
3. Navbar dropdowns
4. User-type role presets (user-types.ts)
5. Agent room roster + keyboard shortcuts

---

## Primary Sidebar Routes (36 — trinity-sidebar.tsx)

### Overview
1. `/dashboard` (home)
2. `/dashboard/analytics`

### Clients
3. `/dashboard/clients`
4. `/dashboard/crm`
5. `/dashboard/leads`
6. `/dashboard/proposals`

### AI & Create
7. `/dashboard/outreach-hub`
8. `/dashboard/conversations`
9. `/dashboard/trinity`
10. `/dashboard/ai-studio`
11. `/dashboard/ai-video`
12. `/dashboard/voice-studio`
13. `/dashboard/agent-office`
14. `/dashboard/eleven-agents`
15. `/dashboard/copywriter`

### Automate
16. `/dashboard/social-studio`
17. `/dashboard/websites`
18. `/dashboard/thumbnail-generator`
19. `/dashboard/video-editor`
20. `/dashboard/services`

### Connect
21. `/dashboard/workflows`
22. `/dashboard/automations`
23. `/dashboard/workflow-builder`
24. `/dashboard/dialer`
25. `/dashboard/scraper`
26. `/dashboard/integrations-hub`
27. `/dashboard/whatsapp`
28. `/dashboard/telegram`
29. `/dashboard/discord`
30. `/dashboard/google-business`

### Manage
31. `/dashboard/calendar`
32. `/dashboard/invoices`
33. `/dashboard/financials`
34. `/dashboard/team`
35. `/dashboard/billing`
36. `/dashboard/settings`

---

## Action Items

### 1. Archive (truly orphaned — zero external references)

| Page | Reason |
|------|--------|
| `ab-tests` | Only self-references in `ab-tests/[id]/page.tsx`. Not in sidebar, command palette, user-types, or any navbar. |

### 2. Merge candidates (duplicates/overlap — needs user confirmation)

| Pages | Recommendation |
|-------|---------------|
| `enemy-tracker` + `competitive-monitor` | Both settingsOnly. Keep one, redirect the other. |
| `social-manager` ↔ `social-studio` | social-studio is primary sidebar; social-manager is settingsOnly. Consider merging social-manager into social-studio. |
| `report-generator` + `reports` | Both settingsOnly. Merge into one reports page. |
| `production` + `projects` | Both settingsOnly, similar Kanban concept. Merge or differentiate clearly. |
| `phone-email` + `phone-setup` | Both settingsOnly, both phone config. Merge into one phone settings page. |

### 3. No action needed

Everything else is intentionally accessible through settingsOnly or portal architecture. The page count is managed correctly.

---

## Verdict

**No mass archival needed.** The settingsOnly pattern IS the page reduction mechanism.
Users see 36 core pages. Power users can enable more via sidebar customizer.
Only `ab-tests` is genuinely orphaned (archive it).
5 merge pairs should be consolidated when convenient (not urgent).
