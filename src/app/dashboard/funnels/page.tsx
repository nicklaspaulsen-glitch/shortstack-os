"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  Plus, Eye, Search,
  Clock, CheckCircle2, Archive, Trash2, Copy, Pencil,
  ChevronRight, Layers,
} from "lucide-react";
import { MotionPage } from "@/components/motion/motion-page";

type FunnelStatus = "draft" | "published" | "archived";

interface Funnel {
  id: string;
  name: string;
  description: string | null;
  status: FunnelStatus;
  step_count: number;
  total_views: number;
  conversion_rate: number;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<FunnelStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: {
    label: "Draft",
    color: "text-amber-700 bg-amber-500/10 border-amber-500/20",
    icon: <Clock size={11} />,
  },
  published: {
    label: "Published",
    color: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20",
    icon: <CheckCircle2 size={11} />,
  },
  archived: {
    label: "Archived",
    color: "text-zinc-600 bg-zinc-500/10 border-zinc-500/20",
    icon: <Archive size={11} />,
  },
};

type FilterTab = "all" | FunnelStatus;

export default function FunnelsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      const res = await fetch(`/api/funnels?${params}`);
      const json = await res.json();
      setFunnels(json.funnels ?? []);
    } catch {
      toast.error("Failed to load funnels");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const filtered = funnels.filter((f) =>
    search ? f.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  async function handleDelete(id: string) {
    if (!confirm("Delete this funnel? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/funnels/${id}`, { method: "DELETE" });
      toast.success("Funnel deleted");
      void load();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDuplicate(funnel: Funnel) {
    try {
      const res = await fetch("/api/funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${funnel.name} (copy)`,
          description: funnel.description,
          status: "draft",
        }),
      });
      const json = await res.json();
      toast.success("Funnel duplicated");
      router.push(`/dashboard/funnels/${json.funnel.id}`);
    } catch {
      toast.error("Duplicate failed");
    }
  }

  const TABS: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "published", label: "Published" },
    { id: "draft", label: "Drafts" },
    { id: "archived", label: "Archived" },
  ];

  return (
    <MotionPage className="p-6 space-y-6 max-w-7xl mx-auto">{/* -- Funnels command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">FUNNELS</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Funnels</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
                  onClick={() => router.push("/dashboard/funnels/new")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white text-zinc-900 hover:bg-zinc-100 transition-colors"
                >
                  <Plus size={15} />
                  New Funnel
                </button>
      </div>
    </div>{/* Tabs + Search */}<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1 bg-black/[0.04] border border-black/[0.08] rounded-lg p-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      filter === tab.id
                        ? "bg-[rgba(59,130,246,0.08)] text-blue-700 border border-[rgba(59,130,246,0.25)]"
                        : "text-[#6B7280] hover:text-[#374151]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search funnels…"
                  className="bg-white border border-black/[0.08] rounded-lg pl-9 pr-4 py-2 text-sm text-[#374151] placeholder-[#9CA3AF] outline-none focus:border-[rgba(59,130,246,0.25)] w-56"
                />
              </div>
            </div>{/* Grid */}{loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-48 rounded-xl bg-black/[0.04] animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-16 h-16  bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.15)] flex items-center justify-center">
                  <Layers size={28} className="text-brand-accent" />
                </div>
                <div className="text-center">
                  <p className="text-[#111827] font-semibold text-lg">No funnels yet</p>
                  <p className="text-[#6B7280] text-sm mt-1">Create your first funnel to start converting visitors.</p>
                </div>
                <button
                  onClick={() => router.push("/dashboard/funnels/new")}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-accent hover:bg-brand-accent/80 text-white text-sm font-semibold transition-colors"
                >
                  <Plus size={15} />
                  Create Funnel
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((funnel, index) => {
                  const sc = STATUS_CONFIG[funnel.status];
                  return (
                    <motion.div
                      key={funnel.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: index * 0.06 }}
                      whileHover={{ y: -4, scale: 1.01 }}
                      className="group relative bg-white border border-black/[0.06] shadow-sm rounded-xl p-5 cursor-pointer"
                      onClick={() => router.push(`/dashboard/funnels/${funnel.id}`)}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[#111827] font-semibold text-base truncate">{funnel.name}</h3>
                          {funnel.description && (
                            <p className="text-[#6B7280] text-xs mt-0.5 line-clamp-1">{funnel.description}</p>
                          )}
                        </div>
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sc.color} shrink-0`}>
                          {sc.icon}
                          {sc.label}
                        </span>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                          <div className="text-[#111827] font-bold text-lg leading-none">{funnel.step_count}</div>
                          <div className="text-[#6B7280] text-[10px] mt-0.5">Steps</div>
                        </div>
                        <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                          <div className="text-[#111827] font-bold text-lg leading-none flex items-center justify-center gap-0.5">
                            <Eye size={12} className="text-text-muted" />
                            {funnel.total_views.toLocaleString()}
                          </div>
                          <div className="text-[#6B7280] text-[10px] mt-0.5">Views</div>
                        </div>
                        <div className="bg-black/[0.04] rounded-lg p-2 text-center">
                          <div className={`font-bold text-lg leading-none ${funnel.conversion_rate >= 20 ? "text-emerald-700" : funnel.conversion_rate >= 10 ? "text-amber-700" : "text-[#6B7280]"}`}>
                            {funnel.conversion_rate}%
                          </div>
                          <div className="text-[#6B7280] text-[10px] mt-0.5">Conv.</div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between">
                        <span className="text-text-muted text-xs">
                          {new Date(funnel.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                        <div
                          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleDuplicate(funnel)}
                            className="p-1.5 rounded-md hover:bg-black/[0.06] text-text-muted hover:text-[#374151] transition-colors"
                            title="Duplicate"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            onClick={() => router.push(`/dashboard/funnels/${funnel.id}`)}
                            className="p-1.5 rounded-md hover:bg-black/[0.06] text-text-muted hover:text-[#374151] transition-colors"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(funnel.id)}
                            disabled={deletingId === funnel.id}
                            className="p-1.5 rounded-md hover:bg-red-500/10 text-text-muted hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                          <ChevronRight size={13} className="text-text-muted ml-1" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}{/* Stats summary */}{funnels.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4 pt-2">
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-3 bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                  <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-[#2563EB] to-[#3B82F6] shrink-0" />
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Total Views</p>
                    <p className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary tabular-nums">{funnels.reduce((a, f) => a + f.total_views, 0).toLocaleString()}</p>
                    <p className="text-[11px] text-text-muted mt-1.5">{funnels.length} funnels</p>
                  </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Published</p>
                  <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{funnels.filter((f) => f.status === "published").length}</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Avg Conversion</p>
                  <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{funnels.length ? `${Math.round(funnels.reduce((a, f) => a + f.conversion_rate, 0) / funnels.length)}%` : "0%"}</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Total Funnels</p>
                  <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{funnels.length}</p>
                </motion.div>
              </div>
            )}</MotionPage>
  );
}
