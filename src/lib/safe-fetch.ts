/**
 * Wraps any async fetch function in try/catch/finally to guarantee
 * setLoading(false) always runs — prevents pages from getting permanently
 * stuck on loading spinners when a Supabase query or network request fails.
 */
export async function safeFetch(
  fn: () => Promise<void>,
  setLoading?: (v: boolean) => void
): Promise<void> {
  try {
    setLoading?.(true);
    await fn();
  } catch (err) {
    console.error("[safeFetch]", err);
  } finally {
    setLoading?.(false);
  }
}
