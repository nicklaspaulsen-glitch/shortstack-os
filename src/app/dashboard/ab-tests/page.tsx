"use client";

/**
 * A/B Tests dashboard.
 *
 * Lists all running, paused, and completed tests for the authenticated
 * agency owner. Click a row to drill in to the variant builder + lift
 * table.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  FlaskConical,
  Plus,
  Trophy,
  TrendingUp,
  Clock,
  Pause,
  CheckCircle2,
  Trash2,
  ArrowRight,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

type ParentType = "landing_page" | "funnel_step" | "email";
type Status = "running" | "paused" | "completed";

interface Variant {
  id: string;
  variant_key: string;
  views: number;
  conversions: number;
  content: Record<string, unknown>;
}

interface AbTest {
  id: string;
  name: string;
  parent_type: ParentType;
  parent_id: string;
  status: Status;
  started_at: string;
  ended_at: string | null;
  winner_variant_id: string | null;
  ab_variants: Variant[];
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: React.ReactNode }> = {
  running: {
    label: "Running",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    icon: <Clock size={11} />,
  },
  paused: {
    label: "Paused",
    color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    icon: <Pause size={11} />,
  },
  completed: {
    label: "Completed",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    icon: <CheckCircle2 size={11} />,
  },
};

const PARENT_LABEL: Record<ParentType, string> = {
  landing_page: "Landing Page",
  funnel_step: "Funnel Step",
  email: "Email",
};

function conversionRate(v: Variant): number {
  if (v.views <= 0) return 0;
  return Math.round((v.conversions / v.views) * 100);
}

function bestVariant(test: AbTest): Variant | null {
  if (!test.ab_variants?.length) return null;
  return [...test.ab_variants].sort((a, b) => conversionRate(b) - conversionRate(a))[0];
}

export default function AbTestsPage() {
  const [tests, setTests] = useState<AbTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ab-tests");
      if (!res.ok) throw new Error("load failed");
      const json = (await res.json()) as { tests: AbTest[] };
      setTests(json.tests ?? []);
    } catch {
      toast.error("Failed to load A/B tests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this A/B test? Variant data is lost.")) return;
    try {
      const res = await fetch(`/api/ab-tests/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setTests((prev) => prev.filter((t) => t.id !== id));
      toast.success("Test deleted");
    } catch {
      toast.error("Delete failed");
    }
  }

  async function handleStatusChange(id: string, status: Status) {
    try {
      const res = await fetch(`/api/ab-tests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setTests((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
      toast.success(`Test ${status}`);
    } catch {
      toast.error("Status update failed");
    }
  }

  const summary = useMemo(() => {
    const running = tests.filter((t) => t.status === "running").length;
    const completed = tests.filter((t) => t.status === "completed").length;
    const totalLift = tests.reduce((acc, t) => {
      const winner = bestVariant(t);
      if (!winner) return acc;
      const baseline = t.ab_variants[0];
      if (!baseline || baseline.id === winner.id) return acc;
      return acc + Math.max(0, conversionRate(winner) - conversionRate(baseline));
    }, 0);
    return { running, completed, totalLift };
  }, [tests]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHero
        title="A/B Tests"
        subtitle="Run head-to-head experiments on landing pages, funnel steps, and emails. Pick the winner with confidence."
        icon={<FlaskConical size={22} />}
        gradient="purple"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            <Plus size={15} />
            New Test
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <SummaryTile label="Running" value={summary.running} icon={<Clock size={16} />} color="text-emerald-400" />
        <SummaryTile label="Completed" value={summary.completed} icon={<Trophy size={16} />} color="text-blue-400" />
        <SummaryTile label="Total Lift" value={`+${summary.totalLift}%`} icon={<TrendingUp size={16} />} color="text-purple-400" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white/4 animate-pulse" />
          ))}
        </div>
      ) : tests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <FlaskConical size={28} className="text-purple-400" />
          </div>
          <div className="text-center">
            <p className="text-zinc-200 font-semibold text-lg">No A/B tests yet</p>
            <p className="text-zinc-500 text-sm mt-1">
              Run a test from any landing page or funnel step to start comparing variants.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
          >
            <Plus size={15} />
            Start Test
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {tests.map((test) => {
            const sc = STATUS_CONFIG[test.status];
            const winner = bestVariant(test);
            const baseline = test.ab_variants[0];
            const lift = winner && baseline && baseline.id !== winner.id
              ? conversionRate(winner) - conversionRate(baseline)
              : 0;
            return (
              <div
                key={test.id}
                className="group relative bg-zinc-900/60 border border-white/8 rounded-xl p-4 hover:border-white/15 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <Link href={`/dashboard/ab-tests/${test.id}`} className="text-white font-semibold text-base hover:underline">
                      {test.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                      <span>{PARENT_LABEL[test.parent_type]}</span>
                      <span>·</span>
                      <span>Started {new Date(test.started_at).toLocaleDateString()}</span>
                      <span>·</span>
                      <span>{test.ab_variants.length} variants</span>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sc.color} shrink-0`}>
                    {sc.icon}
                    {sc.label}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {test.ab_variants.map((v) => {
                    const isWinner = v.id === test.winner_variant_id;
                    return (
                      <div
                        key={v.id}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs border ${
                          isWinner
                            ? "bg-amber-400/10 border-amber-400/30 text-amber-300"
                            : "bg-white/4 border-white/8 text-zinc-300"
                        }`}
                      >
                        {isWinner && <Trophy size={11} />}
                        <span className="font-semibold">{v.variant_key}</span>
                        <span className="text-zinc-500">{v.views} views</span>
                        <span className="text-emerald-400">{conversionRate(v)}% conv</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  {lift > 0 ? (
                    <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                      <TrendingUp size={12} />+{lift}% lift
                    </span>
                  ) : (
                    <span className="text-zinc-600 text-xs">No lift yet</span>
                  )}
                  <div className="flex items-center gap-1">
                    {test.status === "running" && (
                      <button
                        onClick={() => void handleStatusChange(test.id, "paused")}
                        className="p-1.5 rounded-md hover:bg-white/8 text-zinc-400 hover:text-amber-400 transition-colors"
                        title="Pause"
                      >
                        <Pause size={13} />
                      </button>
                    )}
                    {test.status === "paused" && (
                      <button
                        onClick={() => void handleStatusChange(test.id, "running")}
                        className="p-1.5 rounded-md hover:bg-white/8 text-zinc-400 hover:text-emerald-400 transition-colors"
                        title="Resume"
                      >
                        <Clock size={13} />
                      </button>
                    )}
                    <Link
                      href={`/dashboard/ab-tests/${test.id}`}
                      className="p-1.5 rounded-md hover:bg-white/8 text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Open"
                    >
                      <ArrowRight size={13} />
                    </Link>
                    <button
                      onClick={() => void handleDelete(test.id)}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateTestModal onClose={() => setShowCreate(false)} onCreated={() => void load()} />}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-zinc-900/40 border border-white/6 rounded-xl p-4">
      <div className={`${color} mb-2`}>{icon}</div>
      <div className="text-white font-bold text-xl">{value}</div>
      <div className="text-zinc-500 text-xs mt-0.5">{label}</div>
    </div>
  );
}

function CreateTestModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [parentType, setParentType] = useState<ParentType>("landing_page");
  const [parentId, setParentId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!name.trim() || !parentId.trim()) {
      toast.error("Name and parent id are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/ab-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          parent_type: parentType,
          parent_id: parentId.trim(),
          variants: [
            { variant_key: "A", content: {} },
            { variant_key: "B", content: {} },
          ],
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "create failed");
      }
      toast.success("Test created");
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-white mb-4">New A/B Test</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Homepage hero v2"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Surface</label>
            <select
              value={parentType}
              onChange={(e) => setParentType(e.target.value as ParentType)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="landing_page">Landing Page</option>
              <option value="funnel_step">Funnel Step</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Parent id</label>
            <input
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              placeholder="UUID of the surface to test"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-500 font-mono"
            />
            <p className="text-[11px] text-white/40 mt-1">
              Find this id from the URL of the landing page / funnel step / email.
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {submitting ? "Creating…" : "Create Test"}
          </button>
        </div>
      </div>
    </div>
  );
}
