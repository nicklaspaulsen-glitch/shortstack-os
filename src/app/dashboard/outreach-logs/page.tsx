"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail, Phone, Search, Download, CheckCircle, XCircle,
  Send, BarChart3, Calendar, Settings, Trash2,
  ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight,
  MessageSquare, RefreshCw, LayoutList, LayoutGrid,
  Check, Loader2, PhoneCall, X, Plus, PhoneForwarded,
  Globe, Shield, Wifi, Copy, ExternalLink, Clock, User,
  Bot, ArrowRight, Hash, Smartphone, Radar, MapPin, Building2, Sliders,
  AlertTriangle, Activity, Star,
  CalendarRange, Tag, BookCheck
} from "lucide-react";
import {
  FacebookIcon, InstagramIcon, LinkedInIcon, TikTokIcon,
  XTwitterIcon,
} from "@/components/ui/platform-icons";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import { EmptyState } from "@/components/ui/empty-state-illustration";

/* ── Types ── */
interface OutreachEntry {
  id: string;
  lead_id: string | null;
  platform: string;
  business_name: string;
  recipient_handle: string;
  message_text: string;
  status: string;
  reply_text: string | null;
  replied_at: string | null;
  sent_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface TranscriptLine {
  role: "agent" | "customer" | "system";
  message: string;
  timestamp?: number;
}

interface ConversationDetail {
  transcript: TranscriptLine[];
  duration: number;
  outcome: string;
  summary: string;
  metadata: Record<string, unknown>;
}

interface ProvisionedNumber {
  client_id: string;
  client_name: string;
  phone_number: string;
  phone_sid: string;
  agent_id: string | null;
  phone_number_id: string | null;
}

interface AvailableNumber {
  phone: string;
  locality: string;
  region: string;
}

interface Stats {
  total: number;
  sent: number;
  replied: number;
  failed: number;
  byPlatform: Record<string, number>;
}

type Tab = "outreach" | "analytics" | "config" | "provisioning";
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
  interested: "bg-green-400/10 text-green-400",
  booked: "bg-emerald-400/10 text-emerald-400",
  failed: "bg-red-400/10 text-red-400",
  bounced: "bg-red-400/10 text-red-400",
  not_interested: "bg-orange-400/10 text-orange-400",
  pending: "bg-yellow-400/10 text-yellow-400",
  maybe_later: "bg-amber-400/10 text-amber-400",
  no_answer: "bg-gray-400/10 text-gray-400",
  voicemail: "bg-purple-400/10 text-purple-400",
};

// Sentiment dot color based on status
function getSentimentColor(status: string): string {
  if (["replied", "interested", "completed", "booked"].includes(status)) return "bg-green-400";
  if (["sent", "delivered", "pending"].includes(status)) return "bg-blue-400";
  if (["failed", "bounced", "not_interested"].includes(status)) return "bg-red-400";
  if (["no_answer", "voicemail", "maybe_later"].includes(status)) return "bg-amber-400";
  return "bg-gray-400";
}

// Outcome tag config
const OUTCOME_TAGS = [
  { status: "booked",         emoji: "🟢", label: "Booked"         },
  { status: "interested",     emoji: "🔵", label: "Interested"     },
  { status: "maybe_later",    emoji: "🟡", label: "Maybe Later"    },
  { status: "not_interested", emoji: "🔴", label: "Not Interested" },
  { status: "no_answer",      emoji: "⚫", label: "No Response"    },
];

const DM_PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: <InstagramIcon size={14} /> },
  { id: "facebook", label: "Facebook", icon: <FacebookIcon size={14} /> },
  { id: "linkedin", label: "LinkedIn", icon: <LinkedInIcon size={14} /> },
  { id: "tiktok", label: "TikTok", icon: <TikTokIcon size={14} /> },
];

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatTimestamp(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Selection & bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showDmPicker, setShowDmPicker] = useState(false);

  // Detail panel
  const [detailEntry, setDetailEntry] = useState<OutreachEntry | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [threadEntries, setThreadEntries] = useState<OutreachEntry[]>([]);

  // Provisioning
  const [provNumbers, setProvNumbers] = useState<ProvisionedNumber[]>([]);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [provLoading, setProvLoading] = useState(false);
  const [areaCode, setAreaCode] = useState("");
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [buyingNumber, setBuyingNumber] = useState<string | null>(null);
  const [provClientId, setProvClientId] = useState("");
  const [clients, setClients] = useState<{ id: string; business_name: string }[]>([]);

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
    // Scraping
    scrape_platforms: ["google_maps"] as string[],
    scrape_niches: ["dentist"] as string[],
    scrape_locations: ["Miami, FL"] as string[],
    scrape_volume: 20,
    scrape_filters: { min_rating: 0, max_reviews: 500, require_phone: false, require_website: false },
    // Channel limits
    email_daily_limit: 100,
    sms_daily_limit: 50,
    calls_daily_limit: 20,
    dm_daily_limits: { instagram: 20, facebook: 20, linkedin: 20, tiktok: 20 },
    // Schedule
    timezone: "America/New_York",
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [scraperRunning, setScraperRunning] = useState(false);
  const [scraperResult, setScraperResult] = useState<{ leads_found: number; duplicates_skipped: number } | null>(null);
  const [spamGuardEnabled, setSpamGuardEnabled] = useState(false);
  const [senderStats, setSenderStats] = useState<{ bounce_rate?: number; warmup_stage?: string; health?: string; total_senders?: number } | null>(null);
  const [autoRunConfig, setAutoRunConfig] = useState<{
    enabled: boolean; time: string; days: string[];
    platforms: string[]; niches: string[]; locations: string[];
    max_results: number;
  } | null>(null);
  // Tag input helpers
  const [nicheInput, setNicheInput] = useState("");
  const [locationInput, setLocationInput] = useState("");

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
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
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
  }, [page, pageSize, platformFilter, statusFilter, typeFilter, search, dateFrom, dateTo]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Load config
  useEffect(() => {
    fetch("/api/outreach/configure").then(r => r.json()).then(d => {
      if (d.config) setConfig(prev => ({ ...prev, ...d.config }));
    }).catch(() => {});
  }, []);

  // Load spam guard + sender stats when config tab opens
  useEffect(() => {
    if (tab === "config") {
      fetch("/api/settings/spam-guard").then(r => r.json()).then(d => {
        setSpamGuardEnabled(d.enabled ?? false);
      }).catch(() => {});
      fetch("/api/senders/stats").then(r => r.json()).then(d => {
        setSenderStats(d);
      }).catch(() => {});
      fetch("/api/scraper/auto-run").then(r => r.json()).then(d => {
        if (d && typeof d.enabled === "boolean") setAutoRunConfig(d);
      }).catch(() => {});
    }
  }, [tab]);

  // Load clients for provisioning
  useEffect(() => {
    if (tab === "provisioning") {
      fetch("/api/clients?minimal=true").then(r => r.json()).then(d => {
        if (d.clients) setClients(d.clients);
      }).catch(() => {});
      fetchProvisionedNumbers();
    }
  }, [tab]);

  /* ── Conversation detail fetching ── */
  async function openDetail(entry: OutreachEntry) {
    setDetailEntry(entry);
    setConversationDetail(null);
    setThreadEntries([]);

    if (entry.platform === "call") {
      // Extract conversation ID from message_text like "[ElevenAgent Call] conv:abc123"
      const convMatch = entry.message_text?.match(/conv:(\S+)/);
      if (convMatch) {
        setDetailLoading(true);
        try {
          const res = await fetch(`/api/eleven-agents/conversation?id=${convMatch[1]}`);
          if (res.ok) {
            const data = await res.json();
            setConversationDetail({
              transcript: data.transcript || [],
              duration: data.metadata?.call_duration_secs || data.analysis?.call_duration_secs || 0,
              outcome: data.analysis?.call_successful ? "interested" : data.status || "unknown",
              summary: data.analysis?.transcript_summary || "",
              metadata: data.metadata || {},
            });
          }
        } catch { /* ignore */ }
        setDetailLoading(false);
      }
    }

    // Fetch email thread for email entries
    if (entry.platform === "email" && entry.recipient_handle) {
      try {
        const threadRes = await fetch(
          `/api/outreach/entries?search=${encodeURIComponent(entry.recipient_handle)}&platform=email&pageSize=10`
        );
        if (threadRes.ok) {
          const threadData = await threadRes.json();
          setThreadEntries((threadData.entries || []).filter((e: OutreachEntry) => e.id !== entry.id));
        }
      } catch { /* ignore */ }
    }
  }

  /* ── Outcome tagging ── */
  async function updateEntryStatus(entryId: string, newStatus: string) {
    try {
      await fetch("/api/outreach/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_status", entry_ids: [entryId], status: newStatus }),
      });
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, status: newStatus } : e));
      setDetailEntry(prev => prev && prev.id === entryId ? { ...prev, status: newStatus } : prev);
      toast.success(`Marked as ${newStatus.replace(/_/g, " ")}`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  /* ── Provisioning ── */
  async function fetchProvisionedNumbers() {
    setProvLoading(true);
    try {
      const res = await fetch("/api/twilio/numbers");
      if (res.ok) {
        const data = await res.json();
        setProvNumbers(data.numbers || []);
      }
    } catch { /* ignore */ }
    setProvLoading(false);
  }

  async function searchAvailableNumbers() {
    if (!areaCode || areaCode.length < 3) { toast.error("Enter a valid area code"); return; }
    setSearchingNumbers(true);
    setAvailableNumbers([]);
    try {
      const res = await fetch(`/api/twilio/provision?area_code=${areaCode}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableNumbers(data.numbers || []);
        if ((data.numbers || []).length === 0) toast.error("No numbers available for this area code");
      }
    } catch { toast.error("Failed to search numbers"); }
    setSearchingNumbers(false);
  }

  async function buyNumber(phone: string) {
    if (!provClientId) { toast.error("Select a client first"); return; }
    setBuyingNumber(phone);
    try {
      const res = await fetch("/api/twilio/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: provClientId, area_code: areaCode }),
      });
      const data = await res.json();
      if (data.phone_number) {
        toast.success(`Number ${data.phone_number} provisioned!`);
        setAvailableNumbers([]);
        fetchProvisionedNumbers();
      } else {
        toast.error(data.error || "Failed to provision number");
      }
    } catch { toast.error("Provisioning failed"); }
    setBuyingNumber(null);
  }

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
        body: JSON.stringify({ action: "delete", entry_ids: Array.from(selectedIds) }),
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
      toast.success("Configuration saved");
    } catch { /* ignore */ }
    setConfigSaving(false);
  }

  async function runScraper() {
    setScraperRunning(true);
    setScraperResult(null);
    try {
      const res = await fetch("/api/scraper/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: config.scrape_platforms,
          niches: config.scrape_niches,
          locations: config.scrape_locations,
          volume: config.scrape_volume,
          filters: config.scrape_filters,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setScraperResult({ leads_found: data.leads_found ?? 0, duplicates_skipped: data.duplicates_skipped ?? 0 });
        toast.success(`Scraper done — ${data.leads_found ?? 0} leads found`);
      } else {
        toast.error(data.error || "Scraper failed");
      }
    } catch {
      toast.error("Failed to run scraper");
    }
    setScraperRunning(false);
  }

  function addTag(field: "scrape_niches" | "scrape_locations", value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setConfig(c => ({
      ...c,
      [field]: c[field].includes(trimmed) ? c[field] : [...c[field], trimmed],
    }));
  }

  function removeTag(field: "scrape_niches" | "scrape_locations", value: string) {
    setConfig(c => ({ ...c, [field]: c[field].filter((v: string) => v !== value) }));
  }

  function toggleScrapePlatform(id: string) {
    setConfig(c => ({
      ...c,
      scrape_platforms: c.scrape_platforms.includes(id)
        ? c.scrape_platforms.filter(p => p !== id)
        : [...c.scrape_platforms, id],
    }));
  }

  function exportCSV() {
    const csv = "Business,Platform,Handle,Status,Message,Date\n" +
      entries.map(e => `"${e.business_name}","${e.platform}","${e.recipient_handle}","${e.status}","${(e.message_text || "").replace(/"/g, '""').substring(0, 200)}","${e.created_at}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "outreach_logs.csv"; a.click();
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  }

  /* ── Render ── */
  const replyRate = stats.total > 0 ? ((stats.replied / stats.total) * 100).toFixed(1) : "0";
  const bookedCount = entries.filter(e => e.status === "booked").length;
  // Use a broader booked estimate from stats when possible
  const bookRate = stats.total > 0 ? ((bookedCount / stats.total) * 100).toFixed(1) : "0";

  return (
    <div className="fade-in space-y-4">
      {/* Hero Header */}
      <PageHero
        icon={<Send size={22} />}
        title="Outreach Logs"
        subtitle="Full communication history — calls, emails, SMS, DMs with transcripts & details."
        gradient="blue"
      />
      <div className="flex items-center justify-end">
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
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-9 gap-2">
        {[
          { label: "Total", value: stats.total, color: "text-gold", icon: <Send size={12} /> },
          { label: "Sent", value: stats.sent, color: "text-blue-400", icon: <CheckCircle size={12} /> },
          { label: "Replied", value: stats.replied, color: "text-green-400", icon: <ThumbsUp size={12} /> },
          { label: "Failed", value: stats.failed, color: "text-red-400", icon: <XCircle size={12} /> },
          { label: "Reply Rate", value: `${replyRate}%`, color: "text-green-400", icon: <BarChart3 size={12} /> },
          { label: "Book Rate", value: `${bookRate}%`, color: "text-emerald-400", icon: <BookCheck size={12} /> },
          { label: "Emails", value: stats.byPlatform?.email || 0, color: "text-gold", icon: <Mail size={12} /> },
          { label: "SMS", value: stats.byPlatform?.sms || 0, color: "text-emerald-400", icon: <Phone size={12} /> },
          { label: "Calls", value: stats.byPlatform?.call || 0, color: "text-blue-400", icon: <PhoneCall size={12} /> },
        ].map((s, i) => (
          <div key={i} className="card text-center p-2">
            <div className={`w-5 h-5 rounded-md mx-auto mb-1 flex items-center justify-center bg-white/5 ${s.color}`}>{s.icon}</div>
            <p className="text-sm font-bold">{s.value}</p>
            <p className="text-[8px] text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1">
        {([
          { key: "outreach" as Tab, label: "All Logs", icon: <Send size={13} /> },
          { key: "analytics" as Tab, label: "Analytics", icon: <BarChart3 size={13} /> },
          { key: "provisioning" as Tab, label: "Phones & Email", icon: <Smartphone size={13} /> },
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
        <div className={`flex gap-4 ${detailEntry ? "" : ""}`}>
          {/* Main content */}
          <div className={`space-y-3 transition-all ${detailEntry ? "flex-1 min-w-0" : "w-full"}`}>
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
                <option value="interested">Interested</option>
                <option value="not_interested">Not Interested</option>
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

            {/* Date range filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-[10px] text-muted">
                <CalendarRange size={13} className="text-gold" />
                <span>Date range:</span>
              </div>
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="input text-xs py-1.5 w-auto"
                placeholder="From"
              />
              <span className="text-[10px] text-muted">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="input text-xs py-1.5 w-auto"
                placeholder="To"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
                  className="text-[10px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-muted flex items-center gap-1"
                >
                  <X size={9} /> Clear
                </button>
              )}
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

            {/* Entries */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={20} className="animate-spin text-gold" />
                <span className="ml-2 text-xs text-muted">Loading outreach data...</span>
              </div>
            ) : entries.length === 0 ? (
              <EmptyState
                type="no-campaigns"
                title="No outreach entries found"
                description="Send emails, SMS, or calls from the CRM to see them here."
              />
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
                      <th className="p-2.5 text-left">Recipient</th>
                      <th className="p-2.5 text-left">Message Preview</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-center">Reply</th>
                      <th className="p-2.5 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(entry => {
                      const isSelected = selectedIds.has(entry.id);
                      const isActive = detailEntry?.id === entry.id;
                      const date = new Date(entry.created_at);
                      const hasReply = !!entry.reply_text;
                      return (
                        <tr key={entry.id}
                          onClick={() => openDetail(entry)}
                          className={`border-b border-border/50 text-[11px] transition-colors cursor-pointer ${
                            isActive ? "bg-gold/[0.06] border-l-2 border-l-gold" :
                            isSelected ? "bg-gold/[0.03]" : "hover:bg-white/[0.02]"
                          }`}>
                          <td className="p-2.5" onClick={e => e.stopPropagation()}>
                            <button onClick={() => toggleOne(entry.id)} className={`w-4 h-4 rounded border flex items-center justify-center ${
                              isSelected ? "bg-gold border-gold" : "border-white/20 hover:border-white/40"
                            }`}>{isSelected && <Check size={10} className="text-black" />}</button>
                          </td>
                          <td className="p-2.5">{PLATFORM_ICON[entry.platform] || <Mail size={13} className="text-muted" />}</td>
                          <td className="p-2.5 font-medium max-w-[140px] truncate">
                            <span className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getSentimentColor(entry.status)}`} />
                              {entry.business_name || "—"}
                            </span>
                          </td>
                          <td className="p-2.5 text-muted font-mono text-[10px] max-w-[120px] truncate">{entry.recipient_handle || "—"}</td>
                          <td className="p-2.5 text-muted max-w-[220px] truncate">
                            {entry.platform === "call" ? (
                              <span className="flex items-center gap-1"><PhoneCall size={10} className="text-emerald-400" /> AI Call — click for transcript</span>
                            ) : entry.message_text?.substring(0, 80) || "—"}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${STATUS_STYLE[entry.status] || "bg-white/5 text-muted"}`}>
                              {entry.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            {hasReply ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-400/10 text-green-400">Yes</span>
                            ) : (
                              <span className="text-[9px] text-muted">—</span>
                            )}
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
                  const isActive = detailEntry?.id === entry.id;
                  const date = new Date(entry.created_at);
                  return (
                    <div key={entry.id}
                      onClick={() => openDetail(entry)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isActive ? "bg-gold/[0.06] border-gold/30" :
                        isSelected ? "bg-gold/[0.03] border-gold/20" :
                        entry.status === "replied" || entry.status === "interested" ? "bg-green-400/[0.02] border-green-400/10" :
                        entry.status === "failed" || entry.status === "bounced" ? "bg-red-400/[0.02] border-red-400/10" :
                        "bg-surface-light border-border hover:border-white/10"
                      }`}>
                      <div className="flex items-center gap-3">
                        <button onClick={e => { e.stopPropagation(); toggleOne(entry.id); }} className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                          isSelected ? "bg-gold border-gold" : "border-white/20 hover:border-white/40"
                        }`}>{isSelected && <Check size={10} className="text-black" />}</button>

                        <div className="flex-shrink-0">{PLATFORM_ICON[entry.platform] || <Mail size={13} className="text-muted" />}</div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getSentimentColor(entry.status)}`} />
                            <p className="text-xs font-medium truncate">{entry.business_name || "Unknown"}</p>
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-muted capitalize">{entry.platform}</span>
                            {entry.reply_text && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-400/10 text-green-400">replied</span>}
                          </div>
                          <p className="text-[10px] text-muted truncate mt-0.5">
                            <span className="font-mono">{entry.recipient_handle}</span>
                            <span className="mx-1.5 opacity-30">·</span>
                            {entry.platform === "call" ? "AI Call — click for transcript" : entry.message_text?.substring(0, 100)}
                          </p>
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

          {/* ── DETAIL SIDE PANEL ── */}
          {detailEntry && (
            <div className="w-[380px] flex-shrink-0 sticky top-4 self-start">
              <div className="card space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {PLATFORM_ICON[detailEntry.platform] || <Mail size={16} />}
                    <div>
                      <h3 className="text-sm font-semibold">{detailEntry.business_name}</h3>
                      <p className="text-[10px] text-muted font-mono">{detailEntry.recipient_handle}</p>
                    </div>
                  </div>
                  <button onClick={() => { setDetailEntry(null); setConversationDetail(null); }}
                    className="text-muted hover:text-foreground"><X size={14} /></button>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-2">
                  <span className={`text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 ${getSentimentColor(detailEntry.status).replace("bg-", "bg-").replace("-400", "-400/20")} border border-${getSentimentColor(detailEntry.status).replace("bg-", "").replace("-400", "-400/30")}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getSentimentColor(detailEntry.status)}`} />
                    <span className={STATUS_STYLE[detailEntry.status]?.split(" ")[1] || "text-muted"}>{detailEntry.status}</span>
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-muted capitalize">{detailEntry.platform}</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-muted">
                    {new Date(detailEntry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>

                {/* Outcome tags */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1 text-[9px] text-muted">
                    <Tag size={9} /> <span>Mark outcome:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {OUTCOME_TAGS.map(tag => (
                      <button
                        key={tag.status}
                        onClick={() => updateEntryStatus(detailEntry.id, tag.status)}
                        className={`text-[9px] px-2 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                          detailEntry.status === tag.status
                            ? "bg-gold/10 border-gold/30 text-gold font-medium"
                            : "bg-white/5 border-white/[0.06] text-muted hover:border-white/20 hover:text-foreground"
                        }`}
                      >
                        <span>{tag.emoji}</span> {tag.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex gap-1">
                  {detailEntry.recipient_handle && (
                    <button onClick={() => copyText(detailEntry.recipient_handle)} className="text-[9px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 flex items-center gap-1">
                      <Copy size={9} /> Copy
                    </button>
                  )}
                  {detailEntry.lead_id && (
                    <a href={`/dashboard/crm?lead=${detailEntry.lead_id}`} className="text-[9px] px-2 py-1 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 flex items-center gap-1">
                      <ExternalLink size={9} /> View Lead
                    </a>
                  )}
                </div>

                {/* ── CALL TRANSCRIPT ── */}
                {detailEntry.platform === "call" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <PhoneCall size={14} className="text-emerald-400" />
                      <h4 className="text-xs font-semibold">Call Transcript</h4>
                    </div>

                    {detailLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 size={16} className="animate-spin text-gold" />
                        <span className="ml-2 text-[10px] text-muted">Loading transcript...</span>
                      </div>
                    ) : conversationDetail ? (
                      <>
                        {/* Call stats */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-surface-light rounded-lg p-2 text-center">
                            <Clock size={10} className="mx-auto mb-1 text-muted" />
                            <p className="text-[10px] font-bold">{formatDuration(conversationDetail.duration)}</p>
                            <p className="text-[7px] text-muted">Duration</p>
                          </div>
                          <div className="bg-surface-light rounded-lg p-2 text-center">
                            <Hash size={10} className="mx-auto mb-1 text-muted" />
                            <p className="text-[10px] font-bold">{conversationDetail.transcript.length}</p>
                            <p className="text-[7px] text-muted">Messages</p>
                          </div>
                          <div className="bg-surface-light rounded-lg p-2 text-center">
                            <span className={`text-[10px] font-bold ${
                              conversationDetail.outcome === "interested" ? "text-green-400" :
                              conversationDetail.outcome === "not_interested" ? "text-red-400" : "text-muted"
                            }`}>{conversationDetail.outcome}</span>
                            <p className="text-[7px] text-muted">Outcome</p>
                          </div>
                        </div>

                        {/* Summary */}
                        {conversationDetail.summary && (
                          <div className="bg-gold/[0.03] border border-gold/10 rounded-lg p-2.5">
                            <p className="text-[9px] text-muted uppercase tracking-wider mb-1">AI Summary</p>
                            <p className="text-[10px] leading-relaxed">{conversationDetail.summary}</p>
                          </div>
                        )}

                        {/* Speaking time breakdown */}
                        {conversationDetail.transcript.length > 0 && (() => {
                          const agentLines = conversationDetail.transcript.filter(l => l.role === "agent");
                          const customerLines = conversationDetail.transcript.filter(l => l.role === "customer");
                          const agentPct = conversationDetail.transcript.length > 0
                            ? Math.round((agentLines.length / conversationDetail.transcript.filter(l => l.role !== "system").length) * 100)
                            : 0;
                          return (
                            <div className="bg-surface-light rounded-lg p-2.5 space-y-1.5">
                              <p className="text-[8px] text-muted uppercase tracking-wider">Speaking Time</p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-gold rounded-full" style={{ width: `${agentPct}%` }} />
                                </div>
                                <span className="text-[8px] text-gold">{agentPct}% AI</span>
                              </div>
                              <div className="flex justify-between text-[8px] text-muted">
                                <span><Bot size={7} className="inline mr-0.5 text-gold" /> Agent: {agentLines.length} turns</span>
                                <span><User size={7} className="inline mr-0.5 text-blue-400" /> Customer: {customerLines.length} turns</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Transcript chat bubbles */}
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                          {conversationDetail.transcript.map((line, i) => {
                            if (line.role === "system") {
                              return (
                                <div key={i} className="text-center">
                                  <span className="text-[8px] text-muted italic px-2 py-0.5 rounded bg-white/5">
                                    {line.timestamp !== undefined ? `[${formatTimestamp(line.timestamp)}] ` : ""}{line.message}
                                  </span>
                                </div>
                              );
                            }
                            return (
                              <div key={i} className={`flex ${line.role === "agent" ? "justify-start" : "justify-end"}`}>
                                <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                                  line.role === "agent"
                                    ? "bg-gold/10 border border-gold/10 rounded-tl-sm"
                                    : "bg-blue-500/10 border border-blue-500/10 rounded-tr-sm"
                                }`}>
                                  <div className="flex items-center gap-1 mb-0.5">
                                    {line.role === "agent" ? <Bot size={8} className="text-gold" /> : <User size={8} className="text-blue-400" />}
                                    <span className={`text-[8px] font-medium ${line.role === "agent" ? "text-gold" : "text-blue-400"}`}>
                                      {line.role === "agent" ? "AI Agent" : "Customer"}
                                    </span>
                                    {line.timestamp !== undefined && (
                                      <span className="ml-auto text-[7px] text-muted font-mono">{formatTimestamp(line.timestamp)}</span>
                                    )}
                                  </div>
                                  <p className="text-[10px] leading-relaxed">{line.message}</p>
                                </div>
                              </div>
                            );
                          })}
                          {conversationDetail.transcript.length === 0 && (
                            <p className="text-[10px] text-muted text-center py-4">No transcript available</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-6">
                        <PhoneCall size={20} className="mx-auto text-muted mb-2" />
                        <p className="text-[10px] text-muted">No transcript data available</p>
                        <p className="text-[8px] text-muted mt-1">Transcript may still be processing</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── EMAIL CONTENT ── */}
                {detailEntry.platform === "email" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-gold" />
                      <h4 className="text-xs font-semibold">Email Content</h4>
                    </div>

                    {/* Sent message */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[9px] text-muted">
                        <ArrowRight size={9} className="text-gold" /> <span className="font-medium text-gold">Sent</span>
                        <span className="ml-auto">{detailEntry.sent_at ? new Date(detailEntry.sent_at).toLocaleString() : ""}</span>
                      </div>
                      <div className="bg-gold/[0.03] border border-gold/10 rounded-lg p-3">
                        {detailEntry.message_text?.startsWith("Subject:") && (
                          <p className="text-[10px] font-semibold mb-2 pb-2 border-b border-gold/10">
                            {detailEntry.message_text.split("\n")[0]}
                          </p>
                        )}
                        <p className="text-[10px] whitespace-pre-wrap leading-relaxed">
                          {detailEntry.message_text?.startsWith("Subject:")
                            ? detailEntry.message_text.split("\n").slice(2).join("\n")
                            : detailEntry.message_text}
                        </p>
                      </div>
                    </div>

                    {/* Reply */}
                    {detailEntry.reply_text && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[9px] text-muted">
                          <ArrowRight size={9} className="text-green-400 rotate-180" /> <span className="font-medium text-green-400">Reply</span>
                          <span className="ml-auto">{detailEntry.replied_at ? new Date(detailEntry.replied_at).toLocaleString() : ""}</span>
                        </div>
                        <div className="bg-green-400/[0.03] border border-green-400/10 rounded-lg p-3">
                          <p className="text-[10px] whitespace-pre-wrap leading-relaxed">{detailEntry.reply_text}</p>
                        </div>
                      </div>
                    )}

                    {/* Thread history */}
                    {threadEntries.length > 0 && (
                      <div className="space-y-2 border-t border-border pt-3">
                        <div className="flex items-center gap-1.5 text-[9px] text-muted">
                          <MessageSquare size={9} /> <span className="uppercase tracking-wider">Thread History ({threadEntries.length})</span>
                        </div>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {[...threadEntries]
                            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                            .map(te => (
                              <div key={te.id} className="bg-surface-light border border-border rounded-lg p-2.5 space-y-1.5">
                                <div className="flex items-center justify-between text-[8px] text-muted">
                                  <span className="flex items-center gap-1">
                                    <ArrowRight size={8} className="text-gold" />
                                    <span className="font-medium text-gold">Sent</span>
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded-full ${STATUS_STYLE[te.status] || "bg-white/5 text-muted"}`}>{te.status}</span>
                                  <span>{new Date(te.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                </div>
                                {te.message_text?.startsWith("Subject:") && (
                                  <p className="text-[9px] font-semibold text-muted">{te.message_text.split("\n")[0]}</p>
                                )}
                                <p className="text-[9px] text-muted line-clamp-2">
                                  {te.message_text?.startsWith("Subject:")
                                    ? te.message_text.split("\n").slice(2).join(" ").substring(0, 150)
                                    : te.message_text?.substring(0, 150)}
                                </p>
                                {te.reply_text && (
                                  <div className="bg-green-400/[0.03] border border-green-400/10 rounded p-1.5">
                                    <p className="text-[8px] font-medium text-green-400 mb-0.5">Reply</p>
                                    <p className="text-[9px] text-muted line-clamp-2">{te.reply_text.substring(0, 120)}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── SMS / DM CONTENT ── */}
                {(detailEntry.platform === "sms" || detailEntry.platform.includes("dm") || detailEntry.platform === "instagram" || detailEntry.platform === "facebook" || detailEntry.platform === "linkedin" || detailEntry.platform === "tiktok") && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {detailEntry.platform === "sms" ? <Phone size={14} className="text-green-400" /> : <MessageSquare size={14} className="text-blue-400" />}
                      <h4 className="text-xs font-semibold">{detailEntry.platform === "sms" ? "SMS" : "DM"} Conversation</h4>
                    </div>

                    {/* Outbound message */}
                    <div className="flex justify-end">
                      <div className="max-w-[85%] bg-gold/10 border border-gold/10 rounded-xl rounded-tr-sm px-3 py-2">
                        <div className="flex items-center gap-1 mb-0.5">
                          <Bot size={8} className="text-gold" />
                          <span className="text-[8px] font-medium text-gold">You</span>
                          <span className="text-[7px] text-muted ml-auto">
                            {detailEntry.sent_at ? new Date(detailEntry.sent_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
                          </span>
                        </div>
                        <p className="text-[10px] leading-relaxed">{detailEntry.message_text}</p>
                      </div>
                    </div>

                    {/* Reply */}
                    {detailEntry.reply_text && (
                      <div className="flex justify-start">
                        <div className="max-w-[85%] bg-blue-500/10 border border-blue-500/10 rounded-xl rounded-tl-sm px-3 py-2">
                          <div className="flex items-center gap-1 mb-0.5">
                            <User size={8} className="text-blue-400" />
                            <span className="text-[8px] font-medium text-blue-400">{detailEntry.business_name}</span>
                            <span className="text-[7px] text-muted ml-auto">
                              {detailEntry.replied_at ? new Date(detailEntry.replied_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
                            </span>
                          </div>
                          <p className="text-[10px] leading-relaxed">{detailEntry.reply_text}</p>
                        </div>
                      </div>
                    )}

                    {!detailEntry.reply_text && (
                      <p className="text-[10px] text-muted text-center py-3">No reply received yet</p>
                    )}
                  </div>
                )}

                {/* Metadata */}
                {detailEntry.metadata && Object.keys(detailEntry.metadata).length > 0 && (
                  <div className="border-t border-border pt-3">
                    <p className="text-[9px] text-muted uppercase tracking-wider mb-2">Metadata</p>
                    <div className="space-y-1">
                      {Object.entries(detailEntry.metadata).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between text-[10px]">
                          <span className="text-muted">{key}</span>
                          <span className="font-mono text-[9px]">{String(val).substring(0, 40)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

      {/* ══════════ PROVISIONING TAB ══════════ */}
      {tab === "provisioning" && (
        <div className="space-y-6">
          {/* Active Phone Numbers */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Phone size={14} className="text-gold" /> Active Phone Numbers</h3>
              <button onClick={fetchProvisionedNumbers} className="btn-secondary text-xs flex items-center gap-1">
                <RefreshCw size={10} className={provLoading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>

            {provLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={16} className="animate-spin text-gold" />
              </div>
            ) : provNumbers.length === 0 ? (
              <div className="text-center py-8 bg-surface-light rounded-xl">
                <Phone size={24} className="mx-auto text-muted mb-2" />
                <p className="text-xs text-muted">No phone numbers provisioned yet</p>
                <p className="text-[10px] text-muted mt-1">Buy a Twilio number below to start making calls & sending SMS</p>
              </div>
            ) : (
              <div className="space-y-2">
                {provNumbers.map((num, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-light border border-border">
                    <div className="w-8 h-8 rounded-lg bg-green-400/10 flex items-center justify-center">
                      <Phone size={14} className="text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold font-mono">{num.phone_number}</p>
                      <p className="text-[9px] text-muted">{num.client_name || "System"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {num.agent_id && (
                        <span className="text-[8px] px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 flex items-center gap-1">
                          <Bot size={8} /> AI Agent
                        </span>
                      )}
                      <span className="text-[8px] px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 flex items-center gap-1">
                        <Wifi size={8} /> Active
                      </span>
                      <button onClick={() => copyText(num.phone_number)} className="p-1 hover:bg-white/5 rounded">
                        <Copy size={10} className="text-muted" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Buy New Number */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Plus size={14} className="text-gold" /> Buy Phone Number</h3>
            <p className="text-[10px] text-muted">Purchase a Twilio phone number for outbound SMS & AI calls. Numbers are auto-linked to ElevenLabs for AI calling.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted mb-1 block">Client</label>
                <select value={provClientId} onChange={e => setProvClientId(e.target.value)}
                  className="input w-full text-xs">
                  <option value="">Select client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.business_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted mb-1 block">Area Code</label>
                <div className="flex gap-2">
                  <input value={areaCode} onChange={e => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    placeholder="305"
                    className="input flex-1 text-xs font-mono"
                    maxLength={3} />
                  <button onClick={searchAvailableNumbers} disabled={searchingNumbers || !areaCode}
                    className="btn-primary text-xs flex items-center gap-1 px-4">
                    {searchingNumbers ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} Search
                  </button>
                </div>
              </div>
            </div>

            {/* Available numbers */}
            {availableNumbers.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-muted">{availableNumbers.length} numbers available:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                  {availableNumbers.map((num, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-light border border-border hover:border-gold/20 transition-all">
                      <PhoneForwarded size={12} className="text-green-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-semibold">{num.phone}</p>
                        <p className="text-[9px] text-muted truncate">{num.locality}{num.locality && num.region ? ", " : ""}{num.region}</p>
                      </div>
                      <button onClick={() => buyNumber(num.phone)} disabled={buyingNumber === num.phone || !provClientId}
                        className="text-[9px] px-3 py-1.5 rounded-lg bg-gold text-black font-medium hover:bg-gold/90 disabled:opacity-30 flex items-center gap-1">
                        {buyingNumber === num.phone ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />} Buy
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Email Configuration */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Mail size={14} className="text-gold" /> Email Configuration</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* SendGrid status */}
              <div className="p-3 rounded-xl bg-surface-light border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center">
                    <Mail size={12} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">SendGrid</p>
                    <p className="text-[9px] text-muted">Transactional emails</p>
                  </div>
                  <span className="ml-auto text-[8px] px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 flex items-center gap-1">
                    <Shield size={7} /> Connected
                  </span>
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-muted">From</span>
                    <span className="font-mono">noreply@shortstack.work</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Used for</span>
                    <span>Cold outreach, notifications</span>
                  </div>
                </div>
              </div>

              {/* GHL status */}
              <div className="p-3 rounded-xl bg-surface-light border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-purple-500/10 flex items-center justify-center">
                    <Globe size={12} className="text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">GoHighLevel</p>
                    <p className="text-[9px] text-muted">CRM email & SMS</p>
                  </div>
                  <span className="ml-auto text-[8px] px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 flex items-center gap-1">
                    <Shield size={7} /> Connected
                  </span>
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-muted">Used for</span>
                    <span>Fallback email & SMS</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Twilio status */}
            <div className="p-3 rounded-xl bg-surface-light border border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded bg-red-500/10 flex items-center justify-center">
                  <Phone size={12} className="text-red-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Twilio</p>
                  <p className="text-[9px] text-muted">SMS & voice calling</p>
                </div>
                <span className="ml-auto text-[8px] px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 flex items-center gap-1">
                  <Shield size={7} /> Connected
                </span>
              </div>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-muted">Numbers</span>
                  <span>{provNumbers.length} provisioned</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Used for</span>
                  <span>Outbound SMS, AI calls via ElevenLabs</span>
                </div>
              </div>
            </div>

            {/* ElevenLabs status */}
            <div className="p-3 rounded-xl bg-surface-light border border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center">
                  <Bot size={12} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold">ElevenLabs</p>
                  <p className="text-[9px] text-muted">AI voice agents</p>
                </div>
                <span className="ml-auto text-[8px] px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 flex items-center gap-1">
                  <Shield size={7} /> Connected
                </span>
              </div>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-muted">Used for</span>
                  <span>AI cold calls, voice receptionist</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Linked to</span>
                  <span>Twilio phone numbers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ CONFIG TAB ══════════ */}
      {tab === "config" && (
        <div className="space-y-5">

          {/* ── Section 1: Lead Scraping ── */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Radar size={14} className="text-gold" /> Lead Scraping Configuration
              </h3>
              <div className="flex items-center gap-2">
                {scraperResult && (
                  <span className="text-[10px] px-2 py-1 rounded-lg bg-green-400/10 text-green-400 border border-green-400/20 flex items-center gap-1">
                    <CheckCircle size={10} /> {scraperResult.leads_found} found · {scraperResult.duplicates_skipped} skipped
                  </span>
                )}
                <button onClick={runScraper} disabled={scraperRunning}
                  className="btn-primary text-xs flex items-center gap-1.5 px-4">
                  {scraperRunning ? <Loader2 size={12} className="animate-spin" /> : <Radar size={12} />}
                  {scraperRunning ? "Running…" : "Run Scraper Now"}
                </button>
              </div>
            </div>

            {/* Platforms to scrape */}
            <div>
              <p className="text-[10px] text-muted mb-2 uppercase tracking-wider">Platforms to scrape from</p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: "google_maps", label: "Google Maps", icon: <MapPin size={12} className="text-blue-400" /> },
                  { id: "facebook", label: "Facebook", icon: <FacebookIcon size={12} /> },
                  { id: "yelp", label: "Yelp", icon: <Star size={12} className="text-red-400" /> },
                ].map(pl => {
                  const active = config.scrape_platforms.includes(pl.id);
                  return (
                    <button key={pl.id} onClick={() => toggleScrapePlatform(pl.id)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                        active ? "bg-gold/10 text-gold border-gold/20" : "text-muted border-white/[0.06] hover:border-white/10"
                      }`}>
                      {pl.icon} {pl.label}
                      {active && <Check size={10} className="ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Niches */}
              <div>
                <p className="text-[10px] text-muted mb-1.5 uppercase tracking-wider">Niches / Industries</p>
                <div className="flex flex-wrap gap-1.5 mb-2 min-h-[36px] p-2 rounded-lg bg-surface-light border border-border">
                  {config.scrape_niches.map((n: string) => (
                    <span key={n} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-gold/10 text-gold border border-gold/20">
                      {n}
                      <button onClick={() => removeTag("scrape_niches", n)} className="hover:text-white transition-colors ml-0.5">
                        <X size={9} />
                      </button>
                    </span>
                  ))}
                </div>
                <input value={nicheInput} onChange={e => setNicheInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag("scrape_niches", nicheInput); setNicheInput(""); } }}
                  placeholder="Type a niche and press Enter…"
                  className="input w-full text-xs py-1.5" />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {["Dentist","Med Spa","Plumber","HVAC","Roofing","Real Estate","Restaurant","Gym/Fitness","Salon/Barber","Auto Repair","Chiropractor","Lawyer","Accountant","Landscaping","Cleaning Services","Photography","Pet Services","Home Services"].filter((p: string) => !config.scrape_niches.includes(p)).slice(0, 10).map((preset: string) => (
                    <button key={preset} onClick={() => addTag("scrape_niches", preset)}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-muted hover:bg-white/10 hover:text-foreground transition-colors">
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Locations */}
              <div>
                <p className="text-[10px] text-muted mb-1.5 uppercase tracking-wider">Locations</p>
                <div className="flex flex-wrap gap-1.5 mb-2 min-h-[36px] p-2 rounded-lg bg-surface-light border border-border">
                  {config.scrape_locations.map((loc: string) => (
                    <span key={loc} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-blue-400/10 text-blue-400 border border-blue-400/20">
                      <MapPin size={8} /> {loc}
                      <button onClick={() => removeTag("scrape_locations", loc)} className="hover:text-white transition-colors ml-0.5">
                        <X size={9} />
                      </button>
                    </span>
                  ))}
                </div>
                <input value={locationInput} onChange={e => setLocationInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag("scrape_locations", locationInput); setLocationInput(""); } }}
                  placeholder="e.g. Miami, FL — press Enter…"
                  className="input w-full text-xs py-1.5" />
              </div>
            </div>

            {/* Volume + Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-muted mb-1.5 uppercase tracking-wider">Volume per search</p>
                <div className="flex items-center gap-3">
                  <input type="range" min={5} max={50} step={5} value={config.scrape_volume}
                    onChange={e => setConfig(c => ({ ...c, scrape_volume: Number(e.target.value) }))}
                    className="flex-1 accent-yellow-400" />
                  <span className="text-xs font-bold w-8 text-center text-gold">{config.scrape_volume}</span>
                  <span className="text-[9px] text-muted">leads</span>
                </div>
                <p className="text-[9px] text-muted mt-1">Max 50 per niche/location combo</p>
              </div>

              <div>
                <p className="text-[10px] text-muted mb-1.5 uppercase tracking-wider">Filters</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted flex-1">Min Google rating</span>
                    <input type="number" min={0} max={5} step={0.5} value={config.scrape_filters.min_rating}
                      onChange={e => setConfig(c => ({ ...c, scrape_filters: { ...c.scrape_filters, min_rating: Number(e.target.value) } }))}
                      className="input w-16 text-xs text-center py-1" />
                    <Star size={10} className="text-yellow-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted flex-1">Max reviews</span>
                    <input type="number" min={0} max={10000} step={50} value={config.scrape_filters.max_reviews}
                      onChange={e => setConfig(c => ({ ...c, scrape_filters: { ...c.scrape_filters, max_reviews: Number(e.target.value) } }))}
                      className="input w-20 text-xs text-center py-1" />
                  </div>
                  {([
                    { key: "require_phone" as const, label: "Require phone number" },
                    { key: "require_website" as const, label: "Require website" },
                  ] as { key: "require_phone" | "require_website"; label: string }[]).map(f => (
                    <div key={f.key} className="flex items-center gap-2">
                      <button onClick={() => setConfig(c => ({ ...c, scrape_filters: { ...c.scrape_filters, [f.key]: !c.scrape_filters[f.key] } }))}
                        className={`w-7 h-4 rounded-full p-0.5 transition-colors flex-shrink-0 ${config.scrape_filters[f.key] ? "bg-gold" : "bg-white/10"}`}>
                        <div className={`w-3 h-3 rounded-full bg-zinc-200 shadow-sm transition-transform ${config.scrape_filters[f.key] ? "translate-x-3" : "translate-x-0"}`} />
                      </button>
                      <span className="text-[10px] text-muted">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Daily Outreach Targets ── */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sliders size={14} className="text-gold" /> Daily Outreach Targets
            </h3>

            {/* Spam guard banner */}
            <div className={`flex items-center gap-3 p-2.5 rounded-lg border ${spamGuardEnabled ? "bg-green-400/[0.04] border-green-400/20" : "bg-orange-400/[0.04] border-orange-400/20"}`}>
              <Shield size={13} className={spamGuardEnabled ? "text-green-400" : "text-orange-400"} />
              <div className="flex-1">
                <p className="text-[10px] font-medium">Spam Guard is {spamGuardEnabled ? "ON" : "OFF"}</p>
                <p className="text-[9px] text-muted">{spamGuardEnabled ? "Hard caps are enforced — effective limits shown below" : "Limits will not be capped — enable in Settings for protection"}</p>
              </div>
              <a href="/dashboard/settings" className="text-[9px] text-gold hover:underline flex items-center gap-0.5">
                <ExternalLink size={9} /> Settings
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([
                { key: "email_daily_limit" as const, label: "Email", icon: <Mail size={12} className="text-gold" />, max: 500, cap: 500 },
                { key: "sms_daily_limit" as const, label: "SMS", icon: <Phone size={12} className="text-green-400" />, max: 300, cap: 300 },
                { key: "calls_daily_limit" as const, label: "AI Calls", icon: <PhoneCall size={12} className="text-emerald-400" />, max: 100, cap: 100 },
              ] as { key: "email_daily_limit" | "sms_daily_limit" | "calls_daily_limit"; label: string; icon: React.ReactNode; max: number; cap: number }[]).map(ch => {
                const val = config[ch.key] as number;
                const effective = spamGuardEnabled ? Math.min(val, ch.cap) : val;
                return (
                  <div key={ch.key} className="p-3 rounded-xl bg-surface-light border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-medium">{ch.icon} {ch.label}</span>
                      <div className="flex items-center gap-1.5">
                        <input type="number" min={0} max={ch.max} value={val}
                          onChange={e => setConfig(c => ({ ...c, [ch.key]: Number(e.target.value) }))}
                          className="input w-16 text-xs text-center py-1" />
                        <span className="text-[9px] text-muted">/day</span>
                      </div>
                    </div>
                    <input type="range" min={0} max={ch.max} value={val}
                      onChange={e => setConfig(c => ({ ...c, [ch.key]: Number(e.target.value) }))}
                      className="w-full accent-yellow-400" />
                    {spamGuardEnabled && effective < val && (
                      <p className="text-[9px] text-orange-400 flex items-center gap-1">
                        <AlertTriangle size={9} /> Capped at {effective}/day by spam guard
                      </p>
                    )}
                  </div>
                );
              })}

              {/* DM per platform */}
              <div className="p-3 rounded-xl bg-surface-light border border-border space-y-2 md:col-span-2">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-2">DM Limits per Platform</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["instagram", "linkedin", "facebook", "tiktok"] as const).map(p => {
                    const plat = config.platforms[p] || { enabled: true, daily_limit: 20 };
                    const dmVal = config.dm_daily_limits[p];
                    return (
                      <div key={p} className="flex items-center gap-2 py-1">
                        <button onClick={() => setConfig(c => ({
                          ...c,
                          platforms: { ...c.platforms, [p]: { ...plat, enabled: !plat.enabled } }
                        }))} className={`w-7 h-4 rounded-full p-0.5 transition-colors flex-shrink-0 ${plat.enabled ? "bg-gold" : "bg-white/10"}`}>
                          <div className={`w-3 h-3 rounded-full bg-zinc-200 shadow-sm transition-transform ${plat.enabled ? "translate-x-3" : "translate-x-0"}`} />
                        </button>
                        <span className="flex items-center gap-1 text-[10px] flex-1 capitalize">{PLATFORM_ICON[p]} {p}</span>
                        <input type="number" min={0} max={50} value={dmVal}
                          onChange={e => setConfig(c => ({ ...c, dm_daily_limits: { ...c.dm_daily_limits, [p]: Number(e.target.value) } }))}
                          className="input w-14 text-xs text-center py-1" />
                        <span className="text-[9px] text-muted">/day</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1 border-t border-border">
              <span className="text-xs text-muted flex-1">Total daily target (all channels combined)</span>
              <input type="number" value={config.total_daily_target} min={0} max={1000}
                onChange={e => setConfig(c => ({ ...c, total_daily_target: Number(e.target.value) }))}
                className="input w-20 text-xs text-center py-1.5" />
              <span className="text-[9px] text-muted">/day</span>
            </div>
          </div>

          {/* ── Section 3: Schedule & Automation ── */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Calendar size={14} className="text-gold" /> Schedule & Automation
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-muted mb-1.5 block uppercase tracking-wider">Daily start time</label>
                <input type="time" value={config.schedule_time}
                  onChange={e => setConfig(c => ({ ...c, schedule_time: e.target.value }))}
                  className="input w-full text-xs py-1.5" />
              </div>
              <div>
                <label className="text-[10px] text-muted mb-1.5 block uppercase tracking-wider">Timezone</label>
                <select value={config.timezone} onChange={e => setConfig(c => ({ ...c, timezone: e.target.value }))}
                  className="input w-full text-xs py-1.5">
                  <option value="America/New_York">Eastern (ET)</option>
                  <option value="America/Chicago">Central (CT)</option>
                  <option value="America/Denver">Mountain (MT)</option>
                  <option value="America/Los_Angeles">Pacific (PT)</option>
                  <option value="America/Anchorage">Alaska (AKT)</option>
                  <option value="Pacific/Honolulu">Hawaii (HT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Central Europe (CET)</option>
                </select>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-muted mb-2 uppercase tracking-wider">Message Style</p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { val: "professional", label: "Professional", desc: "Formal, business-focused" },
                  { val: "friendly", label: "Friendly", desc: "Warm, approachable" },
                  { val: "professional and friendly", label: "Balanced", desc: "Pro + friendly" },
                  { val: "bold", label: "Bold", desc: "Direct, punchy" },
                ].map(s => (
                  <button key={s.val} onClick={() => setConfig(c => ({ ...c, message_style: s.val }))}
                    className={`text-left px-3 py-2 rounded-lg border transition-all ${
                      config.message_style === s.val ? "bg-gold/10 text-gold border-gold/20" : "text-muted border-white/[0.06] hover:border-white/10"
                    }`}>
                    <p className="text-xs font-medium">{s.label}</p>
                    <p className="text-[9px] opacity-70">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Automation Rules</p>
              {[
                { key: "auto_followup", label: "Auto follow-up sequence", desc: "Automatically send follow-ups on schedule" },
                { key: "followup_day_3", label: "Day 3 follow-up", desc: "Send a follow-up 3 days after initial message" },
                { key: "followup_day_7", label: "Day 7 follow-up", desc: "Send a follow-up 7 days after initial message" },
                { key: "exclude_contacted", label: "Exclude already contacted", desc: "Skip leads you have reached out to before" },
                { key: "pause_on_reply", label: "Pause sequence on reply", desc: "Stop automated follow-ups when prospect replies" },
              ].map(item => (
                <div key={item.key} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light hover:bg-white/[0.02] transition-colors">
                  <button onClick={() => setConfig(c => ({ ...c, [item.key]: !(c[item.key as keyof typeof c]) }))}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors flex-shrink-0 ${
                      config[item.key as keyof typeof config] ? "bg-gold" : "bg-white/10"
                    }`}>
                    <div className={`w-3 h-3 rounded-full bg-zinc-200 shadow-sm transition-transform ${
                      config[item.key as keyof typeof config] ? "translate-x-4" : "translate-x-0"
                    }`} />
                  </button>
                  <div className="flex-1">
                    <p className="text-xs font-medium">{item.label}</p>
                    <p className="text-[9px] text-muted">{item.desc}</p>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                    config[item.key as keyof typeof config] ? "bg-green-400/10 text-green-400" : "bg-white/5 text-muted"
                  }`}>{config[item.key as keyof typeof config] ? "On" : "Off"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Section 4: Compliance & Safety ── */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield size={14} className="text-gold" /> Compliance & Safety
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Spam guard card */}
              <div className={`p-3 rounded-xl border ${spamGuardEnabled ? "bg-green-400/[0.04] border-green-400/20" : "bg-orange-400/[0.04] border-orange-400/20"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${spamGuardEnabled ? "bg-green-400/10" : "bg-orange-400/10"}`}>
                    <Shield size={13} className={spamGuardEnabled ? "text-green-400" : "text-orange-400"} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold">Spam Guard</p>
                    <p className="text-[9px] text-muted">Rate-limit protection</p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${spamGuardEnabled ? "bg-green-400/10 text-green-400" : "bg-orange-400/10 text-orange-400"}`}>
                    {spamGuardEnabled ? "Active" : "Disabled"}
                  </span>
                </div>
                <p className="text-[9px] text-muted mb-2">Controls maximum daily send limits to protect sender reputation.</p>
                <a href="/dashboard/settings" className="inline-flex items-center gap-1 text-[9px] text-gold hover:underline">
                  <ExternalLink size={9} /> Configure in Settings
                </a>
              </div>

              {/* Sender pool health */}
              <div className="p-3 rounded-xl bg-surface-light border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-400/10 flex items-center justify-center">
                    <Activity size={13} className="text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold">Sender Pool</p>
                    <p className="text-[9px] text-muted">Email & SMS health</p>
                  </div>
                  {senderStats?.health && (
                    <span className={`text-[9px] px-2 py-0.5 rounded-full capitalize ${
                      senderStats.health === "good" ? "bg-green-400/10 text-green-400" :
                      senderStats.health === "warning" ? "bg-orange-400/10 text-orange-400" :
                      "bg-red-400/10 text-red-400"
                    }`}>{senderStats.health}</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {senderStats ? (
                    <>
                      {senderStats.total_senders !== undefined && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted">Active senders</span>
                          <span className="font-medium">{senderStats.total_senders}</span>
                        </div>
                      )}
                      {senderStats.bounce_rate !== undefined && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted">Bounce rate</span>
                          <span className={`font-medium ${(senderStats.bounce_rate ?? 0) > 5 ? "text-orange-400" : "text-green-400"}`}>
                            {(senderStats.bounce_rate ?? 0).toFixed(1)}%
                          </span>
                        </div>
                      )}
                      {senderStats.warmup_stage && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted">Warmup stage</span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400 text-[9px] capitalize">{senderStats.warmup_stage}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[9px] text-muted py-2">
                      <Loader2 size={9} className="animate-spin" /> Loading sender stats…
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bounce rate health bar */}
            {senderStats?.bounce_rate !== undefined && (
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-muted">Bounce rate health</span>
                  <span className={(senderStats.bounce_rate ?? 0) > 5 ? "text-orange-400" : "text-green-400"}>
                    {(senderStats.bounce_rate ?? 0).toFixed(1)}% — {(senderStats.bounce_rate ?? 0) < 2 ? "Excellent" : (senderStats.bounce_rate ?? 0) < 5 ? "Good" : (senderStats.bounce_rate ?? 0) < 10 ? "Warning" : "Critical"}
                  </span>
                </div>
                <div className="w-full bg-surface-light rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${
                    (senderStats.bounce_rate ?? 0) < 2 ? "bg-green-400" :
                    (senderStats.bounce_rate ?? 0) < 5 ? "bg-yellow-400" :
                    (senderStats.bounce_rate ?? 0) < 10 ? "bg-orange-400" : "bg-red-400"
                  }`} style={{ width: `${Math.min((senderStats.bounce_rate ?? 0) * 5, 100)}%` }} />
                </div>
                <div className="flex justify-between text-[8px] text-muted mt-0.5">
                  <span>0% — ideal</span>
                  <span>5% — warning</span>
                  <span>10%+ — critical</span>
                </div>
              </div>
            )}

            {!senderStats && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <Building2 size={12} className="text-muted" />
                <p className="text-[10px] text-muted">Sender stats will appear here once the API is connected.</p>
              </div>
            )}
          </div>

          {/* Scheduled Runs */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarRange size={14} className="text-gold" />
              <h3 className="text-xs font-semibold">Scheduled Runs</h3>
            </div>

            {autoRunConfig ? (
              <>
                {/* Status row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${
                    autoRunConfig.enabled
                      ? "bg-green-400/10 text-green-400"
                      : "bg-red-400/10 text-red-400"
                  }`}>
                    {autoRunConfig.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-muted">
                    <Clock size={10} /> {autoRunConfig.time}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-muted">
                    {autoRunConfig.days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ")}
                  </span>
                </div>

                {/* Mini calendar */}
                {(() => {
                  const DAY_MAP: Record<number, string> = { 0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat" };
                  const today = new Date();
                  const year = today.getFullYear();
                  const month = today.getMonth();
                  const firstDay = new Date(year, month, 1);
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  // Monday-based offset: 0=Mon ... 6=Sun
                  const startOffset = (firstDay.getDay() + 6) % 7;
                  const todayDate = today.getDate();

                  const isScheduled = (day: number) => {
                    const d = new Date(year, month, day);
                    return autoRunConfig.enabled && autoRunConfig.days.includes(DAY_MAP[d.getDay()]);
                  };

                  const isPast = (day: number) => {
                    const d = new Date(year, month, day);
                    d.setHours(23, 59, 59);
                    return d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                  };

                  // Next run calculation
                  let nextRunDate: Date | null = null;
                  if (autoRunConfig.enabled) {
                    const check = new Date(today);
                    for (let i = 0; i < 60; i++) {
                      check.setDate(check.getDate() + (i === 0 ? 0 : 1));
                      if (i === 0) {
                        // Today: only count if the scheduled time hasn't passed
                        const [hh, mm] = autoRunConfig.time.split(":").map(Number);
                        if (today.getHours() > hh || (today.getHours() === hh && today.getMinutes() >= mm)) {
                          continue;
                        }
                      }
                      if (autoRunConfig.days.includes(DAY_MAP[check.getDay()])) {
                        nextRunDate = new Date(check);
                        break;
                      }
                    }
                  }

                  // Remaining runs this month
                  let runsRemaining = 0;
                  for (let d = todayDate; d <= daysInMonth; d++) {
                    if (isScheduled(d) && !isPast(d)) runsRemaining++;
                  }

                  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
                  const cells: (number | null)[] = [];
                  for (let i = 0; i < startOffset; i++) cells.push(null);
                  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                  while (cells.length % 7 !== 0) cells.push(null);

                  const weekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short" });
                  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

                  return (
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted font-medium">{monthFmt.format(firstDay)}</p>
                      <div className="rounded-lg border border-border bg-surface-light p-2">
                        {/* Day name headers */}
                        <div className="grid grid-cols-7 gap-0.5 mb-1">
                          {dayLabels.map((l, i) => (
                            <div key={i} className="text-center text-[8px] text-muted font-medium py-0.5">
                              {l}
                            </div>
                          ))}
                        </div>
                        {/* Day cells */}
                        <div className="grid grid-cols-7 gap-0.5">
                          {cells.map((day, i) => (
                            <div key={i} className={`relative flex flex-col items-center justify-center h-6 rounded text-[9px]
                              ${!day ? "" : ""}
                              ${day && isPast(day) ? "text-white/20" : "text-white/70"}
                              ${day === todayDate ? "ring-1 ring-gold/60 bg-gold/10 font-bold text-gold" : ""}
                            `}>
                              {day && <span>{day}</span>}
                              {day && isScheduled(day) && !isPast(day) && (
                                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-gold" />
                              )}
                              {day && isScheduled(day) && isPast(day) && (
                                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-white/10" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Summary row */}
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted">
                          {nextRunDate ? (
                            <>Next run: <span className="text-gold font-medium">
                              {weekdayFmt.format(nextRunDate)}, {nextRunDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {autoRunConfig.time}
                            </span></>
                          ) : (
                            <span className="text-muted">No upcoming runs</span>
                          )}
                        </span>
                        <span className="text-muted">{runsRemaining} run{runsRemaining !== 1 ? "s" : ""} remaining this month</span>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <Radar size={12} className="text-muted animate-pulse" />
                <p className="text-[10px] text-muted">Loading auto-run schedule...</p>
              </div>
            )}
          </div>

          {/* Save footer */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-surface-light border border-border">
            <div>
              <p className="text-xs font-medium">Save all configuration</p>
              <p className="text-[9px] text-muted">Changes apply to the next scheduled outreach run</p>
            </div>
            <button onClick={saveConfig} disabled={configSaving}
              className="btn-primary text-xs flex items-center gap-1.5 px-5">
              {configSaving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              {configSaving ? "Saving…" : "Save Configuration"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
