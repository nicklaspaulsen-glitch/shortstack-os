# ShortStack OS — UI Improvement Plan
> Generated: 2026-05-06 | Stack: Next.js 14 + Tailwind + Framer Motion v12 + shadcn/ui
> Brand: OLED dark `#070708` · Indigo `#6366F1` · Satoshi display · Inter body

---

## What shipped in this session (already committed)

| Change | File | Impact |
|---|---|---|
| Stagger entrance on analytics hero scorecard | `analytics/page.tsx` | 4 cells fade+slide in with 70ms stagger |
| Stagger entrance on clients hero scorecard | `clients/page.tsx` | Same pattern — unified feel |
| Spring `layoutId` indicator on AI Studio tool list | `ai-studio/page.tsx` | Indigo bg slides between tools on click |
| Cmd+K global shortcut → sidebar filter | `sidebar.tsx` | `⌘K` / `Ctrl+K` focuses filter from anywhere |

---

## Sidebar — organization + declutter

### What's wrong now
- 80+ nav items is overwhelming even behind tier gates
- Sections (Sales / Create / Visual / Manage) have no visual weight — just text dividers
- Filter placeholder "Filter…" doesn't hint at Cmd+K (now fixed)
- Items like "Tags", "Outreach Logs", "Commissions" feel like edge-case tools buried with daily-use items

### Recommended restructuring

**Tier 1 (always pinned — the 6 daily-use core items):**
Dashboard · Inbox · Clients · Analytics · CRM · Calendar

**Tier 2 (default visible — 10 items max, your weekly workflow):**
Outreach · Lead Finder · Deals · Proposals · AI Copywriter · Social Manager · Content Plan · Video Editor · Brand Kit · Websites

**Tier 3 (collapsed behind "More tools" toggle — everything else):**
All sub-tools, legacy tools, config-adjacent pages

**Section header redesign:**
Replace plain text dividers (`text-[9px] uppercase text-muted`) with subtle pill badges:
```
[Sales]  [Create]  [Visual]  [Manage]
```
Add a thin `border-t border-border-subtle` above each section header with `mt-1` spacing. Currently sections blend into each other visually.

**Quick-access strip (new idea):**
Between tier-1 core items and the rest, add a 3-slot "Pinned" tray where users can drag any tier-2/3 item. Persisted to `sidebar_preferences.pins`. This already exists in the data model — just needs a drag-to-add UI.

---

## Analytics page — per-section improvements

### Hero scorecard (✅ stagger added)
The 4 cells now animate in. Next: add a subtle `↑ 12%` delta badge on MRR and Leads cells when growth is positive. Source: compare `stats.leadsThisMonth` vs `stats.leadsLastMonth` (already in state).

### Zone 1 — Revenue chart
Currently a stacked AreaChart. Declutter idea: add a toggle `Revenue / Deals` so users can focus on one line at a time. The chart already has both `mrr` and `deals` series — just show one by default.

### Zone 2 — Lead volume bar chart
Good as-is. Add: clicking a bar filters the "Recent Activity" feed below to that day. Lightweight — just set a `dayFilter` state.

### Zone 3 — Source pie / Outreach bar
Two charts side-by-side is cluttered on tablet. Stack them on `lg:` breakpoint, add a "View all sources →" link under the pie that opens a full breakdown modal.

### Zone 4 — Churn risk / Team leaderboard / Goals (accordions)
The accordion pattern is perfect. Problem: all three open at once on first load. Fix: default all to `false` (closed). Let the user choose what to look at. One open accordion at a time keeps the page scannable.

### Zone 5 — Scorecard strip at bottom
Already good. Confirm it shows `Revenue Closed` with indigo accent as the hero metric.

### Page-level declutter suggestions
1. Remove the `dateRange` controls from inline to a sticky top-right filter bar — it currently takes up hero space
2. Reduce the 6-cell secondary stat grid (`Total Leads · Active Clients · DMs Sent · Calls Booked · Content Published · Reply Rate`) to 4 by merging or hiding the lowest-use ones behind a "Details" toggle

---

## Clients page — per-section improvements

### Hero scorecard (✅ stagger added)
4 cells animate in. Next: the `Avg Health` cell should pulse red/orange when average drops below 40 — add a subtle `animate-pulse` className conditionally.

### Tab nav (Clients / Contracts / Invoices / Billing)
Good structure. Improvement: add badge counts on tabs so users see at a glance how many contracts are pending, how many invoices are unpaid. Pull from existing state.

### Table view (default)
The `expandedRow` inline expansion is great. Problem: the row expansion panel has 4 tiny sub-cards that are hard to scan on mobile. On desktop, make the expanded row use a 2-col layout (stats left, notes/tags right).

### Card view
Already has `staggerChildren: 0.04` and `whileHover={{ y: -4 }}` — this is polished. The `HealthArc` SVG is a nice detail. Consider adding a color-coded left edge (1px solid) on cards where health < 40 (red) or > 70 (green) — the arc is small and easy to miss.

### Filter bar
Currently 5 separate filter dropdowns (industry / status / tag / MRR range / activity). Collapse these into a single `<Filter />` sheet that slides in from the right. Reduces clutter on the page header.

### Client count + search
`{filteredClients.length} of {clients.length} clients` shown below search — good. Could be more prominent (`text-sm` instead of `text-[10px]`).

---

## AI Studio page — per-section improvements

### Tool list (✅ spring layoutId added)
The indigo background now slides between tools on click. Improvement: add a subtle `active` left-edge indicator (2px solid `#6366F1`) on the active tool row in addition to the background — makes it easier to spot at a glance.

### Guided mode (Wizard)
The 3-step wizard (Intent → Describe → Go) is clean. Improvement: add a progress bar across the top of the wizard card, not just bullets. Currently the steps feel disconnected.

### Tool grid (in Wizard step 1)
9 tools in a 2×3 grid. Add subtle entrance stagger on the grid items — currently they snap in instantly. Pattern: same `staggerChildren: 0.03` as the tool list.

### Category filter (All / Visual / Audio / Utility)
The 3 category pills exist but aren't animated. Add `layoutId="tool-category-bg"` spring indicator between pills — same pattern as what we just added to the tool list.

### Advanced mode (right-rail list + tool panel)
Already good. The tool panel header shows the active tool icon + name — clean. Consider adding `AnimatePresence` around the tool content area so switching tools fades the panel rather than snapping.

### History feed
`JobResult[]` renders at the bottom of each tool panel. Currently raw text. Consider grouping by day with a sticky date divider, and adding a status dot (`●`) in green/orange/red rather than the current text status.

---

## Dashboard home — not in current scope but worth noting
The dashboard home has no scorecard strip. It relies entirely on `<PageHero>` + the existing widget sections. Consider adding a 4-cell strip under the hero: `MRR · Active Clients · Deals This Month · Leads Today` — real-time data, matches the analytics + clients pattern.

---

## Motion system — principles to apply consistently

| Element | Current state | Recommended |
|---|---|---|
| Page hero scorecard cells | No animation (analytics/clients: now fixed) | `staggerChildren: 0.07`, `y: 8 → 0`, `duration: 0.4` |
| Sidebar active pill | `layoutId="sidebar-active-accent"` ✅ | Keep |
| AI Studio tool active | CSS-only instant swap (now fixed with layoutId) | `layoutId="tool-active-bg"`, spring stiffness 380 |
| Category filter pills | CSS-only instant swap | Add `layoutId` spring (next pass) |
| Wizard tool grid | No entrance stagger | Add `staggerChildren: 0.03` (next pass) |
| Tool panel content on switch | Snap | Add `AnimatePresence` `mode="wait"` (next pass) |
| Accordion open/close | `height: 0 → auto`, `opacity: 0 → 1` ✅ | Keep — well done |
| Page route transitions | `MotionPage` cross-fade ✅ | Keep |

**The rule:** every list with > 3 items should have `staggerChildren`. Every "selected item" indicator should use `layoutId`. Every conditional panel should use `AnimatePresence`.

---

## Shannon security scanner — BLOCKED

Shannon requires Docker Desktop to be installed. Current machine does not have it.

To run when Docker is installed:
```bash
npx @keygraph/shannon start \
  --url https://app.shortstack.work \
  --repo C:\Claude\shortstack-merge \
  --output shannon-report.json
```

**Install Docker Desktop:** https://www.docker.com/products/docker-desktop/

Then re-run this plan's "Install Shannon" task.

Known issues to verify manually in the meantime:
- SSRF in `src/app/api/webhooks/trigger/route.ts` — `isPrivateOrInternal()` has a DNS rebinding bypass. Confirmed in May 3 plan, not yet shipped.
- Inbound webhook `src/app/api/webhooks/inbound/route.ts` still uses `CRON_SECRET`. Should use `WEBHOOK_SECRET`.
- Auth on `/api/webhooks/trigger` — no rate limiting.

---

## Prioritized next pass (after this plan)

1. **SSRF fix** in webhook trigger — security, ships in isolation
2. **Clients page** — filter sheet + health pulse animation
3. **Analytics page** — delta badges on scorecard cells, accordion default-closed
4. **AI Studio** — AnimatePresence tool panel switch + category pill layoutId
5. **Sidebar** — section header redesign (pill badges + border-t)
6. **Dashboard home** — 4-cell scorecard strip
7. **Shannon scan** — pending Docker Desktop install

---

*Plan generated by Claude. All code changes in this session are already committed to main and deploying to Vercel.*
