"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail, Phone, Search, Download, CheckCircle, XCircle,
  Send, BarChart3, Calendar, Settings, Trash2,
  ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight,
  MessageSquare, RefreshCw, LayoutList, LayoutGrid,
  Check, Loader2, PhoneCall, X
} from "lucide-react";
import {
  FacebookIcon, InstagramIcon, LinkedInIcon, TikTokIcon,
  XTwitterIcon,
} from "@/components/ui/platform-icons";

/* ── Types ── */
interface OutreachEntry {
  id: string;
  lead_id: string | null;
  platform: string;
  business_name: string;
  recipient_handle: string;
  message_text: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface Stats {
  total: number;
  sent: number;
  replied: number;
  failed: number;
  byPlatform: Record<string, number>;
}

type Tab = "outreach" | "analytics" | "config";
type ViewMode = "compact" | "detailed";

/* ── Platform icon map ── */
const PLATFORM_ICON: Record<string, React.ReactNode> = {
  email: <Mail size={13} className="text-gold" />,
  sms: <Phone size={13} className="text-green-400" />,
  call: <PhoneCall size={13} className="text-emerald-400" />,
  instagram: <InstagramIcon size={14} />,
  instagram_dm: <InstagramIcon size={14} />,
  facebook: <FacebookIcon size={14} />,
  facebook_dm: <FacebookIcon size={14} />,
  linkedin: <LinkedInIcon size={14} />,
  tiktok: <TikTokIcon size={14} />,
  x_twitter: <XTwitterIcon size={14} />,
};

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-blue-400/10 text-blue-400",
  delivered: "bg-blue-400/10 text-blue-400",
  replied: "bg-green-400/10 text-green-400",
  completed: "bg-green-400/10 text-green-400",
  failed: "bg-red-400/10 text-red-400",
  bounced: "bg-red-400/10 text-red-400",
  pending: "bg-yellow-400/10 text-yellow-400",
  follow_up_2: "bg-purple-400/10 text-purple-400",
};

const DM_PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: <InstagramIcon size={14} /> },
  { id: "facebook", label: "Facebook", icon: <FacebookIcon size={14} /> },
  { id: "linkedin", label: "LinkedIn", icon: <LinkedInIcon size={14} /> },
  { id: "tiktok", label: "TikTok", icon: <TikTokIcon size={14} /> },
];

export default function OutreachLogsPage() {
  /* ── State ── */
  const [tab, setTab] = useState<Tab>("outreach");
  const [entries, setEntries] = useState<OutreachEntry[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, sent: 0, replied: 0, failed: 0, byPlatform: {} });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("compact");

  // Selection & bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showDmPicker, setShowDmPicker] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Config
  const [config, setConfig] = useState({
    platforms: { instagram: { enabled: true, daily_limit: 20 }, linkedin: { enabled: true, daily_limit: 20 }, facebook: { enabled: true, daily_limit: 20 }, tiktok: { enabled: true, daily_limit: 20 } },
    total_daily_target: 80,
    schedule_time: "09:00",
    message_style: "professional and friendly",
    auto_followup: true,
    followup_day_3: true,
    followup_day_7: true,
    exclude_contacted: true,
    pause_on_reply: true,
  });
  const [configSaving, setConfigSaving] = useState(false);

  /* ── Data fetching ── */
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        platform: platformFilter,
        status: statusFilter,
        type: typeFilter,
        search,
      });
      const res = await fetch(`/api/outreach/entries?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        if (data.stats) setStats(data.stats);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, pageSize, platformFilter, statusFilter, typeFilter, search]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Load config
  useEffect(() => {
    fetch("/api/outreach/configure").then(r => r.json()).then(d => {
      if (d.config) setConfig(prev => ({ ...prev, ...d.config }));
    }).catch(() => {});
  }, []);

  /* ── Selection helpers ── */
  const allSelected = entries.length > 0 && entries.every(e => selectedIds.has(e.id));
  function toggleAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(entries.map(e => e.id)));
  }
  function toggleOne(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /* ── Bulk actions ── */
  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} outreach entries?`)) return;
    setBulkLoading(true);
    try {
      await fetch("/api/outreach/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", entry_ids: [...selectedIds] }),
      });
      setSelectedIds(new Set());
      fetchEntries();
    } catch { /* ignore */ }
    setBulkLoading(false);
  }

  async function handleBulkOutreach(action: string, _platform?: string) {
    const leadIds = entries.filter(e => selectedIds.has(e.id) && e.lead_id).map(e => e.lead_id);
    if (!leadIds.length) return alert("No linked leads found in selection");
    setBulkLoading(true);
    try {
      await fetch("/api/outreach/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, lead_ids: leadIds, tier: "outreach" }),
      });
      setSelectedIds(new Set());
      setShowDmPicker(false);
      fetchEntries();
    } catch { /* ignore */ }
    setBulkLoading(false);
  }

  async function saveConfig() {
    setConfigSaving(true);
    try {
      await fetch("/api/outreach/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    } catch { /* ignore */ }
    setConfigSaving(false);
  }

  function exportCSV() {
    const csv = "Business,Platform,Handle,Status,Message,Date\n" +
      entries.map(e => `"${e.business_name}","${e.platform}","${e.recipient_handle}","${e.status}","${(e.message_text || "").replace(/"/g, '""').substring(0, 200)}","${e.created_at}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "outreach_logs.csv"; a.click();
  }

  /* ── Render ── */
  const replyRate = stats.total > 0 ? ((stats.replied / stats.total) * 100).toFixed(1) : "0";

  return (
    <div className="fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Send size={18} className="text-gold" /> Outreach
          </h1>
          <p className="text-xs text-muted mt-0.5">Live outreach data — DMs, emails, calls, SMS with bulk actions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fetchEntries()} className="btn-secondary text-xs flex items-center gap-1.5">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={exportCSV} className="btn-secondary text-xs flex items-center gap-1.5">
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {[
          { label: "Total", value: stats.total, color: "text-gold", icon: <Send size={12} /> },
          { label: "Sent", value: stats.sent, color: "text-blue-400", icon: <CheckCircle size={12} /> },
          { label: "Replied", value: stats.replied, color: "text-green-400", icon: <ThumbsUp size={12} /> },
          { label: "Failed", value: stats.failed, color: "text-red-400", icon: <XCircle size={12} /> },
          { label: "Reply Rate", value: `${replyRate}%`, color: "text-green-400", icon: <BarChart3 size={12} /> },
          { label: "SMS", value: stats.byPlatform?.sms || 0, color: "text-emerald-400", icon: <Phone size={12} /> },
        ].map((s, i) => (
          <div key={i} className="card text-center p-2.5">
            <div className={`w-6 h-6 rounded-md mx-auto mb-1 flex items-center justify-center bg-white/5 ${s.color}`}>{s.icon}</div>
            <p className="text-base font-bold">{s.value}</p>
            <p className="text-[9px] text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1">
        {([
          { key: "outreach" as Tab, label: "Outreach", icon: <Send size={13} /> },
          { key: "analytics" as Tab, label: "Analytics", icon: <BarChart3 size={13} /> },
          { key: "config" as Tab, label: "Config", icon: <Settings size={13} /> },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs rounded-md flex items-center gap-2 transition-all ${
              tab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
            }`}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* ══════════ OUTREACH TAB ══════════ */}
      {tab === "outreach" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search business, handle, message..."
                className="input w-full pl-8 text-xs" />
            </div>
            <div className="flex gap-1">
              {[
                { val: "all", label: "All", icon: null },
                { val: "email", label: "Email", icon: <Mail size={11} /> },
                { val: "sms", label: "SMS", icon: <Phone size={11} /> },
                { val: "call", label: "Call", icon: <PhoneCall size={11} /> },
                { val: "instagram", label: "IG", icon: <InstagramIcon size={12} /> },
                { val: "facebook", label: "FB", icon: <FacebookIcon size={12} /> },
              ].map(p => (
                <button key={p.val} onClick={() => { setPlatformFilter(p.val); setPage(1); }}
                  className={`text-[10px] px-2 py-1.5 rounded-lg flex items-center gap-1 ${
                    platformFilter === p.val ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.06] hover:border-white/10"
                  }`}>{p.icon} {p.label}</button>
              ))}
            </div>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="input text-xs py-1.5 w-auto">
              <option value="all">All Status</option>
              <option value="sent">Sent</option>
              <option value="replied">Replied</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
            <div className="flex items-center gap-1 border border-white/[0.06] rounded-lg">
              <button onClick={() => setViewMode("compact")}
                className={`p-1.5 rounded-l-lg ${viewMode === "compact" ? "bg-gold/10 text-gold" : "text-muted"}`}>
                <LayoutList size={14} />
              </button>
              <button onClick={() => setViewMode("detailed")}
                className={`p-1.5 rounded-r-lg ${viewMode === "detailed" ? "bg-gold/10 text-gold" : "text-muted"}`}>
                <LayoutGrid size={14} />
              </button>
            </div>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="input text-xs py-1.5 w-auto">
              <option value={10}>10/page</option>
              <option value={25}>25/page</option>
              <option value={50}>50/page</option>
            </select>
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gold/[0.05] border border-gold/20 animate-in slide-in-from-top-1">
              <span className="text-xs font-medium text-gold">{selectedIds.size} selected</span>
              <div className="flex-1" />
              <div className="relative">
                <button onClick={() => setShowDmPicker(!showDmPicker)} disabled={bulkLoading}
                  className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5">
                  <MessageSquare size={12} /> DM
                  <ChevronRight size={10} className={`transition-transform ${showDmPicker ? "rotate-90" : ""}`} />
                </button>
                {showDmPicker && (
                  <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-lg p-1 shadow-xl z-20 min-w-[160px]">
                    {DM_PLATFORMS.map(p => (
                      <button key={p.id} onClick={() => handleBulkOutreach("dm", p.id)}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 rounded-md">
                        {p.icon} {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => handleBulkOutreach("call")} disabled={bulkLoading}
                className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5">
                <PhoneCall size={12} /> Call
              </button>
              <button onClick={() => handleBulkOutreach("sms")} disabled={bulkLoading}
                className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5">
                <Phone size={12} /> SMS
              </button>
              <button onClick={handleBulkDelete} disabled={bulkLoading}
                className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20">
                <Trash2 size={12} /> Delete
              </button>
              <button onClick={() => setSelectedIds(new Set())}
                className="text-xs text-muted hover:text-foreground px-2 py-1.5">
                <X size={12} />
              </button>
              {bulkLoading && <Loader2 size={14} className="animate-spin text-gold" />}
            </div>
          )}

          {/* Entries table */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-gold" />
              <span className="ml-2 text-xs text-muted">Loading outreach data...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16">
              <Send size={28} className="mx-auto text-muted mb-2" />
              <p className="text-sm text-muted">No outreach entries found</p>
              <p className="text-[10px] text-muted mt-1">Run the scraper to get leads, then start outreach</p>
            </div>
          ) : viewMode === "compact" ? (
            /* ── Compact table view ── */
            <div className="card overflow-hidden p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-[9px] text-muted uppercase tracking-wider">
                    <th className="p-2.5 w-8">
                      <button onClick={toggleAll} className={`w-4 h-4 rounded border flex items-center justify-center ${
                        allSelected ? "bg-gold border-gold" : "border-white/20 hover:border-white/40"
                      }`}>{allSelected && <Check size={10} className="text-black" />}</button>
                    </th>
                    <th className="p-2.5 text-left w-8">Ch</th>
                    <th className="p-2.5 text-left">Business</th>
                    <th className="p-2.5 text-left">Handle</th>
                    <th className="p-2.5 text-left">Message</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5 text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => {
                    const isSelected = selectedIds.has(entry.id);
                    const date = new Date(entry.created_at);
                    return (
                      <tr key={entry.id} className={`border-b border-border/50 text-[11px] transition-colors ${
                        isSelected ? "bg-gold/[0.03]" : "hover:bg-white/[0.02]"
                      }`}>
                        <td className="p-2.5">
                          <button onClick={() => toggleOne(entry.id)} className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isSelected ? "bg-gold border-gold" : "border-white/20 hover:border-white/40"
                          }`}>{isSelected && <Check size={10} className="text-black" />}</button>
                        </td>
                        <td className="p-2.5">{PLATFORM_ICON[entry.platform] || <Mail size={13} className="text-muted" />}</td>
                        <td className="p-2.5 font-medium max-w-[160px] truncate">{entry.business_name || "—"}</td>
                        <td className="p-2.5 text-muted font-mono text-[10px] max-w-[140px] truncate">{entry.recipient_handle || "—"}</td>
                        <td className="p-2.5 text-muted max-w-[240px] truncate">{entry.message_text?.substring(0, 80) || "—"}</td>
                        <td className="p-2.5 text-center">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${STATUS_STYLE[entry.status] || "bg-white/5 text-muted"}`}>
                            {entry.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-right text-[10px] text-muted whitespace-nowrap">
                          {date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                          <span className="ml-1 opacity-50">{date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ── Detailed card view ── */
            <div className="space-y-2">
              {entries.map(entry => {
                const isSelected = selectedIds.has(entry.id);
                const isExpanded = expandedId === entry.id;
                const date = new Date(entry.created_at);
                return (
                  <div key={entry.id} className={`p-3 rounded-xl border transition-all ${
                    isSelected ? "bg-gold/[0.03] border-gold/20" :
                    entry.status === "replied" || entry.status === "completed" ? "bg-green-400/[0.02] border-green-400/10" :
                    entry.status === "failed" || entry.status === "bounced" ? "bg-red-400/[0.02] border-red-400/10" :
                    "bg-surface-light border-border"
                  }`}>
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleOne(entry.id)} className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                        isSelected ? "bg-gold border-gold" : "border-white/20 hover:border-white/40"
                      }`}>{isSelected && <Check size={10} className="text-black" />}</button>

                      <div className="flex-shrink-0">{PLATFORM_ICON[entry.platform] || <Mail size={13} className="text-muted" />}</div>

                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : entry.id)}>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium truncate">{entry.business_name || "Unknown"}</p>
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-muted capitalize">{entry.platform}</span>
                        </div>
                        <p className="text-[10px] text-muted truncate mt-0.5">{entry.message_text?.substring(0, 120)}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${STATUS_STYLE[entry.status] || "bg-white/5 text-muted"}`}>
                          {entry.status}
                        </span>
                        <div className="text-right">
                          <p className="text-[9px] text-muted">{date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</p>
                          <p className="text-[8px] text-muted opacity-60">{date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        <div>
                          <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Message</p>
                          <div className="bg-gold/[0.03] border border-gold/10 rounded-lg p-2.5">
                            <p className="text-[11px] whitespace-pre-wrap leading-relaxed">{entry.message_text}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-[9px] text-muted">
                          <span>Platform: <span className="text-foreground capitalize">{entry.platform}</span></span>
                          <span>Handle: <span className="text-foreground font-mono">{entry.recipient_handle}</span></span>
                          {entry.lead_id && <span>Lead: <span className="text-gold font-mono">{entry.lead_id.slice(0, 8)}...</span></span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-[10px] text-muted">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-30">
                  <ChevronLeft size={13} />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) pageNum = i + 1;
                  else if (page <= 4) pageNum = i + 1;
                  else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                  else pageNum = page - 3 + i;
                  return (
                    <button key={pageNum} onClick={() => setPage(pageNum)}
                      className={`text-xs px-2.5 py-1.5 rounded-md min-w-[32px] ${
                        page === pageNum ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground hover:bg-white/5"
                      }`}>{pageNum}</button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="btn-secondary text-xs px-2.5 py-1.5 disabled:opacity-30">
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ ANALYTICS TAB ══════════ */}
      {tab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Volume by Platform</h3>
              <div className="space-y-3">
                {Object.entries(stats.byPlatform).sort(([,a],[,b]) => b - a).map(([platform, count]) => {
                  const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={platform}>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="flex items-center gap-1.5 capitalize">{PLATFORM_ICON[platform] || <Mail size={12} />} {platform}</span>
                        <span className="font-bold">{count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full bg-surface-light rounded-full h-2">
                        <div className="bg-gold rounded-full h-2 transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(stats.byPlatform).length === 0 && (
                  <p className="text-[10px] text-muted text-center py-4">No data yet</p>
                )}
              </div>
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Status Breakdown</h3>
              <div className="space-y-3">
                {[
                  { label: "Sent / Delivered", value: stats.sent, color: "bg-blue-400", pct: stats.total > 0 ? (stats.sent / stats.total) * 100 : 0 },
                  { label: "Replied", value: stats.replied, color: "bg-green-400", pct: stats.total > 0 ? (stats.replied / stats.total) * 100 : 0 },
                  { label: "Failed / Bounced", value: stats.failed, color: "bg-red-400", pct: stats.total > 0 ? (stats.failed / stats.total) * 100 : 0 },
                ].map(s => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span>{s.label}</span>
                      <span className="font-bold">{s.value} ({s.pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-surface-light rounded-full h-2">
                      <div className={`${s.color} rounded-full h-2 transition-all`} style={{ width: `${Math.max(s.pct, 1)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Quick metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card text-center p-4">
              <ThumbsUp size={20} className="mx-auto mb-2 text-green-400" />
              <p className="text-xl font-bold text-green-400">{stats.replied}</p>
              <p className="text-[10px] text-muted">Total Replies</p>
            </div>
            <div className="card text-center p-4">
              <BarChart3 size={20} className="mx-auto mb-2 text-gold" />
              <p className="text-xl font-bold text-gold">{replyRate}%</p>
              <p className="text-[10px] text-muted">Reply Rate</p>
            </div>
            <div className="card text-center p-4">
              <ThumbsDown size={20} className="mx-auto mb-2 text-red-400" />
              <p className="text-xl font-bold text-red-400">{stats.failed}</p>
              <p className="text-[10px] text-muted">Failed/Bounced</p>
            </div>
            <div className="card text-center p-4">
              <Calendar size={20} className="mx-auto mb-2 text-blue-400" />
              <p className="text-xl font-bold text-blue-400">{stats.total}</p>
              <p className="text-[10px] text-muted">All Time Total</p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ CONFIG TAB ══════════ */}
      {tab === "config" && (
        <div className="space-y-4 max-w-2xl">
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Settings size={14} /> Outreach Configuration</h3>

            {/* Platform daily limits */}
            <div>
              <p className="text-xs font-medium mb-2">Platform Daily Limits</p>
              <div className="grid grid-cols-2 gap-3">
                {(["instagram", "linkedin", "facebook", "tiktok"] as const).map(p => {
                  const plat = config.platforms[p] || { enabled: true, daily_limit: 20 };
                  return (
                    <div key={p} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light">
                      <button onClick={() => setConfig(c => ({
                        ...c,
                        platforms: { ...c.platforms, [p]: { ...plat, enabled: !plat.enabled } }
                      }))} className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${plat.enabled ? "bg-gold" : "bg-white/10"}`}>
                        <div className={`w-3.5 h-3.5 rounded-full bg-zinc-200 shadow-sm transition-transform ${plat.enabled ? "translate-x-3.5" : "translate-x-0"}`} />
                      </button>
                      <span className="flex items-center gap-1.5 text-xs capitalize flex-1">
                        {PLATFORM_ICON[p]} {p}
                      </span>
                      <input type="number" value={plat.daily_limit} min={0} max={200}
                        onChange={e => setConfig(c => ({
                          ...c,
                          platforms: { ...c.platforms, [p]: { ...plat, daily_limit: Number(e.target.value) } }
                        }))}
                        className="input w-16 text-xs text-center py-1" />
                      <span className="text-[9px] text-muted">/day</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total target */}
            <div className="flex items-center gap-3">
              <label className="text-xs flex-1">Total daily target</label>
              <input type="number" value={config.total_daily_target} min={0} max={500}
                onChange={e => setConfig(c => ({ ...c, total_daily_target: Number(e.target.value) }))}
                className="input w-20 text-xs text-center py-1.5" />
            </div>

            {/* Message style */}
            <div>
              <p className="text-xs font-medium mb-1.5">Message Style</p>
              <div className="flex gap-2">
                {["friendly", "professional", "bold"].map(style => (
                  <button key={style} onClick={() => setConfig(c => ({ ...c, message_style: style }))}
                    className={`text-xs px-3 py-1.5 rounded-lg capitalize border ${
                      config.message_style === style ? "bg-gold/10 text-gold border-gold/20" : "text-muted border-white/[0.06]"
                    }`}>{style}</button>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div className="flex items-center gap-3">
              <label className="text-xs flex-1">Schedule time (daily cron)</label>
              <input type="time" value={config.schedule_time}
                onChange={e => setConfig(c => ({ ...c, schedule_time: e.target.value }))}
                className="input w-28 text-xs py-1.5" />
            </div>

            {/* Toggles */}
            <div className="space-y-2.5">
              {[
                { key: "auto_followup", label: "Auto follow-ups" },
                { key: "followup_day_3", label: "Day 3 follow-up" },
                { key: "followup_day_7", label: "Day 7 follow-up" },
                { key: "exclude_contacted", label: "Exclude already contacted" },
                { key: "pause_on_reply", label: "Pause sequence on reply" },
              ].map(item => (
                <div key={item.key} className="flex items-center gap-3">
                  <button onClick={() => setConfig(c => ({ ...c, [item.key]: !c[item.key as keyof typeof c] }))}
                    className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${
                      config[item.key as keyof typeof config] ? "bg-gold" : "bg-white/10"
                    }`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-zinc-200 shadow-sm transition-transform ${
                      config[item.key as keyof typeof config] ? "translate-x-3.5" : "translate-x-0"
                    }`} />
                  </button>
                  <span className="text-xs">{item.label}</span>
                </div>
              ))}
            </div>

            <button onClick={saveConfig} disabled={configSaving}
              className="btn-primary text-xs flex items-center gap-1.5">
              {configSaving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              Save Configuration
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
