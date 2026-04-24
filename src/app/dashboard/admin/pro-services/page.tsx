"use client";

/**
 * Admin-only Pro Services curation dashboard.
 *
 * - Stats strip (provider count, requests/month, referral revenue)
 * - Providers table with vet/unvet toggle
 * - Invite provider (sends onboarding email)
 *
 * Gated via the same `profile.role === "admin"` pattern used by the
 * self-test dashboard. Non-admin users get a polite lock screen.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import {
  ShieldCheck,
  Users2,
  Inbox,
  DollarSign,
  ArrowLeft,
  Lock,
  Loader2,
  Mail,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import Modal from "@/components/ui/modal";
import { type ProProvider, categoryLabel } from "@/lib/pro-services";

interface Stats {
  total_providers: number;
  vetted_providers: number;
  pending_vetting: number;
  active_subscriptions: number;
  requests_last_30d: number;
  total_requests: number;
  completed_requests: number;
  total_referral_cents: number;
  paid_referral_cents: number;
}

export default function AdminProServicesPage() {
  const { profile, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [providers, setProviders] = useState<ProProvider[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "forbidden" | "error">(
    "loading",
  );
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statsRes, providersRes] = await Promise.all([
        fetch("/api/admin/pro-services/stats"),
        fetch("/api/pro-services/providers?all=1"),
      ]);
      if (statsRes.status === 403 || providersRes.status === 403) {
        setState("forbidden");
        return;
      }
      if (!statsRes.ok || !providersRes.ok) {
        setState("error");
        return;
      }
      const statsJson = (await statsRes.json()) as Stats;
      const providersJson = await providersRes.json();
      setStats(statsJson);
      setProviders(providersJson.providers ?? []);
      setState("ok");
    } catch (err) {
      console.error("[admin/pro-services] load failed:", err);
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (profile?.role !== "admin") {
      setState("forbidden");
      return;
    }
    void load();
  }, [authLoading, profile?.role, load]);

  const toggleVetted = async (providerId: string, nextVetted: boolean) => {
    try {
      const res = await fetch("/api/admin/pro-services/vet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider_id: providerId, vetted: nextVetted }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || `Failed (${res.status})`);
        return;
      }
      toast.success(nextVetted ? "Provider vetted" : "Unvetted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    }
  };

  if (authLoading || state === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-xs text-muted">
        <Loader2 size={14} className="animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <Lock size={32} className="text-muted mx-auto" />
        <h1 className="text-lg font-bold">Admin only</h1>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
        >
          <ArrowLeft size={12} /> Back
        </Link>
      </div>
    );
  }

  if (state === "error" || !stats) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <p className="text-sm text-foreground">Couldn&apos;t load — retry</p>
        <button
          onClick={load}
          className="px-4 py-2 rounded-xl border border-border bg-surface text-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  const referralPaid = stats.paid_referral_cents / 100;
  const referralPending = (stats.total_referral_cents - stats.paid_referral_cents) / 100;

  return (
    <div className="fade-in max-w-6xl mx-auto space-y-6">
      <PageHero
        icon={<ShieldCheck size={22} />}
        eyebrow="Admin"
        title="Pro Services curation"
        subtitle="Review applicants, vet providers, track platform stats. Vetted = visible in the public directory."
        gradient="purple"
        actions={
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/15"
          >
            <Mail size={13} /> Invite provider
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Users2 size={14} />}
          label="Providers"
          value={`${stats.vetted_providers} / ${stats.total_providers}`}
          sublabel={`${stats.pending_vetting} pending`}
          accent="#a855f7"
        />
        <StatCard
          icon={<Inbox size={14} />}
          label="Requests (30d)"
          value={stats.requests_last_30d}
          sublabel={`${stats.completed_requests} completed all-time`}
          accent="#60a5fa"
        />
        <StatCard
          icon={<DollarSign size={14} />}
          label="Active subs"
          value={stats.active_subscriptions}
          sublabel="$99/mo listings"
          accent="#10b981"
        />
        <StatCard
          icon={<DollarSign size={14} />}
          label="Referral revenue"
          value={`$${referralPaid.toLocaleString()}`}
          sublabel={`$${referralPending.toLocaleString()} pending`}
          accent="#c8a855"
        />
      </div>

      {/* Providers table */}
      <section className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">All providers</h2>
          <span className="text-[10px] text-muted">{providers.length} total</span>
        </div>
        {providers.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted">No providers yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-light/30">
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Categories</Th>
                  <Th>Price</Th>
                  <Th>Turnaround</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0 hover:bg-surface-light/20"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/dashboard/hire/${p.id}`}
                        className="text-xs font-semibold text-foreground hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-muted truncate max-w-[200px]">
                      {p.email}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {p.categories.map((c) => (
                          <span
                            key={c}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-light text-muted"
                          >
                            {categoryLabel(c)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground">
                      ${(p.starting_price_cents / 100).toLocaleString()}+
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground">
                      {p.turnaround_days}d
                    </td>
                    <td className="px-4 py-2.5">
                      {p.vetted ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                          <CheckCircle2 size={10} /> Vetted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                          <XCircle size={10} /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => toggleVetted(p.id, !p.vetted)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold ${
                          p.vetted
                            ? "bg-surface-light text-muted hover:text-foreground"
                            : "bg-emerald-500 text-background"
                        }`}
                      >
                        {p.vetted ? "Unvet" : "Vet"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSent={async () => {
          setInviteOpen(false);
          await load();
        }}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sublabel: string;
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
      <div className="text-2xl font-bold text-foreground leading-none">{value}</div>
      <p className="text-[10px] text-muted mt-1">{sublabel}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
      {children}
    </th>
  );
}

function InviteModal({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  onSent: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setName("");
    }
  }, [open]);

  const send = useCallback(async () => {
    if (!email.trim()) {
      toast.error("Email required");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/pro-services/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || `Failed (${res.status})`);
        return;
      }
      toast.success("Invite sent");
      await onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSending(false);
    }
  }, [email, name, onSent]);

  return (
    <Modal isOpen={open} onClose={onClose} title="Invite provider" size="md">
      <div className="space-y-3">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block mb-1">
            Name (optional)
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Their name"
            className="w-full bg-surface-light border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block mb-1">
            Email
          </span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="them@example.com"
            className="w-full bg-surface-light border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none"
            type="email"
          />
        </label>
        <p className="text-[11px] text-muted">
          They&apos;ll get an email with a link to /providers/profile to create their listing.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border bg-surface-light text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={send}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold disabled:opacity-60"
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
            {sending ? "Sending…" : "Send invite"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
