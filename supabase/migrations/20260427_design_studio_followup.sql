-- Design Studio v1 — follow-up fixes from Opus round-1 review:
--   1. UNIQUE constraint on (name, is_global) so the seed endpoint can use
--      ON CONFLICT for idempotent re-seeds.
--   2. updated_at trigger on designs + design_jobs (the columns existed but
--      had no trigger to bump them).
--
-- Idempotent: safe to re-apply.

-- ── 1. UNIQUE constraint for design_templates seed idempotency ──────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'design_templates_name_global_unique'
  ) THEN
    ALTER TABLE design_templates
      ADD CONSTRAINT design_templates_name_global_unique
      UNIQUE (name, is_global);
  END IF;
END$$;

-- ── 2. updated_at trigger function (shared) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2a. designs.updated_at on every UPDATE
DROP TRIGGER IF EXISTS trg_designs_updated_at ON designs;
CREATE TRIGGER trg_designs_updated_at
  BEFORE UPDATE ON designs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2b. design_jobs.updated_at on every UPDATE
DROP TRIGGER IF EXISTS trg_design_jobs_updated_at ON design_jobs;
CREATE TRIGGER trg_design_jobs_updated_at
  BEFORE UPDATE ON design_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
