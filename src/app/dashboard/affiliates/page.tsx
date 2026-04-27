"use client";

/**
 * Affiliates dashboard — agency-side admin for the affiliate program.
 *
 * Tabs:
 *   1. Programs    — create / edit programs (commission terms, cookie days, threshold)
 *   2. Affiliates  — invite, approve, list with per-affiliate stats
 *   3. Referrals   — kanban (clicked → signed_up → subscribed) + conversion rate
 *   4. Payouts     — pending payouts grouped by affiliate, "Pay All" trigger
 *
 * All four tabs read from /api/affiliate/* endpoints. Auth-gated by the
 * server routes — this page assumes the user is signed in (the layout
 * gates that for /dashboard/* already).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Award,
  Plus,
  Users,
  Activity,
  DollarSign,
  Loader2,
  ArrowUpRight,
  CheckCircle2,
  X,
  Pause,
  Play,
  Mail,
  Copy,
  ChevronRight,
} from "lucide-react";

import PageHero from "@/components/ui/page-hero";
import StatCard from "@/components/ui/stat-card";

// ── Types ────────────────────────────────────────────────────────────────────
type CommissionType = "flat" | "percentage";
type ProgramStatus = "active" | "paused" | "closed";
type AffiliateStatus = "pending" | "approved" | "suspended" | "rejected";
type ReferralStatus = "clicked" | "signed_up" | "subscribed" | "cancelled" | "refunded";

interface Program {
  id: string;
  name: string;
  description: string | null;
  commission_type: CommissionType;
  commission_value: number;
  cookie_days: number;
  payout_threshold_cents: number;
  payout_schedule: "weekly" | "monthly" | "quarterly";
  status: ProgramStatus;
  affiliate_count?: number;
  created_at: string;
  updated_at: string;
}

interface Affiliate {
  id: string;
  program_id: string;
  user_id: string | null;
  email: string;
  name: string;
  ref_code: string;
  stripe_account_id: string | null;
  status: AffiliateStatus;
  total_earned_cents: number;
  pending_cents: number;
  paid_cents: number;
  joined_at: string;
  approved_at: string | null;
  affiliate_programs?: {
    id: string;
    name: string;
    user_id: string;
    commission_type: CommissionType;
    commission_value: number;
  } | null;
}

interface ReferralRow {
  id: string;
  affiliate_id: string;
  referred_user_id: string | null;
  referred_email: string | null;
  click_id: string | null;
  source: string | null;
  status: ReferralStatus;
  conversion_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  affiliates?: {
    id: string;
    name: string;
    email: string;
    ref_code: string;
    program_id: string;
    affiliate_programs?: { id: string; user_id: string; name: string } | null;
  } | null;
}

interface PayoutResult {
  affiliate_id: string;
  affiliate_email: string;
  amount_cents: number;
  currency: string;
  status:
    | "paid"
    | "skipped_below_threshold"
    | "skipped_no_stripe"
    | "skipped_inactive"
    | "failed";
  transfer_id?: string;
  error?: string;
  commission_ids: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function commissionLabel(p: Pick<Program, "commission_type" | "commission_value">): string {
  return p.commission_type === "flat"
    ? `${fmtCents(Math.round(p.commission_value))} flat`
    : `${p.commission_value}% recurring`;
}

const SHARE_BASE =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://app.shortstack.work";

// ── Page ─────────────────────────────────────────────────────────────────────
type TabKey = "programs" | "affiliates" | "referrals" | "payouts";

export default function AffiliatesPage() {
  const [tab, setTab] = useState<TabKey>("programs");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [pRes, aRes, rRes] = await Promise.all([
        fetch("/api/affiliate/programs", { cache: "no-store" }),
        fetch("/api/affiliate/affiliates", { cache: "no-store" }),
        fetch("/api/affiliate/referrals?limit=200", { cache: "no-store" }),
      ]);
      if (pRes.ok) {
        const d = (await pRes.json()) as { programs: Program[] };
        setPrograms(d.programs ?? []);
      }
      if (aRes.ok) {
        const d = (await aRes.json()) as { affiliates: Affiliate[] };
        setAffiliates(d.affiliates ?? []);
      }
      if (rRes.ok) {
        const d = (await rRes.json()) as { referrals: ReferralRow[] };
        setReferrals(d.referrals ?? []);
      }
    } catch (err) {
      console.error("[affiliates] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalAffiliates = affiliates.length;
  const approvedAffiliates = affiliates.filter((a) => a.status === "approved").length;
  const totalPendingCents = affiliates.reduce((s, a) => s + (a.pending_cents ?? 0), 0);
  const totalPaidCents = affiliates.reduce((s, a) => s + (a.paid_cents ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHero
        title="Affiliate Program"
        subtitle="Recruit affiliates, track referrals, and pay commissions automatically with Stripe Connect."
        icon={<Award size={28} />}
        gradient="purple"
        eyebrow="Recurring revenue magnifier"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Programs"
          value={programs.length}
          icon={<Award size={14} />}
        />
        <StatCard
          label="Affiliates"
          value={totalAffiliates}
          change={
            totalAffiliates > 0
              ? `${approvedAffiliates} approved`
              : "Invite your first one"
          }
          changeType={approvedAffiliates > 0 ? "positive" : "neutral"}
          icon={<Users size={14} />}
        />
        <StatCard
          label="Pending payouts"
          value={fmtCents(totalPendingCents)}
          icon={<Activity size={14} />}
          premium
        />
        <StatCard
          label="Paid out"
          value={fmtCents(totalPaidCents)}
          icon={<DollarSign size={14} />}
          premium
        />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {(
          [
            { k: "programs", label: "Programs" },
            { k: "affiliates", label: "Affiliates" },
            { k: "referrals", label: "Referrals" },
            { k: "payouts", label: "Payouts" },
          ] as { k: TabKey; label: string }[]
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.k
                ? "border-gold text-gold"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-20 text-muted">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : tab === "programs" ? (
        <ProgramsTab programs={programs} onChanged={refresh} />
      ) : tab === "affiliates" ? (
        <AffiliatesTab
          affiliates={affiliates}
          programs={programs}
          onChanged={refresh}
        />
      ) : tab === "referrals" ? (
        <ReferralsTab referrals={referrals} affiliates={affiliates} />
      ) : (
        <PayoutsTab
          affiliates={affiliates}
          programs={programs}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

// ── Programs Tab ─────────────────────────────────────────────────────────────
function ProgramsTab({
  programs,
  onChanged,
}: {
  programs: Program[];
  onChanged: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">
          Each program holds the commercial terms (commission, cookie window,
          threshold) and groups affiliates under those terms.
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gold text-dark text-sm font-semibold rounded-lg hover:bg-gold/90 transition-colors"
        >
          <Plus size={16} /> New program
        </button>
      </div>

      {programs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <Award size={32} className="mx-auto text-gold/60 mb-3" />
          <h3 className="text-lg font-semibold mb-1">No programs yet</h3>
          <p className="text-sm text-muted mb-4">
            Create your first program to start recruiting affiliates.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-gold text-dark text-sm font-semibold rounded-lg"
          >
            Create program
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((p) => (
            <ProgramCard key={p.id} program={p} onChanged={onChanged} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProgramModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function ProgramCard({
  program,
  onChanged,
}: {
  program: Program;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const togglePause = useCallback(async () => {
    setBusy(true);
    try {
      const next = program.status === "active" ? "paused" : "active";
      const res = await fetch(`/api/affiliate/programs/${program.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(next === "active" ? "Resumed" : "Paused");
      onChanged();
    } catch (err) {
      console.error("[programs] toggle failed:", err);
      toast.error("Failed to update program");
    } finally {
      setBusy(false);
    }
  }, [program.id, program.status, onChanged]);

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-3 hover:border-gold/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <h3 className="font-semibold truncate">{program.name}</h3>
          {program.description && (
            <p className="text-xs text-muted line-clamp-2">{program.description}</p>
          )}
        </div>
        <span
          className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full whitespace-nowrap ${
            program.status === "active"
              ? "bg-success/15 text-success"
              : program.status === "paused"
              ? "bg-warning/15 text-warning"
              : "bg-muted/15 text-muted"
          }`}
        >
          {program.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-muted">Commission</div>
          <div className="font-semibold text-gold">{commissionLabel(program)}</div>
        </div>
        <div>
          <div className="text-muted">Cookie</div>
          <div className="font-semibold">{program.cookie_days} days</div>
        </div>
        <div>
          <div className="text-muted">Threshold</div>
          <div className="font-semibold">{fmtCents(program.payout_threshold_cents)}</div>
        </div>
        <div>
          <div className="text-muted">Payout</div>
          <div className="font-semibold capitalize">{program.payout_schedule}</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
        <span className="text-muted">{program.affiliate_count ?? 0} affiliates</span>
        <button
          onClick={togglePause}
          disabled={busy || program.status === "closed"}
          className="flex items-center gap-1 text-muted hover:text-foreground disabled:opacity-40"
        >
          {program.status === "active" ? (
            <>
              <Pause size={12} /> Pause
            </>
          ) : (
            <>
              <Play size={12} /> Resume
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function CreateProgramModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("Affiliate program");
  const [description, setDescription] = useState("");
  const [commissionType, setCommissionType] = useState<CommissionType>("percentage");
  const [commissionValue, setCommissionValue] = useState<number>(30);
  const [cookieDays, setCookieDays] = useState<number>(30);
  const [thresholdDollars, setThresholdDollars] = useState<number>(50);
  const [schedule, setSchedule] = useState<"weekly" | "monthly" | "quarterly">("monthly");
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (commissionValue <= 0) {
      toast.error("Commission must be positive");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliate/programs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          commission_type: commissionType,
          commission_value:
            commissionType === "flat" ? Math.round(commissionValue * 100) : commissionValue,
          cookie_days: cookieDays,
          payout_threshold_cents: Math.round(thresholdDollars * 100),
          payout_schedule: schedule,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      toast.success("Program created");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create program");
    } finally {
      setSubmitting(false);
    }
  }, [name, description, commissionType, commissionValue, cookieDays, thresholdDollars, schedule, onCreated]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New affiliate program</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-xs uppercase text-muted">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg bg-muted/10 border border-border px-3 py-2 text-sm text-foreground"
              placeholder="Main program"
            />
          </label>

          <label className="block text-xs uppercase text-muted">
            Description (optional)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg bg-muted/10 border border-border px-3 py-2 text-sm text-foreground"
              placeholder="What's this program for?"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs uppercase text-muted">
              Commission type
              <select
                value={commissionType}
                onChange={(e) => setCommissionType(e.target.value as CommissionType)}
                className="mt-1 w-full rounded-lg bg-muted/10 border border-border px-3 py-2 text-sm"
              >
                <option value="percentage">Percentage (recurring)</option>
                <option value="flat">Flat amount (one-time)</option>
              </select>
            </label>

            <label className="block text-xs uppercase text-muted">
              {commissionType === "percentage" ? "Percent" : "Amount (USD)"}
              <input
                type="number"
                step={commissionType === "percentage" ? "1" : "0.01"}
                min={0}
                value={commissionValue}
                onChange={(e) => setCommissionValue(Number(e.target.value))}
                className="mt-1 w-full rounded-lg bg-muted/10 border border-border px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="block text-xs uppercase text-muted">
              Cookie days
              <input
                type="number"
                min={1}
                max={365}
                value={cookieDays}
                onChange={(e) => setCookieDays(Number(e.target.value))}
                className="mt-1 w-full rounded-lg bg-muted/10 border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs uppercase text-muted">
              Payout threshold ($)
              <input
                type="number"
                min={0}
                step="1"
                value={thresholdDollars}
                onChange={(e) => setThresholdDollars(Number(e.target.value))}
                className="mt-1 w-full rounded-lg bg-muted/10 border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs uppercase text-muted">
              Schedule
              <select
                value={schedule}
                onChange={(e) =>
                  setSchedule(e.target.value as "weekly" | "monthly" | "quarterly")
                }
                className="mt-1 w-full rounded-lg bg-muted/10 border border-border px-3 py-2 text-sm"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-4 py-2 text-sm bg-gold text-dark font-semibold rounded-lg disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create program"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Affiliates Tab ───────────────────────────────────────────────────────────
function AffiliatesTab({
  affiliates,
  programs,
  onChanged,
}: {
  affiliates: Affiliate[];
  programs: Program[];
  onChanged: () => void;
}) {
  const [showInvite, setShowInvite] = useState(false);

  if (programs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
        <p className="text-sm text-muted">
          Create a program first, then invite affiliates into it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">
          Invite affiliates by email — they get a unique ref code and a portal
          link to track their stats and connect Stripe.
        </p>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gold text-dark text-sm font-semibold rounded-lg"
        >
          <Mail size={16} /> Invite affiliate
        </button>
      </div>

      {affiliates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <Users size={32} className="mx-auto text-gold/60 mb-3" />
          <p className="text-sm text-muted">No affiliates yet</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/10 text-xs uppercase text-muted">
              <tr>
                <th className="text-left px-4 py-3">Affiliate</th>
                <th className="text-left px-4 py-3">Program</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Total earned</th>
                <th className="text-right px-4 py-3">Pending</th>
                <th className="text-left px-4 py-3">Stripe</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {affiliates.map((a) => (
                <AffiliateRow key={a.id} affiliate={a} onChanged={onChanged} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showInvite && (
        <InviteAffiliateModal
          programs={programs}
          onClose={() => setShowInvite(false)}
          onCreated={() => {
            setShowInvite(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function AffiliateRow({
  affiliate,
  onChanged,
}: {
  affiliate: Affiliate;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const setStatus = useCallback(
    async (status: AffiliateStatus) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/affiliate/affiliates/${affiliate.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success(`Status: ${status}`);
        onChanged();
      } catch (err) {
        console.error("[affiliates] update failed:", err);
        toast.error("Failed to update");
      } finally {
        setBusy(false);
      }
    },
    [affiliate.id, onChanged],
  );

  return (
    <tr className="border-t border-border hover:bg-muted/5">
      <td className="px-4 py-3">
        <div className="font-semibold">{affiliate.name}</div>
        <div className="text-xs text-muted">{affiliate.email}</div>
        <div className="text-[10px] text-muted/70 font-mono mt-0.5">
          {affiliate.ref_code}
        </div>
      </td>
      <td className="px-4 py-3 text-xs">
        {affiliate.affiliate_programs?.name ?? "—"}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={affiliate.status} />
      </td>
      <td className="px-4 py-3 text-right font-semibold text-gold">
        {fmtCents(affiliate.total_earned_cents)}
      </td>
      <td className="px-4 py-3 text-right">
        {affiliate.pending_cents > 0 ? (
          <span className="text-warning font-semibold">
            {fmtCents(affiliate.pending_cents)}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {affiliate.stripe_account_id ? (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <CheckCircle2 size={12} /> Connected
          </span>
        ) : (
          <span className="text-xs text-muted">Not connected</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2 items-center">
          {affiliate.status === "pending" && (
            <button
              onClick={() => setStatus("approved")}
              disabled={busy}
              className="text-xs px-2 py-1 bg-success/10 text-success rounded hover:bg-success/20"
            >
              Approve
            </button>
          )}
          {affiliate.status === "approved" && (
            <button
              onClick={() => setStatus("suspended")}
              disabled={busy}
              className="text-xs px-2 py-1 bg-warning/10 text-warning rounded hover:bg-warning/20"
            >
              Suspend
            </button>
          )}
          <Link
            href={`/dashboard/affiliates/${affiliate.id}`}
            className="text-muted hover:text-foreground"
          >
            <ChevronRight size={16} />
          </Link>
        </div>
      </td>
    </tr>
  );
}

type CommissionStatus = "pending" | "approved" | "paid" | "rejected" | "refunded";

function StatusBadge({ status }: { status: AffiliateStatus | ReferralStatus | ProgramStatus | CommissionStatus }) {
  const map: Record<string, string> = {
    active: "bg-success/15 text-success",
    approved: "bg-success/15 text-success",
    subscribed: "bg-success/15 text-success",
    paid: "bg-success/15 text-success",
    pending: "bg-warning/15 text-warning",
    paused: "bg-warning/15 text-warning",
    signed_up: "bg-blue-500/15 text-blue-400",
    clicked: "bg-muted/15 text-muted",
    suspended: "bg-danger/15 text-danger",
    rejected: "bg-danger/15 text-danger",
    cancelled: "bg-danger/15 text-danger",
    refunded: "bg-danger/15 text-danger",
    closed: "bg-muted/15 text-muted",
  };
  return (
    <span
      className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full whitespace-nowrap ${
        map[status] ?? "bg-muted/15 text-muted"
      }`}
    >
      {String(status).replace("_", " ")}
    </span>
  );
}

function InviteAffiliateModal({
  programs,
  onClose,
  onCreated,
}: {
  programs: Program[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [autoApprove, setAutoApprove] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(async () => {
    if (!programId) return toast.error("Pick a program");
    if (!email) return toast.error("Email required");
    if (!name) return toast.error("Name required");
    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliate/affiliates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          program_id: programId,
          email,
          name,
          approve: autoApprove,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      toast.success("Affiliate added");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add affiliate");
    } finally {
      setSubmitting(false);
    }
  }, [programId, email, name, autoApprove, onCreated]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invite affiliate</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block text-xs uppercase text-muted">
            Program
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="mt-1 w-full rounded-lg bg-muted/10 border border-border px-3 py-2 text-sm"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs uppercase text-muted">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="mt-1 w-full rounded-lg bg-muted/10 border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs uppercase text-muted">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="mt-1 w-full rounded-lg bg-muted/10 border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
            />
            Auto-approve so they can start sharing immediately
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-4 py-2 text-sm bg-gold text-dark font-semibold rounded-lg disabled:opacity-60"
          >
            {submitting ? "Adding…" : "Add affiliate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Referrals Tab ────────────────────────────────────────────────────────────
function ReferralsTab({
  referrals,
  affiliates,
}: {
  referrals: ReferralRow[];
  affiliates: Affiliate[];
}) {
  const [filterAffiliate, setFilterAffiliate] = useState<string>("");

  const filtered = useMemo(
    () =>
      filterAffiliate
        ? referrals.filter((r) => r.affiliate_id === filterAffiliate)
        : referrals,
    [referrals, filterAffiliate],
  );

  const byStatus: Record<"clicked" | "signed_up" | "subscribed", ReferralRow[]> = {
    clicked: filtered.filter((r) => r.status === "clicked"),
    signed_up: filtered.filter((r) => r.status === "signed_up"),
    subscribed: filtered.filter((r) => r.status === "subscribed"),
  };

  const totalClicks = filtered.length;
  const subs = byStatus.subscribed.length;
  const conversionRate = totalClicks > 0 ? (subs / totalClicks) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs uppercase text-muted">
          Filter by affiliate
          <select
            value={filterAffiliate}
            onChange={(e) => setFilterAffiliate(e.target.value)}
            className="ml-2 rounded-lg bg-muted/10 border border-border px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            {affiliates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.ref_code})
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto text-xs text-muted">
          {totalClicks} clicks → {subs} subscribed (
          <span className="text-success font-semibold">
            {conversionRate.toFixed(1)}%
          </span>
          )
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KanbanColumn
          title="Clicked"
          color="muted"
          rows={byStatus.clicked}
          affiliates={affiliates}
        />
        <KanbanColumn
          title="Signed up"
          color="blue"
          rows={byStatus.signed_up}
          affiliates={affiliates}
        />
        <KanbanColumn
          title="Subscribed"
          color="success"
          rows={byStatus.subscribed}
          affiliates={affiliates}
        />
      </div>
    </div>
  );
}

function KanbanColumn({
  title,
  color,
  rows,
  affiliates,
}: {
  title: string;
  color: "muted" | "blue" | "success";
  rows: ReferralRow[];
  affiliates: Affiliate[];
}) {
  const colorMap: Record<string, string> = {
    muted: "border-muted/40",
    blue: "border-blue-500/40",
    success: "border-success/40",
  };
  const titleMap: Record<string, string> = {
    muted: "text-muted",
    blue: "text-blue-400",
    success: "text-success",
  };
  const affiliateById = useMemo(() => {
    const m = new Map<string, Affiliate>();
    for (const a of affiliates) m.set(a.id, a);
    return m;
  }, [affiliates]);

  return (
    <div
      className={`rounded-2xl border-t-2 ${colorMap[color]} bg-card/40 p-4 space-y-3`}
    >
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold uppercase text-xs tracking-wide ${titleMap[color]}`}>
          {title}
        </h3>
        <span className="text-xs text-muted">{rows.length}</span>
      </div>
      <div className="space-y-2 max-h-[480px] overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-xs text-muted py-4 text-center">No referrals here yet</p>
        ) : (
          rows.map((r) => {
            const aff = affiliateById.get(r.affiliate_id);
            return (
              <div
                key={r.id}
                className="rounded-lg bg-muted/10 border border-border p-3 text-xs space-y-1"
              >
                <div className="font-semibold truncate">
                  {r.referred_email ?? "(anonymous click)"}
                </div>
                <div className="text-muted truncate">
                  via {aff?.name ?? "—"}
                  {r.source ? ` · ${r.source}` : ""}
                </div>
                <div className="text-[10px] text-muted/70">
                  {fmtDate(r.conversion_at ?? r.created_at)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Payouts Tab ──────────────────────────────────────────────────────────────
function PayoutsTab({
  affiliates,
  programs,
  onChanged,
}: {
  affiliates: Affiliate[];
  programs: Program[];
  onChanged: () => void;
}) {
  const [results, setResults] = useState<PayoutResult[] | null>(null);
  const [running, setRunning] = useState(false);

  const programById = useMemo(() => {
    const m = new Map<string, Program>();
    for (const p of programs) m.set(p.id, p);
    return m;
  }, [programs]);

  // Affiliates with pending balance, augmented with their program threshold
  // so the "ready to pay" filter is accurate.
  const eligible = useMemo(() => {
    return affiliates
      .filter((a) => a.pending_cents > 0 && a.status === "approved")
      .map((a) => {
        const p = programById.get(a.program_id);
        const threshold = p?.payout_threshold_cents ?? 0;
        return {
          affiliate: a,
          threshold,
          ready:
            !!a.stripe_account_id && a.pending_cents >= threshold,
        };
      });
  }, [affiliates, programById]);

  const readyCount = eligible.filter((e) => e.ready).length;
  const readyTotal = eligible
    .filter((e) => e.ready)
    .reduce((s, e) => s + e.affiliate.pending_cents, 0);

  const runPayouts = useCallback(
    async (dryRun: boolean) => {
      setRunning(true);
      setResults(null);
      try {
        const res = await fetch("/api/affiliate/payouts/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dry_run: dryRun }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          results: PayoutResult[];
          summary: { paid_count: number; total_paid_cents: number };
        };
        setResults(data.results);
        if (dryRun) {
          toast.success(`Dry run: ${data.summary.paid_count} would pay`);
        } else {
          toast.success(
            `Paid ${data.summary.paid_count} affiliate${
              data.summary.paid_count === 1 ? "" : "s"
            } (${fmtCents(data.summary.total_paid_cents)})`,
          );
          onChanged();
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Payout failed");
      } finally {
        setRunning(false);
      }
    },
    [onChanged],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/40 p-4">
        <div>
          <div className="text-sm font-semibold">
            {readyCount} affiliate{readyCount === 1 ? "" : "s"} ready to pay
          </div>
          <div className="text-xs text-muted">
            Total ready: <span className="text-gold font-semibold">{fmtCents(readyTotal)}</span>
            {" · "}Affiliates without Stripe Connect or below threshold are skipped.
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runPayouts(true)}
            disabled={running}
            className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted/10 disabled:opacity-60"
          >
            Dry run
          </button>
          <button
            onClick={() => runPayouts(false)}
            disabled={running || readyCount === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gold text-dark font-semibold rounded-lg disabled:opacity-60"
          >
            <DollarSign size={14} />
            {running ? "Paying…" : "Pay all"}
          </button>
        </div>
      </div>

      {eligible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <p className="text-sm text-muted">No pending payouts.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/10 text-xs uppercase text-muted">
              <tr>
                <th className="text-left px-4 py-3">Affiliate</th>
                <th className="text-right px-4 py-3">Pending</th>
                <th className="text-right px-4 py-3">Threshold</th>
                <th className="text-left px-4 py-3">Stripe</th>
                <th className="text-left px-4 py-3">Ready</th>
              </tr>
            </thead>
            <tbody>
              {eligible.map((e) => (
                <tr key={e.affiliate.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{e.affiliate.name}</div>
                    <div className="text-xs text-muted">{e.affiliate.email}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gold">
                    {fmtCents(e.affiliate.pending_cents)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted">
                    {fmtCents(e.threshold)}
                  </td>
                  <td className="px-4 py-3">
                    {e.affiliate.stripe_account_id ? (
                      <span className="text-xs text-success inline-flex items-center gap-1">
                        <CheckCircle2 size={12} /> Connected
                      </span>
                    ) : (
                      <span className="text-xs text-danger">Not connected</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.ready ? (
                      <span className="text-xs text-success">Yes</span>
                    ) : (
                      <span className="text-xs text-warning">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results && (
        <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-2">
          <h4 className="text-sm font-semibold">Last run</h4>
          <ul className="text-xs space-y-1">
            {results.map((r) => (
              <li
                key={`${r.affiliate_id}-${r.transfer_id ?? r.status}`}
                className="flex justify-between gap-4 border-b border-border last:border-0 py-2"
              >
                <span>{r.affiliate_email}</span>
                <span className="font-mono">{fmtCents(r.amount_cents, r.currency)}</span>
                <StatusBadge status={r.status === "paid" ? "paid" : "pending"} />
                {r.error && <span className="text-danger">{r.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
