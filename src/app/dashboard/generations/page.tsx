"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Layers, Film, Megaphone, Image as ImageIcon, Mail,
  FileText, Share2, Globe, Search, RefreshCw,
  Copy,
  Trash2, Loader, Sparkles
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";
import { MotionPage } from "@/components/motion/motion-page";

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
  { key: "all",          label: "All",          icon: <Layers size={14} />,    color: "text-brand-accent",        bg: "bg-[rgba(212,255,0,0.08)]" },
  { key: "video",        label: "Videos",       icon: <Film size={14} />,      color: "text-indigo-400",    bg: "bg-indigo-500/10" },
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

  // Local-only hide — the /api/generations endpoint has no DELETE route yet,
  // so this simply filters the current client list. Refresh restores the item.
  const deleteGeneration = async (id: string) => {
    setGenerations(prev => prev.filter(g => g.id !== id));
    setTotal(prev => Math.max(0, prev - 1));
    toast.success("Hidden from list");
  };

  const hasMore = page * limit < total;

  return (
    <MotionPage className="space-y-5">{/* -- Generations command strip (slim editorial header, no PageHero) -- */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0">
          <p className="font-editorial text-[11px] italic text-text-muted mb-0.5 truncate">
            Content Output
          </p>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none truncate">
            Generations
          </h1>
        </div>
        <button
          onClick={fetchGenerations}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 border border-white/10 text-text-primary text-xs font-medium hover:bg-white/10 transition-all"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Editorial Bento — 4-col stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4">
        {/* Focal tile */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.36 }}
          className="flex items-start gap-3 glass rounded-2xl p-5"
        >
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Total Items</p>
            <p className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary tabular-nums">{total}</p>
          </div>
        </motion.div>
        {/* Support tile: This Week */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.10, duration: 0.36 }}
          className="glass rounded-2xl p-5"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">This Week</p>
          <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{thisWeekCount}</p>
        </motion.div>
        {/* Support tile: Categories */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.36 }}
          className="glass rounded-2xl p-5"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Categories</p>
          <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{uniqueCategories}</p>
        </motion.div>
        {/* Support tile: Latest */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.36 }}
          className="glass rounded-2xl p-5"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Latest</p>
          <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{latest}</p>
        </motion.div>
      </div>

      {/* Search */}<div className="relative max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search generations..."
                aria-label="Search generations"
                className="input text-xs pl-9 w-full"
              />
            </div>{/* Category Filter Tabs */}<div className="flex gap-1 overflow-x-auto pb-1">
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => { setCategory(c.key); setPage(1); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                    category === c.key
                      ? "bg-[rgba(212,255,0,0.08)] text-brand-accent border border-[rgba(212,255,0,0.2)] font-medium"
                      : "bg-white/5 text-text-muted hover:text-text-primary hover:bg-white/8 border border-transparent"
                  }`}
                >
                  <span className={category === c.key ? "text-brand-accent" : c.color}>{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>{/* Generations List */}<div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader size={20} className="animate-spin text-brand-accent" />
                </div>
              ) : filtered.length === 0 ? (
                /* Empty State */
                <div className="glass rounded-xl text-center py-16">
                  <Sparkles size={32} className="mx-auto mb-3 text-text-muted/30" />
                  <p className="text-sm text-text-muted font-medium mb-1">No generations yet</p>
                  <p className="text-[10px] text-text-muted max-w-xs mx-auto">
                    Create content from any tool in Trinity and it will appear here automatically.
                  </p>
                </div>
              ) : (
                filtered.map((gen, idx) => {
                  const cat = getCategoryConfig(gen.category);
                  return (
                    <motion.div
                      key={gen.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      whileHover={{ y: -4, scale: 1.01 }}
                      className="glass rounded-xl !p-0 overflow-hidden hover:border-[rgba(212,255,0,0.2)] transition-all group spotlight-card"
                      onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`); e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`); }}
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
                            <span className="text-[9px] text-text-muted">{gen.source_tool}</span>
                          </div>
                          <p className="text-xs font-semibold truncate">{gen.title}</p>
                          {gen.content_preview && (
                            <p className="text-[10px] text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                              {gen.content_preview}
                            </p>
                          )}
                          <p className="text-[9px] text-text-muted mt-1">{timeAgo(gen.created_at)}</p>
                        </div>

                        {/* Actions — preview/re-gen require per-tool routes that
                            don't exist yet, so only ship the working Copy + Hide
                            actions for launch. */}
                        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => copyContent(gen)}
                            className="p-1.5 rounded-lg hover:bg-white/8 text-text-muted hover:text-text-primary transition-all"
                            title="Copy content"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            onClick={() => deleteGeneration(gen.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-all"
                            title="Hide from list (local only)"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>{/* Pagination */}{!loading && filtered.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-text-muted">
                  Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/8 text-xs text-text-muted hover:text-text-primary disabled:opacity-30 transition-all"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!hasMore}
                    className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/8 text-xs text-text-muted hover:text-text-primary disabled:opacity-30 transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}<PageAI
              pageName="Generations"
              context={`Generations inbox with ${total} total items across ${uniqueCategories} categories. Currently viewing: ${category === "all" ? "all categories" : getCategoryConfig(category).label}. This week: ${thisWeekCount} items.`}
              suggestions={[
                "Summarize what I generated this week",
                "Which tool do I use the most?",
                "Help me organize my generations",
                "What content should I create next?",
              ]}
            /></MotionPage>
  );
}
