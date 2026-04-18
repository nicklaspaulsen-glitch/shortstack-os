import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns true if a scheduled telegram message of the given routine_type
 * should actually go out for this user. Looks up the matching row in
 * telegram_routines.
 *
 *  - No row configured  -> true  (backwards compat, don't block legacy cron)
 *  - enabled && !paused -> true
 *  - otherwise          -> false
 */
export async function shouldSendRoutine(
  service: SupabaseClient,
  userId: string | null | undefined,
  routineType: string
): Promise<boolean> {
  if (!userId) return true;
  const { data } = await service
    .from("telegram_routines")
    .select("enabled, paused")
    .eq("user_id", userId)
    .eq("routine_type", routineType)
    .maybeSingle();
  if (!data) return true;
  return Boolean(data.enabled) && !data.paused;
}

/**
 * Global variant — returns false if ANY user has paused this routine_type.
 * Useful for the legacy single-tenant crons that don't carry a user_id.
 * When no row matches the type, returns true.
 */
export async function anyRoutineActive(
  service: SupabaseClient,
  routineType: string
): Promise<boolean> {
  const { data } = await service
    .from("telegram_routines")
    .select("enabled, paused")
    .eq("routine_type", routineType);
  if (!data || data.length === 0) return true;
  return data.some((r) => r.enabled && !r.paused);
}
