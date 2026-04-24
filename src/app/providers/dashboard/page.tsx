"use client";

/**
 * Provider dashboard — the page freelancers see when they log in. Shows
 * incoming requests with accept/decline/quote actions.
 *
 * Auth gate: signed-in user must have a pro_services_providers row
 * matching their email (by RLS, the provider GET only returns those). We
 * also probe via /api/pro-services/requests?as=provider — if that returns
 * empty + no provider row exists we show a "not a provider" explainer.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Briefcase,
  CheckCircle2,
  XCircle,
  DollarSign,
  Clock,
  Loader2,
  UserCog,
  Lock,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import Modal from "@/components/ui/modal";
import {
  type ProRequest,
  type ProRequestStatus,
  statusColor,
  fmtPrice,
  categoryLabel,
} from "@/lib/pro-services";

interface RequestRow extends ProRequest {
  pro_services_providers: {
    id: string;
    name: string;
    avatar_url: string | null;
    categories: string[];
  };
}

type ProviderShape = {
  id: string;
  name: string;
  email: string;
  vetted: boolean;
  categories: string[];
};

export default function ProviderDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [provider, setProvider] = useState<ProviderShape | null>(null);
  const [probeState, setProbeState] = useState<"loading" | "none" | "ok">("loading");
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [quoteTarget, setQuoteTarget] = useState<RequestRow | null>(null);

  const loadAll = useCallback(async () => {
    if (!user) return;
    // Fetch provider rows matching my email via /api/pro-services/providers
    try {
      const r1 = await fetch("/api/pro-services/providers?all=1");
      // All=1 only returns for admin — fallback to the default endpoint:
      // we query without filter and then filter by email client-side.
      let providerRow: ProviderShape | null = null;
      if (r1.ok) {
        const json = await r1.json();
        providerRow =
          (json.providers ?? []).find(
            (p: ProviderShape) => p.email?.toLowerCase() === user.email?.toLowerCase(),
          ) ?? null;
      }
      // If admin probe didn't return our row (because we're not admin), fall
      // back to scanning vetted providers
      if (!providerRow) {
        const r2 = await fetch("/api/pro-services/providers");
        if (r2.ok) {
          const json = await r2.json();
          providerRow =
            (json.providers ?? []).find(
              (p: ProviderShape) => p.email?.toLowerCase() === user.email?.toLowerCase(),
            ) ?? null;
        }
      }
      setProvider(providerRow);

      // Separately, fetch requests-as-provider (RLS lets this through if a
      // provider row exists at all, vetted or not)
      const rReq = await fetch("/api/pro-services/requests?as=provider");
      if (rReq.ok) {
        const json = await rReq.json();
        setRequests(json.requests ?? []);
        if (!providerRow && (json.requests ?? []).length > 0) {
          // We have requests but couldn't detect the provider row — unlikely
          // but handle defensively
          setProbeState("ok");
          return;
        }
      }

      setProbeState(providerRow ? "ok" : "none");
    } catch (err) {
      console.error("[providers/dashboard] load failed:", err);
      setProbeState("none");
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void loadAll();
  }, [authLoading, loadAll]);

  if (authLoading || probeState === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-xs text-muted">
        <Loader2 size={14} className="animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <Lock size={32} className="text-muted mx-auto" />
        <h1 className="text-lg font-bold">Sign in required</h1>
        <Link href="/login" className="text-xs text-foreground underline">
          Log in
        </Link>
      </div>
    );
  }

  if (probeState === "none") {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <Briefcase size={32} className="text-muted mx-auto" />
        <h1 className="text-lg font-bold">You&apos;re not a listed provider yet</h1>
        <p className="text-xs text-muted max-w-sm mx-auto">
          The Pro Services Directory is invite-only. If you&apos;d like to be considered, apply
          below and our team will review your portfolio.
        </p>
        <Link
          href="/providers/profile"
          className="inline-flex px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold"
        >
          Apply to join
        </Link>
      </div>
    );
  }

  const transition = async (id: string, next: ProRequestStatus) => {
    const res = await fetch(`/api/pro-services/requests/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error || `Failed (${res.status})`);
      return;
    }
    toast.success(`Marked as ${next}`);
    await loadAll();
  };

  const openCount = requests.filter((r) => r.status === "open").length;
  const activeCount = requests.filter(
    (r) => r.status === "accepted",
  ).length;

  return (
    <div className="fade-in max-w-5xl mx-auto space-y-6 p-4 sm:p-6">
      <PageHero
        icon={<Briefcase size={22} />}
        eyebrow="Provider dashboard"
        title={`Welcome, ${provider?.name ?? ""}`}
        subtitle={
          provider?.vetted
            ? "You're listed in the ShortStack Pro Services directory. Incoming quote requests show up below."
            : "Your profile is under review. Once approved, your listing goes live."
        }
        gradient="gold"
        actions={
          <Link
            href="/providers/profile"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/15"
          >
            <UserCog size={13} /> Edit profile
          </Link>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <SummaryCard
          icon={<Clock size={14} />}
          label="Needs quote"
          value={openCount}
          accent="#60a5fa"
        />
        <SummaryCard
          icon={<CheckCircle2 size={14} />}
          label="In progress"
          value={activeCount}
          accent="#10b981"
        />
        <SummaryCard
          icon={<DollarSign size={14} />}
          label="Status"
          value={provider?.vetted ? "Live" : "In review"}
          accent="#c8a855"
        />
      </div>

      {/* Requests list */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">Incoming requests</h2>
        {requests.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-10 text-center">
            <p className="text-xs text-muted">
              Nothing yet. Once you&apos;re vetted and someone hits &quot;Request quote&quot;,
              requests show up here.
            </p>
          </div>
        ) : (
          requests.map((r) => (
            <RequestCard
              key={r.id}
              row={r}
              onQuote={() => setQuoteTarget(r)}
              onDecline={() => transition(r.id, "declined")}
            />
          ))
        )}
      </section>

      <QuoteResponseModal
        target={quoteTarget}
        onClose={() => setQuoteTarget(null)}
        onSaved={async () => {
          setQuoteTarget(null);
          await loadAll();
        }}
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${accent}15`, color: accent }}
        >
          {icon}
        </div>
        <span className="text-xs font-semibold text-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function RequestCard({
  row,
  onQuote,
  onDecline,
}: {
  row: RequestRow;
  onQuote: () => void;
  onDecline: () => void;
}) {
  const color = statusColor(row.status);
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start gap-3 mb-3">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{ background: color.bg, color: color.fg }}
        >
          {color.label}
        </span>
        <span className="text-[11px] text-muted">
          {new Date(row.created_at).toLocaleDateString()} · {categoryLabel(row.category)}
        </span>
        {row.budget_cents != null && (
          <span className="text-[11px] text-muted">Budget {fmtPrice(row.budget_cents)}</span>
        )}
        {row.deadline && (
          <span className="text-[11px] text-muted">Needs by {row.deadline}</span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{row.title}</h3>
      <p className="text-xs text-muted mt-1 whitespace-pre-wrap">{row.description}</p>

      {row.quote_cents != null && (
        <div className="mt-3 rounded-xl bg-purple-500/10 border border-purple-500/20 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-300">
            Your quote
          </p>
          <p className="text-sm font-bold text-foreground">
            ${(row.quote_cents / 100).toLocaleString()}
          </p>
          {row.quote_message && (
            <p className="text-xs text-muted mt-1 whitespace-pre-wrap">{row.quote_message}</p>
          )}
        </div>
      )}

      {row.status === "open" && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={onQuote}
            className="px-3 py-1.5 rounded-xl bg-foreground text-background text-xs font-bold inline-flex items-center gap-1"
          >
            <DollarSign size={12} /> Send quote
          </button>
          <button
            onClick={onDecline}
            className="px-3 py-1.5 rounded-xl border border-border bg-surface-light text-foreground text-xs font-semibold inline-flex items-center gap-1"
          >
            <XCircle size={12} /> Decline
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Quote-response modal ────────────────────────────────────────

function QuoteResponseModal({
  target,
  onClose,
  onSaved,
}: {
  target: RequestRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setPrice("");
      setMessage("");
    }
  }, [target]);

  const submit = useCallback(async () => {
    if (!target) return;
    const amount = Math.floor(Number(price) * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/pro-services/requests/${target.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "quoted",
          quote_cents: amount,
          quote_message: message.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || `Failed (${res.status})`);
        return;
      }
      toast.success("Quote sent!");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }, [target, price, message, onSaved]);

  return (
    <Modal
      isOpen={!!target}
      onClose={onClose}
      title={target ? `Quote — ${target.title}` : "Quote"}
      size="md"
    >
      {target && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block mb-1">
              Your price (USD)
            </span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="500"
              inputMode="numeric"
              className="w-full bg-surface-light border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none placeholder-muted"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block mb-1">
              Message (optional)
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="What's included, timeline, next steps…"
              className="w-full bg-surface-light border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none placeholder-muted resize-none"
              maxLength={2000}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border bg-surface-light text-xs font-semibold text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold disabled:opacity-60"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <DollarSign size={12} />}
              {saving ? "Sending…" : "Send quote"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
