"use client";
import { Archive, ArrowBendUpLeft, ArrowBendUpRight, ArrowDown, ArrowUp, ArrowsClockwise, BookOpen, Calendar, CaretRight, ChartBar, Check, CircleNotch, Clock, Copy, DownloadSimple, Envelope, FileText, FilmStrip, Lightbulb, Lightning, MagnifyingGlass, Megaphone, PaperPlaneTilt, Play, PushPin, PushPinSlash, SlidersHorizontal, Star, Tag, Target, Trash, Tray, WarningCircle, X } from "@phosphor-icons/react";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";
import { EmptyState } from "@/components/ui/empty-state-illustration";
import { MotionPage } from "@/components/motion/motion-page";

/* -- Types -- */
type InboxCategory = "all" | "scripts" | "emails" | "outreach" | "contracts" | "ideas" | "reports" | "briefings" | "exports";
type InboxView = "inbox" | "auto-runs";
type SortField = "date" | "title" | "type";
type SortDir = "asc" | "desc";

interface AutoRunEntry {
  id: string;
  type: "scraper" | "outreach" | "email" | "automation";
  description: string;
  status: "running" | "completed" | "failed" | "queued";
  timestamp: string;
  results_summary: string;
}

interface InboxItem {
  id: string;
  type: InboxCategory;
  title: string;
  preview: string;
  content: string;
  date: string;
  source: string;
  status: string;
  starred: boolean;
  pinned: boolean;
  read: boolean;
  archived: boolean;
  metadata: Record<string, unknown>;
  downloadable: boolean;
  tags: string[];
}

/* ── Supabase row shapes ── */
interface ScriptRow {
  id: string;
  title: string | null;
  hook: string | null;
  description: string | null;
  script_body: string | null;
  script_type: string | null;
  target_platform: string | null;
  hashtags: string | null;
  seo_title: string | null;
  thumbnail_idea: string | null;
  status: string | null;
  approved_at: string | null;
  created_at: string;
}

interface ContractRow {
  id: string;
  title: string | null;
  status: string | null;
  value: number | null;
  start_date: string | null;
  end_date: string | null;
  pandadoc_id: string | null;
  created_at: string;
}

interface IdeaRow {
  id: string;
  title: string | null;
  hook: string | null;
  thumbnail_concept: string | null;
  idea_type: string;
  target_keyword: string | null;
  estimated_length: string | null;
  platform_recommendation: string | null;
  trending_angle: string | null;
  is_approved: boolean;
  added_to_calendar: boolean;
  created_at: string;
}

interface BriefingRow {
  id: string;
  generated_at: string;
  summary: string | null;
  content: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

interface OutreachRow {
  id: string;
  platform: string | null;
  business_name: string | null;
  recipient_handle: string | null;
  message_text: string | null;
  status: string | null;
  reply_text: string | null;
  lead_id: string | null;
  sent_at: string | null;
  created_at: string;
}

interface TrinityLogRow {
  id: string;
  action_type: string;
  description: string | null;
  result: Record<string, unknown> | null;
  status: string | null;
  completed_at: string | null;
  created_at: string;
}

/* -- Category Config -- */
const CATEGORIES: { key: InboxCategory; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
  { key: "all", label: "All Items", icon: <Tray size={14} />, color: "text-brand-accent", bg: "bg-[rgba(212,255,0,0.10)]" },
  { key: "scripts", label: "Scripts", icon: <FilmStrip size={14} />, color: "text-indigo-400", bg: "bg-[rgba(212,255,0,0.10)]" },
  { key: "emails", label: "Email Drafts", icon: <Envelope size={14} />, color: "text-purple-400", bg: "bg-purple-500/10" },
  { key: "outreach", label: "Outreach", icon: <Megaphone size={14} />, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { key: "contracts", label: "Contracts", icon: <FileText size={14} />, color: "text-amber-400", bg: "bg-amber-500/10" },
  { key: "ideas", label: "Ideas", icon: <Lightbulb size={14} />, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  { key: "reports", label: "Reports", icon: <ChartBar size={14} />, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  { key: "briefings", label: "Briefings", icon: <BookOpen size={14} />, color: "text-rose-400", bg: "bg-rose-500/10" },
  { key: "exports", label: "Exports", icon: <DownloadSimple size={14} />, color: "text-teal-400", bg: "bg-teal-500/10" },
];

function getCategoryConfig(type: InboxCategory) {
  return CATEGORIES.find(c => c.key === type) || CATEGORIES[0];
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

function truncate(str: string, len: number) {
  return str.length > len ? str.slice(0, len) + "..." : str;
}

/* -- Component -- */
export default function InboxPage() {
  const { user } = useAuth();
  const supabase = createClient();

  /* State */
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<InboxCategory>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filterStarred, setFilterStarred] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterPinned, setFilterPinned] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [overlayItem, setOverlayItem] = useState<InboxItem | null>(null);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");

  /* Auto-Runs view */
  const [view, setView] = useState<InboxView>("inbox");
  const [autoRuns, setAutoRuns] = useState<AutoRunEntry[]>([]);
  const [autoRunsLoading, setAutoRunsLoading] = useState(false);

  /* -- Persist read state to localStorage -- */
  function getReadIds(): Set<string> {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem("ss-inbox-read-ids");
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  }
  function addReadId(id: string) {
    if (typeof window === "undefined") return;
    try {
      const current = getReadIds();
      current.add(id);
      localStorage.setItem("ss-inbox-read-ids", JSON.stringify(Array.from(current)));
    } catch {}
  }
  function addReadIds(ids: string[]) {
    if (typeof window === "undefined") return;
    try {
      const current = getReadIds();
      ids.forEach(id => current.add(id));
      localStorage.setItem("ss-inbox-read-ids", JSON.stringify(Array.from(current)));
    } catch {}
  }

  /* -- Fetch all content from various tables --
     Supabase rows are untyped here (each table has ~15 fields we read without
     pulling in the full generated types). Rather than wrap every access in a
     runtime guard, we locally relax the `any` lint just for this iterator. */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const fetchInbox = useCallback(async () => {
    setLoading(true);
    const readIds = getReadIds();

    const inboxItems: InboxItem[] = [];

    // Fetch content scripts
    const { data: scripts } = await supabase
      .from("content_scripts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (scripts) {
      scripts.forEach((s: ScriptRow) => {
        inboxItems.push({
          id: `script-${s.id}`,
          type: "scripts",
          title: s.title || "Untitled Script",
          preview: s.hook || s.description || "Video script",
          content: s.script_body || s.hook || "",
          date: s.created_at,
          source: s.script_type === "long_form" ? "Long Form" : "Short Form",
          status: s.status || "draft",
          starred: false, pinned: false, read: !!s.approved_at, archived: false,
          metadata: { platform: s.target_platform, hashtags: s.hashtags, seo_title: s.seo_title, thumbnail: s.thumbnail_idea },
          downloadable: true,
          tags: [s.script_type || "script", s.target_platform || "general"].filter(Boolean),
        });
      });
    }

    // Fetch contracts
    const { data: contracts } = await supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (contracts) {
      contracts.forEach((c: ContractRow) => {
        inboxItems.push({
          id: `contract-${c.id}`,
          type: "contracts",
          title: c.title || "Untitled Contract",
          preview: `${c.status} contract${c.value ? ` � $${Number(c.value).toLocaleString()}` : ""}`,
          content: `Contract: ${c.title}\nStatus: ${c.status}\nValue: $${Number(c.value || 0).toLocaleString()}\nStart: ${c.start_date || "TBD"}\nEnd: ${c.end_date || "TBD"}`,
          date: c.created_at,
          source: "Contract Generator",
          status: c.status || "draft",
          starred: false, pinned: c.status === "sent", read: c.status !== "draft", archived: c.status === "expired",
          metadata: { value: c.value, pandadoc_id: c.pandadoc_id },
          downloadable: !!c.pandadoc_id,
          tags: [c.status || "draft"],
        });
      });
    }

    // Fetch personal brand ideas
    const { data: ideas } = await supabase
      .from("personal_brand_ideas")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);

    if (ideas) {
      ideas.forEach((i: IdeaRow) => {
        inboxItems.push({
          id: `idea-${i.id}`,
          type: "ideas",
          title: i.title || "Untitled Idea",
          preview: i.hook || i.thumbnail_concept || "Content idea",
          content: `${i.title}\n\nHook: ${i.hook || "N/A"}\nType: ${i.idea_type}\nKeyword: ${i.target_keyword || "N/A"}\nLength: ${i.estimated_length || "N/A"}\nThumbnail: ${i.thumbnail_concept || "N/A"}`,
          date: i.created_at,
          source: i.idea_type === "long_form" ? "Long Form Idea" : "Short Form Idea",
          status: i.is_approved ? "approved" : "pending",
          starred: i.is_approved || false, pinned: false, read: i.is_approved || false, archived: i.added_to_calendar || false,
          metadata: { trending_angle: i.trending_angle, platform: i.platform_recommendation, keyword: i.target_keyword },
          downloadable: false,
          tags: [i.idea_type, i.platform_recommendation || "multi-platform"].filter(Boolean),
        });
      });
    }

    // Fetch briefings
    const { data: briefings } = await supabase
      .from("briefings")
      .select("*")
      .eq("user_id", user?.id || "")
      .order("created_at", { ascending: false })
      .limit(20);

    if (briefings) {
      briefings.forEach((b: BriefingRow) => {
        inboxItems.push({
          id: `briefing-${b.id}`,
          type: "briefings",
          title: `Daily Briefing � ${new Date(b.generated_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`,
          preview: b.summary || "Morning briefing with stats & updates",
          content: b.summary || JSON.stringify(b.content, null, 2),
          date: b.created_at,
          source: "Auto-generated",
          status: b.read_at ? "read" : "unread",
          starred: false, pinned: !b.read_at, read: !!b.read_at, archived: false,
          metadata: b.content as Record<string, unknown>,
          downloadable: false,
          tags: ["daily", "briefing"],
        });
      });
    }

    // Fetch outreach log (sent messages)
    const { data: outreach } = await supabase
      .from("outreach_log")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(50);

    if (outreach) {
      outreach.forEach((o: OutreachRow) => {
        inboxItems.push({
          id: `outreach-${o.id}`,
          type: "outreach",
          title: `${(o.platform || "message").toUpperCase()} to ${o.business_name || o.recipient_handle || "Unknown"}`,
          preview: truncate(o.message_text || "Outreach message", 120),
          content: o.message_text || "",
          date: o.sent_at || o.created_at,
          source: o.platform || "unknown",
          status: o.status || "sent",
          starred: o.status === "replied", pinned: false, read: true, archived: false,
          metadata: { handle: o.recipient_handle, reply: o.reply_text, lead_id: o.lead_id },
          downloadable: false,
          tags: [o.platform || "outreach", o.status || "sent"].filter(Boolean),
        });
      });
    }

    // Fetch trinity_log for exports/generations
    const { data: logs } = await supabase
      .from("trinity_log")
      .select("*")
      .in("action_type", ["email_campaign", "sms_campaign", "automation", "custom"])
      .order("created_at", { ascending: false })
      .limit(30);

    if (logs) {
      logs.forEach((l: TrinityLogRow) => {
        const isExport = !!(l.description?.toLowerCase().includes("export") || l.description?.toLowerCase().includes("csv"));
        inboxItems.push({
          id: `log-${l.id}`,
          type: isExport ? "exports" : "reports",
          title: l.description || `${l.action_type} action`,
          preview: truncate(l.description || "System action", 100),
          content: JSON.stringify(l.result || {}, null, 2),
          date: l.completed_at || l.created_at,
          source: l.action_type || "system",
          status: l.status || "completed",
          starred: false, pinned: false, read: true, archived: false,
          metadata: l.result as Record<string, unknown> || {},
          downloadable: isExport,
          tags: [l.action_type || "action"],
        });
      });
    }

    // Apply persisted read status from localStorage
    const withReadState = inboxItems.map(item => ({
      ...item,
      read: item.read || readIds.has(item.id),
    }));

    setItems(withReadState);
    setLoading(false);
  }, [supabase]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  /* -- Fetch auto-run entries from trinity_log -- */
  const fetchAutoRuns = useCallback(async () => {
    setAutoRunsLoading(true);
    try {
      const { data: logs } = await supabase
        .from("trinity_log")
        .select("*")
        .or("action_type.ilike.auto%,action_type.ilike.scraper%,action_type.ilike.outreach%,action_type.eq.email_campaign,action_type.eq.sms_campaign")
        .order("created_at", { ascending: false })
        .limit(50);

      if (logs && logs.length > 0) {
        setAutoRuns(logs.map((l: Record<string, unknown>) => ({
          id: String(l.id),
          type: (String(l.action_type || "").includes("scraper") ? "scraper"
            : String(l.action_type || "").includes("outreach") ? "outreach"
            : String(l.action_type || "").includes("email") ? "email"
            : "automation") as AutoRunEntry["type"],
          description: String(l.description || l.action_type || "Automated action"),
          status: (String(l.status || "completed")) as AutoRunEntry["status"],
          timestamp: String(l.completed_at || l.created_at || new Date().toISOString()),
          results_summary: l.result && typeof l.result === "object"
            ? Object.entries(l.result as Record<string, unknown>).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(", ")
            : String(l.description || "Completed"),
        })));
      } else {
        setAutoRuns([]);
      }
    } catch {
      setAutoRuns([]);
    }
    setAutoRunsLoading(false);
  }, [supabase]);

  useEffect(() => { if (view === "auto-runs") fetchAutoRuns(); }, [view, fetchAutoRuns]);

  /* -- Escape key to close overlay -- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && overlayItem) {
        setOverlayItem(null);
        setShowReply(false);
        setReplyText("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [overlayItem]);

  /* -- Derived -- */
  const filtered = useMemo(() => {
    let result = items.filter(i => showArchived ? i.archived : !i.archived);
    if (category !== "all") result = result.filter(i => i.type === category);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i => i.title.toLowerCase().includes(q) || i.preview.toLowerCase().includes(q) || i.tags.some(t => t.toLowerCase().includes(q)));
    }
    if (filterStarred) result = result.filter(i => i.starred);
    if (filterUnread) result = result.filter(i => !i.read);
    if (filterPinned) result = result.filter(i => i.pinned);

    // Sort pinned first, then by sort field
    result.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const dir = sortDir === "desc" ? -1 : 1;
      if (sortField === "date") return dir * (new Date(a.date).getTime() - new Date(b.date).getTime());
      if (sortField === "title") return dir * a.title.localeCompare(b.title);
      if (sortField === "type") return dir * a.type.localeCompare(b.type);
      return 0;
    });
    return result;
  }, [items, category, search, sortField, sortDir, filterStarred, filterUnread, filterPinned, showArchived]);

  const stats = useMemo(() => ({
    total: items.filter(i => !i.archived).length,
    unread: items.filter(i => !i.read && !i.archived).length,
    starred: items.filter(i => i.starred).length,
    thisWeek: items.filter(i => {
      const d = new Date(i.date);
      const week = Date.now() - 7 * 86400000;
      return d.getTime() > week && !i.archived;
    }).length,
  }), [items]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CATEGORIES.forEach(c => { counts[c.key] = c.key === "all" ? items.filter(i => !i.archived).length : items.filter(i => i.type === c.key && !i.archived).length; });
    return counts;
  }, [items]);

  /* -- Actions -- */
  const toggleStar = (id: string) => setItems(prev => prev.map(i => i.id === id ? { ...i, starred: !i.starred } : i));
  const togglePin = (id: string) => setItems(prev => prev.map(i => i.id === id ? { ...i, pinned: !i.pinned } : i));
  const markRead = (id: string) => {
    addReadId(id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, read: true } : i));
  };
  const archiveItem = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, archived: true } : i));
    if (selectedItem?.id === id) setSelectedItem(null);
    toast.success("Archived");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(i => i.id)));
  };

  const bulkArchive = () => {
    setItems(prev => prev.map(i => selectedIds.has(i.id) ? { ...i, archived: true } : i));
    if (selectedItem && selectedIds.has(selectedItem.id)) setSelectedItem(null);
    toast.success(`Archived ${selectedIds.size} items`);
    setSelectedIds(new Set());
  };

  const bulkStar = () => {
    setItems(prev => prev.map(i => selectedIds.has(i.id) ? { ...i, starred: true } : i));
    toast.success(`Starred ${selectedIds.size} items`);
    setSelectedIds(new Set());
  };

  const bulkMarkRead = () => {
    addReadIds(Array.from(selectedIds));
    setItems(prev => prev.map(i => selectedIds.has(i.id) ? { ...i, read: true } : i));
    toast.success(`Marked ${selectedIds.size} as read`);
    setSelectedIds(new Set());
  };

  const copyContent = (item: InboxItem) => {
    navigator.clipboard.writeText(item.content);
    setCopied(item.id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadItem = (item: InboxItem) => {
    const blob = new Blob([item.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.title.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  };

  const openItem = (item: InboxItem) => {
    markRead(item.id);
    setSelectedItem(item);
    setOverlayItem(item);
    setShowReply(false);
    setReplyText("");
  };

  const closeOverlay = () => {
    setOverlayItem(null);
    setShowReply(false);
    setReplyText("");
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(prev => prev === "desc" ? "asc" : "desc");
    else { setSortField(field); setSortDir("desc"); }
  };

  /* -- Status badge -- */
  const StatusPill = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      draft: "bg-white/8 text-text-muted",
      sent: "bg-[rgba(99,102,241,0.15)] text-indigo-400",
      delivered: "bg-[rgba(99,102,241,0.15)] text-indigo-400",
      read: "bg-emerald-500/15 text-emerald-400",
      unread: "bg-amber-500/15 text-amber-400",
      replied: "bg-emerald-500/15 text-emerald-400",
      approved: "bg-emerald-500/15 text-emerald-400",
      pending: "bg-amber-500/15 text-amber-400",
      completed: "bg-emerald-500/15 text-emerald-400",
      failed: "bg-red-500/15 text-red-400",
      signed: "bg-emerald-500/15 text-emerald-400",
      expired: "bg-red-500/15 text-red-400",
      published: "bg-emerald-500/15 text-emerald-400",
      scheduled: "bg-cyan-500/15 text-cyan-400",
      idea: "bg-yellow-500/15 text-yellow-400",
      scripted: "bg-[rgba(99,102,241,0.15)] text-indigo-400",
    };
    return (
      <MotionPage>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium capitalize ${colors[status] || "bg-white/8 text-text-muted"}`}>
                {status}
              </span>
              </MotionPage>
    );
  };

  /* -- Render -- */
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col max-w-[1400px] w-full mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-3 space-y-4 shrink-0 min-w-0">
        {/* -- Tray command strip -- */}
        <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">Message Center</p>
            <h1 className="text-2xl font-display font-bold text-text-primary">Tray</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <>
              <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
                <button
                  onClick={() => setView("inbox")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-[10px] font-medium transition-all ${view === "inbox" ? "bg-white/10 text-text-primary" : "text-text-muted hover:text-text-primary"}`}
                >
                  <Tray size={11} /> Tray
                </button>
                <button
                  onClick={() => setView("auto-runs")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-[10px] font-medium transition-all ${view === "auto-runs" ? "bg-white/10 text-text-primary" : "text-text-muted hover:text-text-primary"}`}
                >
                  <Lightning size={11} /> Auto-Runs
                </button>
              </div>
              <button onClick={view === "auto-runs" ? fetchAutoRuns : fetchInbox} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-text-primary transition-all" title="Refresh" aria-label="Refresh">
                <ArrowsClockwise size={14} className={loading || autoRunsLoading ? "animate-spin" : ""} aria-hidden="true" />
              </button>
              {view === "inbox" && (
                <button onClick={() => setShowArchived(!showArchived)} className={`px-3 py-1.5 rounded-lg text-xs text-text-primary transition-all ${showArchived ? "bg-white/15" : "bg-white/5 hover:bg-white/10"}`}>
                  <Archive size={12} className="inline mr-1" /> {showArchived ? "Viewing Archive" : "Archive"}
                </button>
              )}
            </>
          </div>
        </div>

        {/* Stats � inbox view only */}
        {view === "inbox" && (
          <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4">
            <motion.div
              className="col-span-2 lg:col-span-1 glass rounded-2xl p-5 flex items-center gap-4"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
            >
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Total Messages</p>
                <p className="font-display text-3xl font-bold tracking-[-0.03em] text-brand-accent tabular-nums">{stats.total}</p>
                <p className="text-[11px] text-text-muted mt-1.5">in inbox</p>
              </div>
            </motion.div>
            <motion.div
              className="glass rounded-2xl p-5 flex flex-col justify-center"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.10, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Unread</p>
              <p className="font-display text-2xl font-bold tracking-[-0.02em] text-amber-500 tabular-nums">{stats.unread}</p>
              <p className="text-[11px] text-text-muted mt-1.5">needs attention</p>
            </motion.div>
            <motion.div
              className="glass rounded-2xl p-5 flex flex-col justify-center"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Starred</p>
              <p className="font-display text-2xl font-bold tracking-[-0.02em] text-yellow-500 tabular-nums">{stats.starred}</p>
              <p className="text-[11px] text-text-muted mt-1.5">flagged</p>
            </motion.div>
            <motion.div
              className="glass rounded-2xl p-5 flex flex-col justify-center"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">This Week</p>
              <p className="font-display text-2xl font-bold tracking-[-0.02em] text-emerald-600 tabular-nums">{stats.thisWeek}</p>
              <p className="text-[11px] text-text-muted mt-1.5">received</p>
            </motion.div>
          </div>
        )}

        {/* MagnifyingGlass & Filters � inbox view only */}
        {view === "inbox" && (<>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search inbox..."
              className="input text-xs pl-9 w-full glass rounded-lg"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                <X size={12} />
              </button>
            )}
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs transition-all ${showFilters ? "bg-[rgba(212,255,0,0.12)] text-brand-accent" : "bg-white/5 text-text-muted hover:text-text-primary"}`}>
            <SlidersHorizontal size={12} /> Filters
            {(filterStarred || filterUnread || filterPinned) && <span className="w-1.5 h-1.5 rounded-full bg-brand-accent" />}
          </button>
          {/* Sort buttons */}
          <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
            {([["date", "Date"], ["title", "Name"], ["type", "Type"]] as [SortField, string][]).map(([field, label]) => (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-medium transition-all ${sortField === field ? "bg-[rgba(212,255,0,0.08)] text-brand-accent" : "text-text-muted hover:text-text-secondary"}`}
              >
                {label}
                {sortField === field && (sortDir === "desc" ? <ArrowDown size={10} /> : <ArrowUp size={10} />)}
              </button>
            ))}
          </div>
        </div>

        {/* Filter chips */}
        {showFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: "starred", label: "Starred", icon: <Star size={10} />, active: filterStarred, toggle: () => setFilterStarred(!filterStarred) },
              { key: "unread", label: "Unread", icon: <WarningCircle size={10} />, active: filterUnread, toggle: () => setFilterUnread(!filterUnread) },
              { key: "pinned", label: "Pinned", icon: <PushPin size={10} />, active: filterPinned, toggle: () => setFilterPinned(!filterPinned) },
            ].map(f => (
              <button
                key={f.key}
                onClick={f.toggle}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${f.active ? "bg-[rgba(212,255,0,0.08)] text-brand-accent border border-[rgba(212,255,0,0.25)]" : "bg-white/5 text-text-muted hover:text-text-secondary border border-border-subtle"}`}
              >
                {f.icon} {f.label}
              </button>
            ))}
            {(filterStarred || filterUnread || filterPinned) && (
              <button onClick={() => { setFilterStarred(false); setFilterUnread(false); setFilterPinned(false); }} className="text-[10px] text-text-muted hover:text-text-secondary ml-1">
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(212,255,0,0.08)] border border-[rgba(212,255,0,0.20)]">
            <span className="text-xs text-brand-accent font-medium">{selectedIds.size} selected</span>
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={bulkMarkRead} className="px-2 py-1 text-[10px] rounded bg-white/6 hover:bg-white/10 text-text-primary transition-all">Mark Read</button>
              <button onClick={bulkStar} className="px-2 py-1 text-[10px] rounded bg-white/6 hover:bg-white/10 text-text-primary transition-all">Star</button>
              <button onClick={bulkArchive} className="px-2 py-1 text-[10px] rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all">Archive</button>
              <button onClick={() => setSelectedIds(new Set())} className="px-2 py-1 text-[10px] text-text-muted hover:text-text-secondary transition-all">Cancel</button>
            </div>
          </div>
        )}
        </>)}
      </div>

      {/* Main Content � inbox view */}
      {view === "inbox" && (
      <div className="flex-1 flex overflow-hidden px-4 md:px-6 pb-4 md:pb-6 gap-4">
        {/* Left: Category Sidebar */}
        <div className="w-48 shrink-0 space-y-1 overflow-y-auto pr-1 hidden md:block glass-md rounded-xl p-2">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => { setCategory(c.key); setSelectedItem(null); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                category === c.key ? "bg-[rgba(212,255,0,0.08)] text-brand-accent border border-[rgba(212,255,0,0.25)]" : "text-text-muted hover:text-text-secondary hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={category === c.key ? "text-brand-accent" : c.color}>{c.icon}</span>
                <span className="font-medium">{c.label}</span>
              </div>
              {categoryCounts[c.key] > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${category === c.key ? "bg-[rgba(212,255,0,0.14)] text-brand-accent" : "bg-white/8 text-text-muted"}`}>
                  {categoryCounts[c.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Mobile category tabs */}
        <div className="md:hidden shrink-0 -mx-4 px-4 overflow-x-auto flex gap-1 mb-2">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => { setCategory(c.key); setSelectedItem(null); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] whitespace-nowrap transition-all ${
                category === c.key ? "bg-[rgba(212,255,0,0.08)] text-brand-accent" : "bg-white/5 text-text-muted"
              }`}
            >
              {c.icon} {c.label}
              {categoryCounts[c.key] > 0 && <span className="text-[8px] opacity-60">{categoryCounts[c.key]}</span>}
            </button>
          ))}
        </div>

        {/* Center: Item List */}
        <div className={`flex-1 flex flex-col overflow-hidden min-w-0 ${selectedItem ? "hidden lg:flex" : ""}`}>
          {/* Select all header */}
          <div className="flex items-center gap-2 pb-2 border-b border-border-subtle mb-1 shrink-0">
            <button
              onClick={selectAll}
              className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                selectedIds.size === filtered.length && filtered.length > 0 ? "bg-brand-accent border-brand-accent" : "border-white/20 hover:border-white/40"
              }`}
            >
              {selectedIds.size === filtered.length && filtered.length > 0 && <Check size={10} className="text-black" />}
            </button>
            <span className="text-[10px] text-text-muted">{filtered.length} items</span>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <CircleNotch size={20} className="animate-spin text-brand-accent" />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                type="no-messages"
                title={search ? "No items match your search" : showArchived ? "No archived items" : "Your inbox is empty"}
                description={search ? "Try different keywords." : "Generated content will appear here."}
              />
            ) : (
              filtered.map((item, index) => {
                const cat = getCategoryConfig(item.type);
                const isSelected = selectedIds.has(item.id);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, delay: index * 0.04 }}
                    whileHover={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                    onClick={() => openItem(item)}
                    className={`group flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      selectedItem?.id === item.id
                        ? "bg-[rgba(212,255,0,0.08)] border border-[rgba(212,255,0,0.20)]"
                        : isSelected
                        ? "bg-white/8 border border-border-subtle"
                        : !item.read
                        ? "bg-white/4 border border-transparent"
                        : "border border-transparent"
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={e => { e.stopPropagation(); toggleSelect(item.id); }}
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                        isSelected ? "bg-brand-accent border-brand-accent" : "border-white/20 opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {isSelected && <Check size={10} className="text-black" />}
                    </button>

                    {/* Star */}
                    <button
                      onClick={e => { e.stopPropagation(); toggleStar(item.id); }}
                      className="mt-0.5 shrink-0"
                    >
                      {item.starred
                        ? <Star size={14} className="text-yellow-400 fill-yellow-400" />
                        : <Star size={14} className="text-white/20 group-hover:text-white/40 transition-colors" />
                      }
                    </button>

                    {/* Type Icon */}
                    <div className={`mt-0.5 shrink-0 w-6 h-6 rounded flex items-center justify-center ${cat.bg}`}>
                      <span className={cat.color}>{cat.icon}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {item.pinned && <PushPin size={10} className="text-brand-accent shrink-0" />}
                        {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-brand-accent shrink-0" />}
                        <span className={`text-xs truncate ${!item.read ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                          {item.title}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted truncate">{item.preview}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusPill status={item.status} />
                        {item.tags.slice(0, 2).map(t => (
                          <span key={t} className="text-[8px] px-1 py-0.5 rounded bg-white/6 text-text-muted capitalize">{t}</span>
                        ))}
                      </div>
                    </div>

                    {/* Time & actions */}
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-text-muted">{timeAgo(item.date)}</p>
                      <div className="flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={e => { e.stopPropagation(); togglePin(item.id); }} className="p-1 rounded hover:bg-white/8 text-text-muted hover:text-text-primary transition-all" title={item.pinned ? "Unpin" : "PushPin"}>
                          {item.pinned ? <PushPinSlash size={10} /> : <PushPin size={10} />}
                        </button>
                        <button onClick={e => { e.stopPropagation(); archiveItem(item.id); }} className="p-1 rounded hover:bg-white/8 text-text-muted hover:text-red-400 transition-all" title="Archive">
                          <Archive size={10} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Detail Panel */}
        {selectedItem && (
          <div className="w-full lg:w-[420px] shrink-0 flex flex-col overflow-hidden border-l border-border-subtle pl-4">
            {/* Detail Header */}
            <div className="flex items-start justify-between pb-3 border-b border-border-subtle mb-3 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`${getCategoryConfig(selectedItem.type).color}`}>
                    {getCategoryConfig(selectedItem.type).icon}
                  </span>
                  <span className="text-[10px] text-text-muted uppercase tracking-wider">{getCategoryConfig(selectedItem.type).label}</span>
                </div>
                <h2 className="text-sm font-bold text-text-primary leading-snug">{selectedItem.title}</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusPill status={selectedItem.status} />
                  <span className="text-[10px] text-text-muted">{new Date(selectedItem.date).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-1.5 rounded-lg hover:bg-white/8 text-text-muted hover:text-text-secondary transition-all lg:block hidden">
                <X size={14} />
              </button>
              <button onClick={() => setSelectedItem(null)} className="p-1.5 rounded-lg hover:bg-white/8 text-text-muted hover:text-text-secondary transition-all lg:hidden">
                <CaretRight size={14} />
              </button>
            </div>

            {/* Detail Actions */}
            <div className="flex items-center gap-1.5 pb-3 border-b border-border-subtle mb-3 shrink-0 flex-wrap">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => copyContent(selectedItem)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 text-xs transition-all">
                {copied === selectedItem.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copied === selectedItem.id ? "Copied" : "Copy"}
              </motion.button>
              {selectedItem.downloadable && (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => downloadItem(selectedItem)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 text-xs transition-all">
                  <DownloadSimple size={12} /> DownloadSimple
                </motion.button>
              )}
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => toggleStar(selectedItem.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 text-xs transition-all">
                {selectedItem.starred ? <Star size={12} className="text-yellow-400 fill-yellow-400" /> : <Star size={12} />}
                {selectedItem.starred ? "Unstar" : "Star"}
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => togglePin(selectedItem.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 text-xs transition-all">
                {selectedItem.pinned ? <PushPinSlash size={12} /> : <PushPin size={12} />}
                {selectedItem.pinned ? "Unpin" : "PushPin"}
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => archiveItem(selectedItem.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition-all ml-auto">
                <Archive size={12} /> Archive
              </motion.button>
            </div>

            {/* Tags */}
            {selectedItem.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pb-3 mb-3 border-b border-border-subtle shrink-0">
                <Tag size={10} className="text-text-muted" />
                {selectedItem.tags.map(t => (
                  <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-text-muted capitalize border border-border-subtle">{t}</span>
                ))}
                <span className="text-[9px] text-text-muted ml-1">Source: {selectedItem.source}</span>
              </div>
            )}

            {/* Metadata cards */}
            {Object.keys(selectedItem.metadata).filter(k => selectedItem.metadata[k]).length > 0 && (
              <div className="grid grid-cols-2 gap-2 pb-3 mb-3 border-b border-border-subtle shrink-0">
                {Object.entries(selectedItem.metadata)
                  .filter(([, v]) => v && typeof v !== "object")
                  .slice(0, 6)
                  .map(([key, val]) => (
                    <div key={key} className="px-2.5 py-2 rounded-lg bg-white/4 border border-border-subtle">
                      <p className="text-[8px] text-text-muted uppercase tracking-wider mb-0.5">{key.replace(/_/g, " ")}</p>
                      <p className="text-[10px] text-text-secondary truncate">{String(val)}</p>
                    </div>
                  ))}
              </div>
            )}

            {/* Content body */}
            <div className="flex-1 overflow-y-auto">
              <div className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed bg-white/4 rounded-lg p-4 border border-border-subtle min-h-[200px]">
                {selectedItem.content || <span className="text-text-muted italic">No content body available</span>}
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* -- Auto-Runs View -- */}
      {view === "auto-runs" && (
        <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-4 md:pb-6">
          {autoRunsLoading ? (
            <div className="flex items-center justify-center py-20">
              <CircleNotch size={20} className="animate-spin text-brand-accent" />
            </div>
          ) : autoRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Lightning size={36} className="text-text-muted/30 mb-3" />
              <p className="text-sm text-text-muted font-medium">No automated runs yet</p>
              <p className="text-[10px] text-text-muted mt-1">Configure auto-run in Lead Finder to see activity here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {autoRuns.map((run, index) => {
                const iconMap: Record<string, React.ReactNode> = {
                  scraper: <MagnifyingGlass size={14} className="text-brand-accent" />,
                  outreach: <PaperPlaneTilt size={14} className="text-emerald-400" />,
                  email: <Envelope size={14} className="text-purple-400" />,
                  automation: <Lightning size={14} className="text-cyan-400" />,
                };
                const statusColors: Record<string, string> = {
                  running: "bg-[rgba(99,102,241,0.15)] text-indigo-400",
                  completed: "bg-emerald-500/15 text-emerald-400",
                  failed: "bg-red-500/15 text-red-400",
                  queued: "bg-amber-500/15 text-amber-400",
                };
                const timeDiff = Date.now() - new Date(run.timestamp).getTime();
                const mins = Math.floor(timeDiff / 60000);
                const timeStr = mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`;

                return (
                  <motion.div
                    key={run.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, delay: index * 0.04 }}
                    whileHover={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                    className="flex items-start gap-3 px-4 py-3 rounded-lg glass-md border border-border-subtle transition-colors"
                  >
                    {/* Icon */}
                    <div className="mt-0.5 w-8 h-8 rounded-lg bg-white/6 flex items-center justify-center shrink-0">
                      {iconMap[run.type] || <Lightning size={14} className="text-text-muted" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-text-primary truncate">{run.description}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium capitalize ${statusColors[run.status] || "bg-white/8 text-text-muted"}`}>
                          {run.status === "running" && <Play size={8} className="mr-0.5" />}
                          {run.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted truncate">{run.results_summary}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-text-muted/60 capitalize flex items-center gap-1">
                          <Target size={8} /> {run.type}
                        </span>
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-text-muted flex items-center gap-1">
                        <Clock size={9} /> {timeStr}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* -- Full-screen Overlay Modal -- */}
      {overlayItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={closeOverlay}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative w-[90%] max-w-4xl h-[85vh] glass shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border-subtle shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getCategoryConfig(overlayItem.type).bg}`}>
                    <span className={getCategoryConfig(overlayItem.type).color}>
                      {getCategoryConfig(overlayItem.type).icon}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{overlayItem.source}</p>
                    <p className="text-[10px] text-text-muted truncate">
                      {getCategoryConfig(overlayItem.type).label} &middot; {new Date(overlayItem.date).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <h2 className="text-lg font-bold text-text-primary leading-snug">{overlayItem.title}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <StatusPill status={overlayItem.status} />
                  {overlayItem.tags.map(t => (
                    <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-text-muted capitalize border border-border-subtle">{t}</span>
                  ))}
                </div>
              </div>
              <button
                onClick={closeOverlay}
                className="ml-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-text-muted hover:text-text-secondary transition-all shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body - scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Metadata cards */}
              {Object.keys(overlayItem.metadata).filter(k => overlayItem.metadata[k]).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
                  {Object.entries(overlayItem.metadata)
                    .filter(([, v]) => v && typeof v !== "object")
                    .slice(0, 6)
                    .map(([key, val]) => (
                      <div key={key} className="px-3 py-2.5 rounded-lg bg-white/4 border border-border-subtle">
                        <p className="text-[9px] text-text-muted uppercase tracking-wider mb-0.5">{key.replace(/_/g, " ")}</p>
                        <p className="text-xs text-text-secondary truncate">{String(val)}</p>
                      </div>
                    ))}
                </div>
              )}

              {/* Full message body */}
              <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed bg-white/4 rounded-xl p-5 border border-border-subtle min-h-[200px]">
                {overlayItem.content || <span className="text-text-muted italic">No content body available</span>}
              </div>

              {/* Inline ArrowBendUpLeft */}
              {showReply && (
                <div className="mt-4 space-y-3">
                  <div className="border border-[rgba(212,255,0,0.25)] rounded-xl overflow-hidden glass">
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Type your reply... (saved as a draft — send flows per channel)"
                      className="w-full bg-transparent text-sm text-text-secondary placeholder-text-muted px-4 py-3 resize-none focus:outline-none min-h-[120px]"
                      autoFocus
                    />
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border-subtle">
                      <button
                        onClick={() => { setShowReply(false); setReplyText(""); }}
                        className="text-[10px] text-text-muted hover:text-text-secondary transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          if (!replyText.trim()) return;
                          // Copy the draft so the user can paste into the channel's own UI.
                          // Actual send flows differ per channel (email, SMS, outreach) and
                          // don't have a unified endpoint yet — we don't want to fake a send.
                          navigator.clipboard.writeText(replyText).catch(() => {});
                          toast.success("Draft copied — paste into your send flow");
                          setShowReply(false);
                          setReplyText("");
                        }}
                        disabled={!replyText.trim()}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-brand-accent hover:bg-brand-accent/90 text-[#020711] text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        <PaperPlaneTilt size={12} /> Copy Draft
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer - Action Buttons */}
            <div className="flex items-center gap-2 px-6 py-4 border-t border-border-subtle shrink-0">
              <button
                onClick={() => setShowReply(!showReply)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  showReply
                    ? "bg-[rgba(212,255,0,0.14)] text-brand-accent border border-[rgba(212,255,0,0.25)]"
                    : "bg-[rgba(212,255,0,0.08)] hover:bg-[rgba(212,255,0,0.14)] text-brand-accent border border-[rgba(212,255,0,0.25)]"
                }`}
              >
                <ArrowBendUpLeft size={14} /> ArrowBendUpLeft
              </button>
              <button
                onClick={() => {
                  copyContent(overlayItem);
                  toast.success("Content copied � ready to forward");
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/8 text-text-secondary hover:text-text-primary text-xs font-medium transition-all border border-border-subtle"
              >
                <ArrowBendUpRight size={14} /> ArrowBendUpRight
              </button>
              <div className="flex-1" />
              <button
                onClick={() => {
                  archiveItem(overlayItem.id);
                  closeOverlay();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/8 text-text-secondary hover:text-text-primary text-xs font-medium transition-all border border-border-subtle"
              >
                <Archive size={14} /> Archive
              </button>
              <button
                onClick={() => {
                  archiveItem(overlayItem.id);
                  closeOverlay();
                  toast.success("Deleted");
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-all border border-red-500/20"
              >
                <Trash size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <PageAI
        pageName="Tray"
        context={`Unified inbox with ${stats.total} items (${stats.unread} unread, ${stats.starred} starred). Categories: ${Object.entries(categoryCounts).filter(([k, v]) => k !== "all" && v > 0).map(([k, v]) => `${k}: ${v}`).join(", ")}. Viewing: ${category}, sorted by ${sortField} ${sortDir}.`}
        suggestions={[
          "Summarize my unread items",
          "Which outreach messages got replies?",
          "What scripts were generated this week?",
          "Help me organize and clean up my inbox",
        ]}
      />
    </div>
  );
}
