---
description: Audit a /dashboard page (or all pages) for PageHero / StatCard / AdvancedToggle compliance, dead buttons, and broken interactions. Delegates to page-hero-enforcer agent.
---

# /page-audit

Audit dashboard page(s) for visual conventions and broken UI.

## Usage

- `/page-audit <page-name>` — audit one page (e.g. `/page-audit ai-studio`)
- `/page-audit` — audit every dashboard page (sweeps through ~127 pages — long-running)

## What gets checked

Delegated to the **page-hero-enforcer** agent. It checks:

1. **`<PageHero>` usage** — every `src/app/dashboard/*/page.tsx` should use the shared component
2. **`<StatCard>` usage** — number-display tiles should use the shared component
3. **`<AdvancedToggle>` + `useAdvancedMode`** — wizard+form pages should use the shared toggle

Plus:

4. **Dead buttons** — onClick handlers that point at undefined functions or routes
5. **Wrong-target buttons** — link/href values that 404 or go to the wrong route
6. **Silent failures** — buttons that fire fetch() but show no error/success feedback

## Report format

```
## Page audit: <page-name>

### Visual conventions
[delegated agent output]

### Interaction layer
- ❌ Line 142: `<button onClick={handleGenerate}>` — handleGenerate is not defined
- ⚠️ Line 207: <Link href="/dashboard/missing-route"> — route doesn't exist
- ⚠️ Line 308: fetch("/api/foo") with no error handling — silent failure on 500

### Fix list
1. Define handleGenerate or remove the button
2. Update href to /dashboard/correct-route or remove
3. Add toast.error in catch block of the fetch
```

## Constraints

- Don't propose redesigning pages — just enforce existing conventions.
- Keep portal pages (`/dashboard/portal/*`) intentionally lighter; flag *missing* PageHero only on agency pages.
- For sweep mode (no arg), prioritize the top 20 most-trafficked pages first; let the user opt into full sweep.
