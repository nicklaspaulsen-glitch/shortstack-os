"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SocialAccount = {
  id: string;
  platform: string;
  account_name?: string;
  account_id?: string;
  is_active?: boolean;
  status?: "active" | "expired" | "revoked";
  metadata?: Record<string, unknown>;
};

/**
 * Shared hook for reading the current user's connected social accounts.
 *
 * - Fetches on mount
 * - Refetches when the window regains focus (detects connections made in
 *   another tab / another page without needing a hard reload)
 * - Refetches when the `social-connections-changed` event fires on window
 *   (use `window.dispatchEvent(new Event("social-connections-changed"))`
 *   after completing a connect flow to instantly refresh every subscriber)
 */
export function useSocialAccounts(opts?: { clientId?: string; autoRefresh?: boolean }) {
  const { clientId, autoRefresh = true } = opts || {};
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAccounts = useCallback(async () => {
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      const url = clientId
        ? `/api/social/connect?client_id=${encodeURIComponent(clientId)}`
        : "/api/social/status";
      const res = await fetch(url, { signal: ctl.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: SocialAccount[] = data?.accounts || data?.social_accounts || [];
      setAccounts(list);
      setError(null);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchAccounts();
    if (!autoRefresh) return;
    const onFocus = () => fetchAccounts();
    const onChange = () => fetchAccounts();
    window.addEventListener("focus", onFocus);
    window.addEventListener("social-connections-changed", onChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("social-connections-changed", onChange);
    };
  }, [fetchAccounts, autoRefresh]);

  const connected = new Set(
    accounts.filter(a => a.is_active !== false && a.status !== "revoked")
      .map(a => String(a.platform).toLowerCase()),
  );

  return {
    accounts,
    connected,
    loading,
    error,
    refresh: fetchAccounts,
    isConnected: (platform: string) => connected.has(platform.toLowerCase()),
  };
}
