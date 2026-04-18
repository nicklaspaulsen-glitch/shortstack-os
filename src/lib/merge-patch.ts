/**
 * mergeNonEmpty — merge a partial patch into a target object, skipping any
 * keys where the value is undefined, null, or an empty string.
 *
 * Used by creation-wizard.tsx to prevent AI helper responses from wiping
 * user-entered input when the API fails or returns partial data.
 *
 * Regression guard for the bug where `variants[0].title` returned undefined
 * and the wizard merged `{ title: undefined }`, clearing the typed title.
 */
export function mergeNonEmpty<T extends Record<string, unknown>>(
  target: T,
  patch: Partial<T> | undefined | null,
): T {
  const next: Record<string, unknown> = { ...target };
  if (!patch) return next as T;
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined && v !== null && v !== "") {
      next[k] = v;
    }
  }
  return next as T;
}
