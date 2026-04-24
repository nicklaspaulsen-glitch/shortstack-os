# A11y Pass — Apr 24, 2026

## Summary

WCAG 2.1 AA foundational pass across the safe dashboard pages. No breaking changes.

---

## What Shipped

### 1. Skip-to-content link (`src/components/a11y/SkipToContent.tsx`)
- Added named export `SkipToContent` (keeps `export default` for back-compat).
- Matches spec: `sr-only` at rest, `focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999]` on focus with blue ring.
- Imported into `src/app/dashboard/layout.tsx` and placed before sidebar.
- `<main id="main">` added to the layout's `<main>` element (WCAG 2.4.1 bypass block).

### 2. Focus-visible ring on buttons & inputs (`src/app/globals.css`)
- No `src/components/ui/button.tsx` / `input.tsx` — project uses CSS utility classes.
- Added `:focus-visible` ring (`0 0 0 2px background, 0 0 0 4px #3b82f6`) to all `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`, and bare `button` / `[role="button"]` selectors (WCAG 2.4.7).
- `.input:focus-visible` now includes the blue offset ring in addition to the existing gold accent border.

### 3. Aria-labels on icon-only buttons — **22 labels added**

| Page | Buttons fixed |
|------|--------------|
| `/dashboard/crm` | Clear filters (badge), Close filters, Clear search, Clear selection, Send email (card), Send SMS (card), Call lead (card), Close detail panel, Remove tag — **9** |
| `/dashboard/forms` | Move field up, Move field down, Remove field — **3** |
| `/dashboard/scheduling` | Edit meeting type, Close link generator, Close dialog — **3** |
| `/dashboard/calendar` | Mark complete, Remove event — **2** |
| `/dashboard/outreach-hub` | Copy template, Delete template — **2** |
| (others) | No purely icon-only buttons found without context — **0** |

### 4. Form label audit — **11 aria-labels added**

| Page | Inputs fixed |
|------|-------------|
| `/dashboard/crm` | Search leads, Min/max rating, Min/max lead score, Filter from/to date — **6** |
| `/dashboard/deals` | Deal title, Company name, Deal amount — **3** |
| `/dashboard/forms` | Form name, Field label inline editor — **2** |
| `/dashboard/analytics` | Start date, End date — **2** |

---

## What Was Not Fixed (Deferred)

- **CRM checkbox columns** — `<input type="checkbox">` row selectors use React state; associating `<label>` requires a generated ID per row (complex pattern, tracked for next pass).
- **Color-only status badges** — status badges in CRM/deals convey state via color only; text is present but WCAG 1.4.1 color-independence not fully resolved.
- **Keyboard trap in modals** — modal focus-trap (Tab cycling) not implemented; deferred pending a shared `<Dialog>` wrapper migration.
- **ARIA live regions** — toast notifications (`react-hot-toast`) are not announced as `role="alert"` / `aria-live`; deferred.
- **Reduced-motion** — no `prefers-reduced-motion` suppression on CSS animations (scroll-reveal, spin, slide); deferred.
- **`<select>` elements** — select dropdowns in deals quick-create and CRM filters have no visible `<label>`; placeholder text used for now.

---

## WCAG 2.1 AA Items Pending

| Criterion | Status |
|-----------|--------|
| 1.1.1 Non-text content (alt text) | Not audited on safe pages (no `<img>` found) |
| 1.3.1 Info & relationships (semantic HTML) | Partial — lists use `<div>` instead of `<ul>/<li>` |
| 1.4.1 Use of color | Partial — status badges rely on color |
| 2.1.1 Keyboard accessible | Ring applied; modal trap deferred |
| 2.4.1 Bypass blocks | **Done** (skip link + `id="main"`) |
| 2.4.3 Focus order | Logical in static layout; dynamic panels not audited |
| 2.4.7 Focus visible | **Done** (`:focus-visible` ring on all buttons/inputs) |
| 4.1.2 Name, role, value | **Partial** — icon buttons labeled, checkboxes deferred |
