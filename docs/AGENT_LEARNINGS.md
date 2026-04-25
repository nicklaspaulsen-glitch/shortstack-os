# /agent learnings

> Append-only log of what GPT-5 catches that Sonnet misses. Each row is a
> bug-class + fix pattern from a real /agent session. Future runs read this
> file BEFORE round 1 to pre-check the recurring patterns.
>
> Format:
>
>   **YYYY-MM-DD — <commit-hash> — <bug-class>**
>
>   **Symptom**: one-line description of what was wrong
>   **Why Sonnet missed**: one sentence
>   **Codex catch round**: which review round caught it (1, 2, etc)
>   **Fix pattern**: the canonical fix shape
>   **Pre-check on future runs**: how to detect this class earlier

## 2026-04-26 — round-9 mutation IDOR session

### `0a7f181` — getEffectiveOwnerId not used for tenant scoping

- **Symptom**: tenant-scoped query used `.eq("user_id", user.id)` instead of resolving team_members to their parent_agency_id, locking team_members out of legitimate routes.
- **Why Sonnet missed**: assumed user.id = ownership key. The codebase has both per-user (`user_id` = caller) and per-agency (`user_id` = parent_agency_id for team_members) tables.
- **Codex catch round**: 1
- **Fix pattern**: `const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;` then `.eq("user_id", ownerId)`.
- **Pre-check**: before round 1 grep for `\.eq\("user_id",\s*user\.id\)` and confirm if the table is owner-scoped (cross-reference with `parent_agency_id` writes elsewhere).

### `0a7f181` — `maybeSingle()` + `?.role` fail-open on missing profile

- **Symptom**: gate `if (profile?.role === "client")` lets users without a profiles row through (profile is null → `null?.role` is undefined → comparison false → request proceeds).
- **Why Sonnet missed**: optional-chaining looks defensive but inverts the policy when applied to a role check. Fail-closed requires explicit `!profile ||`.
- **Codex catch round**: 2
- **Fix pattern**: `if (!profile || profile.role === "client") return 403;`
- **Pre-check**: grep for `profile\?\.role\s*===` and flag every match as a fail-open candidate.

### `0a7f181` — chained `.or()` filters on PostgREST can collapse

- **Symptom**: two consecutive `.or()` calls on the same supabase query — meant as AND'd top-level filters, but supabase-js builder semantics are not documented to combine duplicate `or=` params reliably.
- **Why Sonnet missed**: read the API as if it were SQL, not PostgREST.
- **Codex catch round**: 2
- **Fix pattern**: single `.or()` with nested boolean: `.or("and(or(a.eq.X,b.eq.X),or(c.eq.Y,d.eq.Y))")`.
- **Pre-check**: grep for `\.or\([^)]+\)\s*\.or\(` (two .or() back-to-back) and refactor to a single nested expression.

### `0a7f181` — assignee parent_agency check skipped role gate

- **Symptom**: validating that an assignee's `parent_agency_id` matches the caller's owner is necessary but not sufficient. Client profiles can also share parent_agency_id, but should NOT be assignable.
- **Why Sonnet missed**: the parent_agency_id check felt complete.
- **Codex catch round**: 3
- **Fix pattern**: also assert `member.role === "team_member"` (not just role !== "client", which would still allow agency-owner roles to be team-assigned).
- **Pre-check**: every place we check parent_agency_id, also confirm the role expected for the operation.

## 2026-04-26 — visual uplift session

### `3a09bd6` — sessionStorage in useState init = hydration mismatch

- **Symptom**: `useState(() => sessionStorage.getItem(...))` runs differently on server (returns null) vs client (returns the stored value), producing a flicker on mount and React hydration warning.
- **Why Sonnet missed**: knew the pattern but used the inline-init shortcut anyway.
- **Codex catch round**: 1
- **Fix pattern**: `useState(default)` + `useEffect(() => { setX(sessionStorage.getItem(...)) }, [])`.
- **Pre-check**: grep for `useState\(\(\)\s*=>\s*[^)]*sessionStorage` and `useState\(\(\)\s*=>\s*[^)]*localStorage` — flag both.

### `3a09bd6` — duplicate `layoutId` across two component instances

- **Symptom**: framer-motion's shared-layout animation only works when each layoutId is mounted at most once. Two `<Sidebar />` instances on mobile (desktop hidden + overlay visible) both render motion.div with the same layoutId.
- **Why Sonnet missed**: layoutId works perfectly on the desktop side; mobile overlay is invisible until menu opens.
- **Codex catch round**: 1
- **Fix pattern**: wrap each instance in `<LayoutGroup id="unique-per-instance">` so layoutIds are scoped within their group.
- **Pre-check**: grep for `layoutId=` and check each component is rendered exactly once on every viewport size.

<!-- /agent appends new rows below this line. Format above. -->
