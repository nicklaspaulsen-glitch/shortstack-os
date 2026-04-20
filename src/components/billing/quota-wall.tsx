"use client";

/**
 * QuotaWall — modal shown when any API call returns 402 (plan limit reached).
 *
 * Two pieces live in this file:
 *   1. <QuotaWall> — reusable modal/card UI. Can be mounted explicitly with
 *      an error payload, or driven automatically via the <QuotaWallProvider>
 *      context + `useQuotaWall()` hook.
 *   2. useQuotaWall() hook — wraps fetch() so that any 402 response
 *      automatically raises the wall. Usage:
 *
 *        const { fetchWithWall } = useQuotaWall();
 *        const res = await fetchWithWall("/api/thumbnail/generate", { ... });
 *        // If status === 402, the wall is shown. The returned response is
 *        // the same raw Response so callers can still inspect status/body.
 *
 * The 402 payload contract (from /api/emails/send, checkLimit, etc.):
 *   { error: string, current: number, limit: number, plan_tier: string, remaining: number }
 * The payload may also include `resource` — if missing, we infer it from the
 * error message.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CreditCard, Plus, X, ArrowUpRight } from "lucide-react";

export interface QuotaWallPayload {
  error?: string;
  current?: number;
  limit?: number;
  plan_tier?: string;
  remaining?: number;
  resource?: string;
}

// ─── Labels for resource types ────────────────────────────────────────────────
const RESOURCE_LABELS: Record<string, string> = {
  emails: "email",
  tokens: "AI token",
  clients: "client",
  sms: "SMS",
  call_minutes: "AI call minute",
  phone_numbers: "phone number",
};

function resourceLabel(resource?: string): string {
  if (!resource) return "usage";
  return RESOURCE_LABELS[resource] || resource.replace(/_/g, " ");
}

function inferResourceFromError(message?: string): string | undefined {
  if (!message) return undefined;
  const m = message.toLowerCase();
  for (const key of Object.keys(RESOURCE_LABELS)) {
    if (m.includes(key)) return key;
  }
  return undefined;
}

// ─── Standalone QuotaWall UI ──────────────────────────────────────────────────
interface QuotaWallProps {
  payload: QuotaWallPayload | null;
  onClose?: () => void;
  /** If true, renders inline (card) instead of as an overlay modal. */
  inline?: boolean;
}

export function QuotaWall({ payload, onClose, inline = false }: QuotaWallProps) {
  if (!payload) return null;

  const resource = payload.resource || inferResourceFromError(payload.error);
  const label = resourceLabel(resource);
  const current = typeof payload.current === "number" ? payload.current : undefined;
  const limit = typeof payload.limit === "number" && Number.isFinite(payload.limit) ? payload.limit : undefined;
  const plan = payload.plan_tier || "your plan";
  const pct =
    current !== undefined && limit !== undefined && limit > 0
      ? Math.min(100, Math.round((current / limit) * 100))
      : 100;

  const body = (
    <div className={inline ? "rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-5" : "p-6"}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
          <AlertTriangle size={18} className="text-red-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-foreground">
            You hit your {label} limit for this month
          </h3>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            {payload.error ||
              `Your ${plan} plan's monthly ${label} cap has been reached. Upgrade or top up to keep going.`}
          </p>
        </div>
        {onClose && !inline && (
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted hover:text-foreground hover:bg-surface-light transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {current !== undefined && limit !== undefined && (
        <div className="mb-5">
          <div className="flex justify-between text-[10px] font-medium uppercase tracking-wider mb-1.5">
            <span className="text-muted">Usage</span>
            <span className="text-foreground">
              {current.toLocaleString()} / {limit.toLocaleString()}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-light overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/dashboard/upgrade"
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gold text-white text-xs font-semibold hover:bg-gold/90 transition-colors shadow-sm"
        >
          <ArrowUpRight size={12} />
          Upgrade plan
        </Link>
        <Link
          href="/dashboard/billing"
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-surface-light text-foreground text-xs font-medium border border-border hover:bg-gold/10 hover:text-gold transition-colors"
        >
          <Plus size={12} />
          Buy more tokens
        </Link>
      </div>
    </div>
  );

  if (inline) return body;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-surface border border-border/50 rounded-2xl shadow-2xl shadow-black/50 fade-in">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
          <div className="flex items-center gap-2">
            <CreditCard size={14} className="text-gold" />
            <h2 className="text-xs font-semibold text-foreground">Plan limit reached</h2>
          </div>
        </div>
        {body}
      </div>
    </div>
  );
}

// ─── Context / Provider ───────────────────────────────────────────────────────
interface QuotaWallContextValue {
  show: (payload: QuotaWallPayload) => void;
  hide: () => void;
  fetchWithWall: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const QuotaWallContext = createContext<QuotaWallContextValue | null>(null);

/**
 * Provider that mounts a single QuotaWall modal at the app root and exposes
 * imperative `show`/`hide` + a `fetchWithWall` wrapper.
 *
 * Mount this in the dashboard layout for automatic 402-handling across all
 * child pages. Without the provider, components calling `useQuotaWall()`
 * will fall back to a safe no-op + a toast.
 */
export function QuotaWallProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<QuotaWallPayload | null>(null);

  const show = useCallback((p: QuotaWallPayload) => setPayload(p), []);
  const hide = useCallback(() => setPayload(null), []);

  const fetchWithWall = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const res = await fetch(input, init);
      if (res.status === 402) {
        try {
          // Clone so downstream callers can still .json() the response.
          const clone = res.clone();
          const data = (await clone.json()) as QuotaWallPayload;
          setPayload(data || { error: "Plan limit reached" });
        } catch {
          setPayload({ error: "Plan limit reached" });
        }
      }
      return res;
    },
    [],
  );

  const value = useMemo<QuotaWallContextValue>(
    () => ({ show, hide, fetchWithWall }),
    [show, hide, fetchWithWall],
  );

  return (
    <QuotaWallContext.Provider value={value}>
      {children}
      <QuotaWall payload={payload} onClose={hide} />
    </QuotaWallContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access the quota-wall context. Safe to call outside the provider — in that
 * case, `show`/`hide` become no-ops and `fetchWithWall` falls back to plain
 * fetch() + a toast (via dynamic import to avoid hard-coupling).
 */
export function useQuotaWall(): QuotaWallContextValue {
  const ctx = useContext(QuotaWallContext);
  // Local fallback for pages not yet wrapped in the provider — keeps the
  // integration safe to add incrementally.
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  return useMemo<QuotaWallContextValue>(() => {
    if (ctx) return ctx;
    return {
      show: () => {},
      hide: () => {},
      fetchWithWall: async (input: RequestInfo | URL, init?: RequestInit) => {
        const res = await fetch(input, init);
        if (res.status === 402) {
          try {
            const clone = res.clone();
            const data = (await clone.json()) as QuotaWallPayload;
            const msg =
              data?.error ||
              "You hit your plan limit — click to upgrade.";
            // Dynamically load toast to avoid SSR issues.
            const toastMod = await import("react-hot-toast").catch(() => null);
            if (toastMod?.default) {
              toastMod.default.error(`${msg} Redirecting...`, { duration: 4000 });
            }
            setTimeout(() => {
              try { routerRef.current.push("/dashboard/upgrade"); } catch {}
            }, 800);
          } catch {}
        }
        return res;
      },
    };
  }, [ctx]);
}

// ─── Convenience: one-shot check without the wrapper ──────────────────────────
/**
 * If your call site can't use `fetchWithWall`, you can pass a raw Response
 * here to raise the wall manually. Safe outside the provider (no-op).
 */
export function useHandleQuotaResponse() {
  const { show } = useQuotaWall();
  return useCallback(
    async (res: Response): Promise<boolean> => {
      if (res.status !== 402) return false;
      try {
        const clone = res.clone();
        const data = (await clone.json()) as QuotaWallPayload;
        show(data || { error: "Plan limit reached" });
      } catch {
        show({ error: "Plan limit reached" });
      }
      return true;
    },
    [show],
  );
}

