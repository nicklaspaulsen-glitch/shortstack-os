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
import { motion } from "framer-motion";
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
import { PRISM_RAINBOW_GRADIENT } from "@/components/prism";
import { MotionPage } from "@/components/motion/motion-page";

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
    color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
    icon: <Clock size={11} />,
  },
  paused: {
    label: "Paused",
    color: "text-brand-accent bg-[rgba(37,99,235,0.08)] border-[rgba(37,99,235,0.25)]",
    icon: <Pause size={11} />,
  },
  completed: {
    label: "Completed",
    color: "text-brand-accent bg-[rgba(37,99,235,0.08)] border-[rgba(37,99,235,0.25)]",
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
    <MotionPage className="p-6 space-y-6 max-w-7xl mx-auto">{/* -- A/B Tests command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">A/B TESTS</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">A/B Tests</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white text-zinc-900 hover:bg-zinc-100 transition-colors"
                >
                  <Plus size={15} />
                  New Test
                </button>
      </div>
    </div><div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <SummaryTile label="Running" value={summary.running} icon={<Clock size={16} />} color="text-emerald-600" index={0} />
              <SummaryTile label="Completed" value={summary.completed} icon={<Trophy size={16} />} color="text-brand-accent" index={1} />
              <SummaryTile label="Total Lift" value={`+${summary.totalLift}%`} icon={<TrendingUp size={16} />} color="text-brand-accent" index={2} />
            </div>{loading ? (
              <div className="grid grid-cols-1 gap-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-[rgba(0,0,0,0.04)] border border-[rgba(0,0,0,0.06)] animate-pulse" />
                ))}
              </div>
            ) : tests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-16 h-16  bg-[rgba(37,99,235,0.08)] border border-[rgba(37,99,235,0.25)] flex items-center justify-center">
                  <FlaskConical size={28} className="text-brand-accent" />
                </div>
                <div className="text-center">
                  <p className="text-[#111827] font-semibold text-lg">No A/B tests yet</p>
                  <p className="text-[#6B7280] text-sm mt-1">
                    Run a test from any landing page or funnel step to start comparing variants.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-accent hover:bg-[#3B82F6] text-white text-sm font-semibold transition-colors"
                >
                  <Plus size={15} />
                  Start Test
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {tests.map((test, i) => {
                  const sc = STATUS_CONFIG[test.status];
                  const winner = bestVariant(test);
                  const baseline = test.ab_variants[0];
                  const lift = winner && baseline && baseline.id !== winner.id
                    ? conversionRate(winner) - conversionRate(baseline)
                    : 0;
                  return (
                    <motion.div
                      key={test.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                      whileHover={{ y: -4, scale: 1.01 }}
                      className="group relative bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <Link href={`/dashboard/ab-tests/${test.id}`} className="text-[#111827] font-semibold text-base hover:underline">
                            {test.name}
                          </Link>
                          <div className="flex items-center gap-2 mt-1 text-xs text-[#6B7280]">
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
                                  ? "bg-[rgba(37,99,235,0.08)] border-[rgba(37,99,235,0.25)] text-brand-accent"
                                  : "bg-[rgba(0,0,0,0.04)] border-[rgba(0,0,0,0.08)] text-[#374151]"
                              }`}
                            >
                              {isWinner && <Trophy size={11} />}
                              <span className="font-semibold">{v.variant_key}</span>
                              <span className="text-[#6B7280]">{v.views} views</span>
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
                          <span className="text-text-muted text-xs">No lift yet</span>
                        )}
                        <div className="flex items-center gap-1">
                          {test.status === "running" && (
                            <button
                              onClick={() => void handleStatusChange(test.id, "paused")}
                              className="p-1.5 rounded-md hover:bg-[rgba(0,0,0,0.06)] text-text-muted hover:text-brand-accent transition-colors"
                              title="Pause"
                            >
                              <Pause size={13} />
                            </button>
                          )}
                          {test.status === "paused" && (
                            <button
                              onClick={() => void handleStatusChange(test.id, "running")}
                              className="p-1.5 rounded-md hover:bg-[rgba(0,0,0,0.06)] text-text-muted hover:text-emerald-400 transition-colors"
                              title="Resume"
                            >
                              <Clock size={13} />
                            </button>
                          )}
                          <Link
                            href={`/dashboard/ab-tests/${test.id}`}
                            className="p-1.5 rounded-md hover:bg-[rgba(0,0,0,0.06)] text-text-muted hover:text-[#374151] transition-colors"
                            title="Open"
                          >
                            <ArrowRight size={13} />
                          </Link>
                          <button
                            onClick={() => void handleDelete(test.id)}
                            className="p-1.5 rounded-md hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}{showCreate && <CreateTestModal onClose={() => setShowCreate(false)} onCreated={() => void load()} />}</MotionPage>
  );
}

function SummaryTile({
  label,
  value,
  icon,
  color,
  index,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className="glass rounded-xl overflow-hidden"
    >
      <div style={{ height: 3, background: PRISM_RAINBOW_GRADIENT, borderRadius: "4px 4px 0 0" }} />
      <div className="p-4">
        <div className={`${color} mb-2`}>{icon}</div>
        <div className="text-[#111827] font-bold text-xl">{value}</div>
        <div className="text-[#6B7280] text-xs mt-0.5">{label}</div>
      </div>
    </motion.div>
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
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.50)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl shadow-xl p-6 w-full max-w-md"
      >
        <h2 className="text-lg font-semibold text-[#111827] mb-4">New A/B Test</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#6B7280] mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Homepage hero v2"
              className="w-full border border-[rgba(0,0,0,0.10)] rounded-lg px-3 py-2 text-[#111827] placeholder-[#9CA3AF] text-sm focus:outline-none focus:border-brand-accent bg-white"
            />
          </div>
          <div>
            <label className="block text-sm text-[#6B7280] mb-1">Surface</label>
            <select
              value={parentType}
              onChange={(e) => setParentType(e.target.value as ParentType)}
              className="w-full border border-[rgba(0,0,0,0.10)] rounded-lg px-3 py-2 text-[#111827] text-sm focus:outline-none focus:border-brand-accent bg-white"
            >
              <option value="landing_page">Landing Page</option>
              <option value="funnel_step">Funnel Step</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-[#6B7280] mb-1">Parent id</label>
            <input
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              placeholder="UUID of the surface to test"
              className="w-full border border-[rgba(0,0,0,0.10)] rounded-lg px-3 py-2 text-[#111827] placeholder-[#9CA3AF] text-sm focus:outline-none focus:border-brand-accent font-mono bg-white"
            />
            <p className="text-[11px] text-text-muted mt-1">
              Find this id from the URL of the landing page / funnel step / email.
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-[rgba(0,0,0,0.10)] hover:bg-[rgba(0,0,0,0.06)] text-[#374151] rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-brand-accent hover:bg-[#3B82F6] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {submitting ? "Creating…" : "Create Test"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
