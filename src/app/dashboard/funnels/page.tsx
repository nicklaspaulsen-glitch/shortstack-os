"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import toast from "react-hot-toast";
import {
  GitBranch, Plus, Eye, TrendingUp, BarChart3, Search,
  Clock, CheckCircle2, Archive, Trash2, Copy, Pencil,
  ChevronRight, Filter, Layers,
} from "lucide-react";

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
    color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    icon: <Clock size={11} />,
  },
  published: {
    label: "Published",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    icon: <CheckCircle2 size={11} />,
  },
  archived: {
    label: "Archived",
    color: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20",
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHero
        title="Funnels"
        subtitle="Build multi-step conversion funnels and track drop-off at every stage."
        icon={<GitBranch size={22} />}
        gradient="purple"
        actions={
          <button
            onClick={() => router.push("/dashboard/funnels/new")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            <Plus size={15} />
            New Funnel
          </button>
        }
      />

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/8 rounded-lg p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                filter === tab.id
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search funnels…"
            className="pl-9 pr-4 py-2 rounded-lg bg-zinc-900/60 border border-white/8 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-white/20 w-56"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-white/4 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Layers size={28} className="text-purple-400" />
          </div>
          <div className="text-center">
            <p className="text-zinc-200 font-semibold text-lg">No funnels yet</p>
            <p className="text-zinc-500 text-sm mt-1">Create your first funnel to start converting visitors.</p>
          </div>
          <button
            onClick={() => router.push("/dashboard/funnels/new")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
          >
            <Plus size={15} />
            Create Funnel
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((funnel) => {
            const sc = STATUS_CONFIG[funnel.status];
            return (
              <div
                key={funnel.id}
                className="group relative bg-zinc-900/60 border border-white/8 rounded-xl p-5 hover:border-white/15 transition-all cursor-pointer"
                onClick={() => router.push(`/dashboard/funnels/${funnel.id}`)}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-base truncate">{funnel.name}</h3>
                    {funnel.description && (
                      <p className="text-zinc-500 text-xs mt-0.5 line-clamp-1">{funnel.description}</p>
                    )}
                  </div>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sc.color} shrink-0`}>
                    {sc.icon}
                    {sc.label}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-white/4 rounded-lg p-2 text-center">
                    <div className="text-white font-bold text-lg leading-none">{funnel.step_count}</div>
                    <div className="text-zinc-500 text-[10px] mt-0.5">Steps</div>
                  </div>
                  <div className="bg-white/4 rounded-lg p-2 text-center">
                    <div className="text-white font-bold text-lg leading-none flex items-center justify-center gap-0.5">
                      <Eye size={12} className="text-zinc-400" />
                      {funnel.total_views.toLocaleString()}
                    </div>
                    <div className="text-zinc-500 text-[10px] mt-0.5">Views</div>
                  </div>
                  <div className="bg-white/4 rounded-lg p-2 text-center">
                    <div className={`font-bold text-lg leading-none ${funnel.conversion_rate >= 20 ? "text-emerald-400" : funnel.conversion_rate >= 10 ? "text-amber-400" : "text-zinc-400"}`}>
                      {funnel.conversion_rate}%
                    </div>
                    <div className="text-zinc-500 text-[10px] mt-0.5">Conv.</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 text-xs">
                    {new Date(funnel.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <div
                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleDuplicate(funnel)}
                      className="p-1.5 rounded-md hover:bg-white/8 text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Duplicate"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      onClick={() => router.push(`/dashboard/funnels/${funnel.id}`)}
                      className="p-1.5 rounded-md hover:bg-white/8 text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(funnel.id)}
                      disabled={deletingId === funnel.id}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                    <ChevronRight size={13} className="text-zinc-600 ml-1" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats summary */}
      {funnels.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          {[
            { label: "Total Funnels", value: funnels.length, icon: <Filter size={16} />, color: "text-purple-400" },
            { label: "Published", value: funnels.filter((f) => f.status === "published").length, icon: <CheckCircle2 size={16} />, color: "text-emerald-400" },
            { label: "Total Views", value: funnels.reduce((a, f) => a + f.total_views, 0).toLocaleString(), icon: <Eye size={16} />, color: "text-blue-400" },
            {
              label: "Avg Conversion",
              value: funnels.length
                ? `${Math.round(funnels.reduce((a, f) => a + f.conversion_rate, 0) / funnels.length)}%`
                : "0%",
              icon: <TrendingUp size={16} />,
              color: "text-amber-400",
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-zinc-900/40 border border-white/6 rounded-xl p-4">
              <div className={`${stat.color} mb-2`}>{stat.icon}</div>
              <div className="text-white font-bold text-xl">{stat.value}</div>
              <div className="text-zinc-500 text-xs mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
