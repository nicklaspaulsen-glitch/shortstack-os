"use client";

/**
 * A/B Test detail — variant table, lift chart, declare winner.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  FlaskConical,
  Plus,
  Trophy,
  TrendingUp,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Pause,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

interface Variant {
  id: string;
  variant_key: string;
  content: Record<string, unknown>;
  views: number;
  conversions: number;
  created_at: string;
}

interface AbTest {
  id: string;
  name: string;
  parent_type: string;
  parent_id: string;
  status: "running" | "paused" | "completed";
  started_at: string;
  ended_at: string | null;
  winner_variant_id: string | null;
  ab_variants: Variant[];
}

function conversionRate(v: Variant): number {
  if (v.views <= 0) return 0;
  return Math.round((v.conversions / v.views) * 1000) / 10;
}

export default function AbTestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [test, setTest] = useState<AbTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newVariantKey, setNewVariantKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ab-tests/${id}`);
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { test: AbTest };
      setTest(json.test);
    } catch {
      toast.error("Failed to load test");
      router.push("/dashboard/ab-tests");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addVariant() {
    if (!newVariantKey.trim()) return toast.error("Variant key required");
    setAdding(true);
    try {
      const res = await fetch(`/api/ab-tests/${id}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_key: newVariantKey.trim(), content: {} }),
      });
      if (!res.ok) throw new Error();
      toast.success("Variant added");
      setNewVariantKey("");
      void load();
    } catch {
      toast.error("Add failed");
    } finally {
      setAdding(false);
    }
  }

  async function declareWinner(variantId: string) {
    if (!confirm("Declare this variant the winner? The test will be marked completed.")) return;
    try {
      const res = await fetch(`/api/ab-tests/${id}/declare-winner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_id: variantId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Winner declared");
      void load();
    } catch {
      toast.error("Failed to declare winner");
    }
  }

  async function setStatus(status: "running" | "paused" | "completed") {
    try {
      const res = await fetch(`/api/ab-tests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Test ${status}`);
      void load();
    } catch {
      toast.error("Status update failed");
    }
  }

  if (loading || !test) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="h-32 rounded-2xl bg-white/4 animate-pulse" />
        <div className="h-64 rounded-2xl bg-white/4 animate-pulse" />
      </div>
    );
  }

  const variants = [...test.ab_variants].sort((a, b) => a.variant_key.localeCompare(b.variant_key));
  const baseline = variants[0];
  const baselineRate = baseline ? conversionRate(baseline) : 0;
  const totalViews = variants.reduce((acc, v) => acc + v.views, 0);

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <PageHero
        title={test.name}
        subtitle={`Surface: ${test.parent_type.replace(/_/g, " ")} · Started ${new Date(test.started_at).toLocaleDateString()}`}
        icon={<FlaskConical size={22} />}
        gradient="purple"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard/ab-tests")}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 text-white/80"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            {test.status === "running" && (
              <button
                onClick={() => void setStatus("paused")}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-amber-500/15 hover:bg-amber-500/25 text-amber-300"
              >
                <Pause size={14} />
                Pause
              </button>
            )}
            {test.status === "paused" && (
              <button
                onClick={() => void setStatus("running")}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300"
              >
                <Clock size={14} />
                Resume
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Status" value={test.status} />
        <Tile label="Variants" value={variants.length} />
        <Tile label="Total views" value={totalViews} />
        <Tile label="Baseline rate" value={`${baselineRate}%`} />
      </div>

      <div className="bg-zinc-900/60 border border-white/8 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/4 text-xs uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left">Variant</th>
              <th className="px-4 py-3 text-right">Views</th>
              <th className="px-4 py-3 text-right">Conversions</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-right">Lift vs A</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const rate = conversionRate(v);
              const lift = baseline && v.id !== baseline.id ? rate - baselineRate : 0;
              const isWinner = v.id === test.winner_variant_id;
              return (
                <tr
                  key={v.id}
                  className={`border-t border-white/4 ${isWinner ? "bg-amber-400/5" : ""}`}
                >
                  <td className="px-4 py-3 font-semibold text-white">
                    <div className="flex items-center gap-2">
                      {isWinner && <Trophy size={14} className="text-amber-400" />}
                      {v.variant_key}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300">{v.views}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{v.conversions}</td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{rate}%</td>
                  <td className="px-4 py-3 text-right">
                    {v.id === baseline?.id ? (
                      <span className="text-zinc-500">—</span>
                    ) : lift > 0 ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1 justify-end">
                        <TrendingUp size={11} />+{lift.toFixed(1)}%
                      </span>
                    ) : lift < 0 ? (
                      <span className="text-red-400 font-semibold">{lift.toFixed(1)}%</span>
                    ) : (
                      <span className="text-zinc-500">0%</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {test.status !== "completed" && (
                      <button
                        onClick={() => void declareWinner(v.id)}
                        className="text-xs px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300"
                      >
                        Declare winner
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {test.status !== "completed" && (
        <div className="bg-zinc-900/60 border border-white/8 rounded-xl p-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-white/60 mb-1">Add variant</label>
            <input
              value={newVariantKey}
              onChange={(e) => setNewVariantKey(e.target.value)}
              placeholder="Variant key (e.g. C)"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            onClick={() => void addVariant()}
            disabled={adding}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            <Plus size={14} />
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      )}

      {test.status === "completed" && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3 text-emerald-300">
          <CheckCircle2 size={18} />
          Test completed{test.ended_at ? ` on ${new Date(test.ended_at).toLocaleDateString()}` : ""}.
        </div>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-zinc-900/40 border border-white/6 rounded-xl p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-white font-bold text-lg mt-0.5">{value}</div>
    </div>
  );
}
