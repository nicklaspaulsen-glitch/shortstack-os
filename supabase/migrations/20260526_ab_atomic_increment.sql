-- Atomic increment helpers for A/B test tracking.
--
-- The track-view and track-conversion routes previously used a read-then-write
-- pattern (SELECT views, then UPDATE views + 1) which is vulnerable to a
-- race condition under concurrent requests: two simultaneous hits could both
-- read the same value and write back the same incremented count, losing events.
--
-- These functions update the counter in a single atomic statement, eliminating
-- the race. They are called from the service-role client so no SECURITY DEFINER
-- is needed.

CREATE OR REPLACE FUNCTION public.ab_increment_views(p_variant_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.ab_variants SET views = views + 1 WHERE id = p_variant_id;
$$;

CREATE OR REPLACE FUNCTION public.ab_increment_conversions(p_variant_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.ab_variants SET conversions = conversions + 1 WHERE id = p_variant_id;
$$;
