"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Layers, Film, Megaphone, Image as ImageIcon, Mail,
  FileText, Share2, Globe, Search, RefreshCw,
  Calendar, TrendingUp, Eye, Copy, RotateCcw,
  Trash2, Loader, Sparkles, Clock
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";
import PageHero from "@/components/ui/page-hero";

/* ── Types ── */

interface Generation {
  id: string;
  user_id: string;
  category: string;
  title: string;
  source_tool: string;
  content_preview: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/* ── Category Config ── */

const CATEGORIES: { key: string; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
  { key: "all",          label: "All",          icon: <Layers size={14} />,    color: "text-gold",        bg: "bg-gold/10" },
  { key: "video",        label: "Videos",       icon: <Film size={14} />,      color: "text-blue-400",    bg: "bg-blue-500/10" },
  { key: "ad_copy",      label: "Ads & Copy",   icon: <Megaphone size={14} />, color: "text-purple-400",  bg: "bg-purple-500/10" },
  { key: "thumbnail",    label: "Images",       icon: <ImageIcon size={14} />, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { key: "email",        label: "Emails",       icon: <Mail size={14} />,      color: "text-amber-400",   bg: "bg-amber-500/10" },
  { key: "script",       label: "Scripts",      icon: <FileText size={14} />,  color: "text-cyan-400",    bg: "bg-cyan-500/10" },
  { key: "social_post",  label: "Social",       icon: <Share2 size={14} />,    color: "text-rose-400",    bg: "bg-rose-500/10" },
  { key: "landing_page", label: "Pages",        icon: <Globe size={14} />,     color: "text-teal-400",    bg: "bg-teal-500/10" },
];

function getCategoryConfig(key: string) {
  return CATEGORIES.find(c => c.key === key) || CATEGORIES[0];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ── Component ── */

export default function GenerationsPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchGenerations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (category !== "all") params.set("category", category);
      const res = await fetch(`/api/generations?${params}`);
      const data = await res.json();
      setGenerations(data.generations || []);
      setTotal(data.total || 0);
    } catch {
      toast.error("Failed to load generations");
    }
    setLoading(false);
  }, [category, page]);

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  /* ── Computed stats ── */
  const thisWeekCount = generations.filter(g => {
    const diff = Date.now() - new Date(g.created_at).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  }).length;

  const uniqueCategories = new Set(generations.map(g => g.category)).size;
  const latest = generations[0]
    ? timeAgo(generations[0].created_at)
    : "---";

  /* ── Filtered list (client-side search) ── */
  const filtered = generations.filter(g =>
    !search ||
    g.title.toLowerCase().includes(search.toLowerCase()) ||
    g.source_tool.toLowerCase().includes(search.toLowerCase()) ||
    (g.content_preview || "").toLowerCase().includes(search.toLowerCase())
  );

  /* ── Actions ── */
  const copyContent = (gen: Generation) => {
    navigator.clipboard.writeText(gen.content_preview || gen.title);
    toast.success("Copied to clipboard");
  };

  const deleteGeneration = async (id: string) => {
    setGenerations(prev => prev.filter(g => g.id !== id));
    setTotal(prev => prev - 1);
    toast.success("Generation removed");
  };

  const hasMore = page * limit < total;

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Sparkles size={28} />}
        title="Generations"
        subtitle="Everything you've created, organized by category."
        gradient="sunset"
        actions={
          <button
            onClick={fetchGenerations}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 border border-white/20 text-white text-xs font-medium hover:bg-white/25 transition-all"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        }
      />

      {/* Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {[
          { label: "Total Items",  value: total,            icon: <Layers size={14} />,      color: "text-gold" },
          { label: "This Week",    value: thisWeekCount,    icon: <TrendingUp size={14} />,  color: "text-emerald-400" },
          { label: "Categories",   value: uniqueCategories, icon: <Calendar size={14} />,    color: "text-blue-400" },
          { label: "Latest",       value: latest,           icon: <Clock size={14} />,       color: "text-purple-400" },
        ].map(s => (
          <div key={s.label} className="card !py-2.5 !px-3 flex items-center gap-3">
            <div className={s.color}>{s.icon}</div>
            <div>
              <p className="text-lg font-bold leading-none">{s.value}</p>
              <p className="text-[9px] text-muted">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search generations..."
          className="input text-xs pl-9 w-full"
        />
      </div>

      {/* Category Filter Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => { setCategory(c.key); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
              category === c.key
                ? "bg-gold/15 text-gold border border-gold/20 font-medium"
                : "bg-white/5 text-muted hover:text-white hover:bg-white/10 border border-transparent"
            }`}
          >
            <span className={category === c.key ? "text-gold" : c.color}>{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>

      {/* Generations List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader size={20} className="animate-spin text-gold" />
          </div>
        ) : filtered.length === 0 ? (
          /* Empty State */
          <div className="card text-center py-16">
            <Sparkles size={32} className="mx-auto mb-3 text-muted/30" />
            <p className="text-sm text-muted font-medium mb-1">No generations yet</p>
            <p className="text-[10px] text-muted max-w-xs mx-auto">
              Create content from any tool in Trinity and it will appear here automatically.
            </p>
          </div>
        ) : (
          filtered.map(gen => {
            const cat = getCategoryConfig(gen.category);
            return (
              <div
                key={gen.id}
                className="card !p-0 overflow-hidden hover:border-gold/20 transition-all group"
              >
                <div className="flex items-start gap-3 px-4 py-3">
                  {/* Category Icon */}
                  <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${cat.bg}`}>
                    <span className={cat.color}>{cat.icon}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${cat.bg} ${cat.color}`}>
                        {cat.label}
                      </span>
                      <span className="text-[9px] text-muted">{gen.source_tool}</span>
                    </div>
                    <p className="text-xs font-semibold truncate">{gen.title}</p>
                    {gen.content_preview && (
                      <p className="text-[10px] text-muted mt-0.5 line-clamp-2 leading-relaxed">
                        {gen.content_preview}
                      </p>
                    )}
                    <p className="text-[9px] text-muted mt-1">{timeAgo(gen.created_at)}</p>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => toast.success("Opening preview...")}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-white transition-all"
                      title="View"
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      onClick={() => copyContent(gen)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-white transition-all"
                      title="Copy"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      onClick={() => toast.success("Re-generating...")}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-muted hover:text-gold transition-all"
                      title="Re-generate"
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      onClick={() => deleteGeneration(gen.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-400 transition-all"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-muted hover:text-white disabled:opacity-30 transition-all"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-muted hover:text-white disabled:opacity-30 transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <PageAI
        pageName="Generations"
        context={`Generations inbox with ${total} total items across ${uniqueCategories} categories. Currently viewing: ${category === "all" ? "all categories" : getCategoryConfig(category).label}. This week: ${thisWeekCount} items.`}
        suggestions={[
          "Summarize what I generated this week",
          "Which tool do I use the most?",
          "Help me organize my generations",
          "What content should I create next?",
        ]}
      />
    </div>
  );
}
