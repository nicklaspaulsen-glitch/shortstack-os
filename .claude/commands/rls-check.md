---
description: Audit Row-Level Security policies on a Supabase table. Confirms RLS is enabled and policies enforce ownership via auth.uid().
---

# /rls-check

Quick RLS audit on a single table or all tables. Use when "is this table protected?" or before adding a feature that writes user data.

## Usage

- `/rls-check <table>` — audit one table
- `/rls-check` — list all public tables and their RLS status

## Steps for a single table

Use `mcp__8fb03bb5-...__execute_sql` against project `jkttomvrfhomhthetqhh`:

```sql
-- Is RLS enabled?
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = '<table>';

-- What policies exist?
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = '<table>';
```

## Report format

```
## RLS audit: <table>

✅ RLS enabled

Policies:
1. own_<table>_select   SELECT  authenticated   USING: profile_id = auth.uid()
2. own_<table>_insert   INSERT  authenticated   WITH CHECK: profile_id = auth.uid()
3. own_<table>_update   UPDATE  authenticated   USING: profile_id = auth.uid()
4. own_<table>_delete   DELETE  authenticated   USING: profile_id = auth.uid()

Verdict: PROTECTED — auth.uid() check on every CRUD operation.
```

OR if missing:

```
## RLS audit: <table>

❌ RLS DISABLED — anyone with the anon key can read/write all rows.

Suggested fix migration:
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_<table>_all" ON <table> FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

Apply via: mcp__8fb03bb5-...__apply_migration
```

## Steps for all tables (no arg)

```sql
SELECT tablename, rowsecurity,
       (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = t.tablename) AS policy_count
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename;
```

Show tables with RLS=false at the top (red), then tables with RLS=true but policy_count=0 (yellow — RLS enabled but everything blocked!), then the protected ones (green) collapsed into a count.

## Constraints

- Don't apply fixes without confirming the column name (some tables use `user_id`, others `profile_id`, others `owner_id`).
- Don't disable RLS, ever. If it's mistakenly enabled, that's the user's call.
