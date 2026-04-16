"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useManagedClient } from "@/lib/use-managed-client";
import {
  Search, ChevronDown, Mail, Phone, MessageSquare,
  Star, Download, LayoutGrid, LayoutList,
  CheckSquare, Square, Filter, ArrowUpDown, Clock,
  Briefcase, Globe, Camera, Music, Send, Users, ChevronUp,
  X, RefreshCw, Upload, Trash2, Tag, AlertTriangle, Coins,
  Zap, TrendingUp, BarChart3, Target, Eye,
  EyeOff, Settings2, CalendarClock,
  Plus,
  Bookmark, Hash, Layers, Columns3, AlignJustify, Grid3X3,
  Bot, Timer, ArrowRight,
  Bell, PhoneCall, MessageCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

type CRMStatus = "new" | "contacted" | "replied" | "booked" | "converted";
type SortKey = "newest" | "oldest" | "rating" | "reviews" | "last_contacted" | "score" | "name_az" | "name_za";
type ViewMode = "table" | "card" | "pipeline";
type Density = "compact" | "comfortable" | "dense";
type AutomationTrigger = "new_lead" | "no_reply_2d" | "no_reply_5d" | "after_reply" | "after_booking";
type AutomationAction = "send_sms" | "send_email" | "ai_call" | "update_status" | "add_tag" | "notify";

interface OutreachLogEntry {
  id: string;
  platform: string;
  message_text: string;
  status: string;
  reply_text: string | null;
  sent_at: string;
  replied_at: string | null;
}

interface CRMLead {
  id: string;
  business_name: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  google_rating: number | null;
  review_count: number;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  tiktok_url: string | null;
  status: string;
  created_at: string;
  outreach_log: OutreachLogEntry[];
}

interface LeadNote { id: string; text: string; created: string }
interface LeadTag { id: string; label: string; color: string }
interface FollowUp { leadId: string; date: string; note: string }
interface AutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
  enabled: boolean;
  message?: string;
  delay?: number;
}
interface SavedSegment { id: string; name: string; filters: FilterState }
interface FilterState {
  industries: string[];
  cities: string[];
  hasPhone: boolean | null;
  hasEmail: boolean | null;
  hasSocial: boolean | null;
  ratingMin: number;
  ratingMax: number;
  scoreMin: number;
  scoreMax: number;
  tags: string[];
  dateFrom: string;
  dateTo: string;
  isStale: boolean | null;
}

interface ColumnConfig { key: string; label: string; visible: boolean; width?: string }

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════ */

const STATUS_TABS: { key: CRMStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "replied", label: "Replied" },
  { key: "booked", label: "Booked" },
  { key: "converted", label: "Converted" },
];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  contacted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  called: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  replied: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  booked: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  converted: "bg-gold/10 text-gold border-gold/20",
  not_interested: "bg-red-500/10 text-red-400 border-red-500/20",
};

const OUTREACH_STATUS_COLORS: Record<string, string> = {
  sent: "text-blue-400", delivered: "text-blue-400", replied: "text-emerald-400",
  no_reply: "text-muted", bounced: "text-red-400", failed: "text-red-400", pending: "text-amber-400",
};

const TAG_COLORS = [
  { id: "red", bg: "bg-red-500/15 text-red-400 border-red-500/30" },
  { id: "blue", bg: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  { id: "green", bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { id: "purple", bg: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  { id: "amber", bg: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  { id: "pink", bg: "bg-pink-500/15 text-pink-400 border-pink-500/30" },
  { id: "cyan", bg: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" },
];

const AVAILABLE_TAGS: LeadTag[] = [
  { id: "vip", label: "VIP", color: "amber" },
  { id: "hot-lead", label: "Hot Lead", color: "red" },
  { id: "follow-up", label: "Follow Up", color: "blue" },
  { id: "decision-maker", label: "Decision Maker", color: "purple" },
  { id: "referral", label: "Referral", color: "green" },
  { id: "high-value", label: "High Value", color: "pink" },
  { id: "needs-nurture", label: "Needs Nurture", color: "cyan" },
  { id: "competitor-client", label: "Competitor Client", color: "red" },
];

const DEFAULT_AUTOMATIONS: AutomationRule[] = [
  { id: "a1", name: "Welcome SMS on New Lead", trigger: "new_lead", action: "send_sms", enabled: true, message: "Hi {{name}}, thanks for your interest! We'd love to learn more about {{business}}. When's a good time to chat?", delay: 0 },
  { id: "a2", name: "Follow-up Email (2 days no reply)", trigger: "no_reply_2d", action: "send_email", enabled: true, message: "Just following up on our previous message. We have some ideas that could help {{business}} grow.", delay: 2 },
  { id: "a3", name: "AI Cold Call (5 days no reply)", trigger: "no_reply_5d", action: "ai_call", enabled: false, message: "Pitch: Help {{business}} get more customers through digital marketing.", delay: 5 },
  { id: "a4", name: "Thank You SMS After Reply", trigger: "after_reply", action: "send_sms", enabled: true, message: "Thanks for getting back to us, {{name}}! Looking forward to working with {{business}}.", delay: 0 },
  { id: "a5", name: "Confirmation After Booking", trigger: "after_booking", action: "send_email", enabled: true, message: "Your meeting is confirmed! We'll send a calendar invite shortly.", delay: 0 },
  { id: "a6", name: "Tag Hot Leads on Reply", trigger: "after_reply", action: "add_tag", enabled: true, delay: 0 },
  { id: "a7", name: "Notify Team on Booking", trigger: "after_booking", action: "notify", enabled: true, delay: 0 },
];

const DEFAULT_FILTERS: FilterState = {
  industries: [], cities: [], hasPhone: null, hasEmail: null, hasSocial: null,
  ratingMin: 0, ratingMax: 5, scoreMin: 0, scoreMax: 100,
  tags: [], dateFrom: "", dateTo: "", isStale: null,
};

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: "select", label: "", visible: true, width: "w-8" },
  { key: "name", label: "Name", visible: true },
  { key: "contact", label: "Contact", visible: true },
  { key: "industry", label: "Industry", visible: true },
  { key: "location", label: "Location", visible: true },
  { key: "rating", label: "Rating", visible: true },
  { key: "score", label: "Score", visible: true },
  { key: "tags", label: "Tags", visible: true },
  { key: "status", label: "Status", visible: true },
  { key: "last_contact", label: "Last Contact", visible: true },
  { key: "actions", label: "Actions", visible: true },
  { key: "expand", label: "", visible: true, width: "w-8" },
];

const LEAD_EXPIRY_DAYS = 14;
const PAGE_SIZE = 50;

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */

function mapToCRMStatus(status: string): CRMStatus {
  if (status === "new") return "new";
  if (status === "called" || status === "contacted") return "contacted";
  if (status === "not_interested") return "contacted";
  if (status === "booked") return "booked";
  if (status === "converted") return "converted";
  return "new";
}

function formatShortDate(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getLeadScore(lead: CRMLead): number {
  let score = 0;
  if (lead.email) score += 15;
  if (lead.phone) score += 15;
  if (lead.instagram_url || lead.facebook_url || lead.linkedin_url) score += 10;
  if (lead.google_rating) score += Math.min(Math.round(lead.google_rating * 4), 20);
  if (lead.review_count > 0) score += Math.min(Math.round(lead.review_count / 10), 10);
  if (lead.website) score += 5;
  if (lead.owner_name) score += 5;
  if (lead.outreach_log.some(o => o.status === "replied")) score += 20;
  if (lead.status === "booked") score += 15;
  if (lead.status === "converted") score += 20;
  return Math.min(score, 100);
}

function getScoreInfo(score: number) {
  if (score >= 70) return { label: "HOT", color: "#ef4444", bg: "bg-red-500/10 text-red-400" };
  if (score >= 40) return { label: "WARM", color: "#f59e0b", bg: "bg-amber-500/10 text-amber-400" };
  return { label: "COLD", color: "#3b82f6", bg: "bg-blue-500/10 text-blue-400" };
}

function getTagStyle(colorId: string) {
  return TAG_COLORS.find(t => t.id === colorId)?.bg || TAG_COLORS[0].bg;
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export default function CRMPage() {
  useAuth();
  const supabase = createClient();
  const { clientId: managedClientId } = useManagedClient();

  // ── Core state ──
  const [leads, setLeads] = useState<CRMLead[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<CRMStatus | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [density, setDensity] = useState<Density>("comfortable");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  // ── UI state ──
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showBulkStatusMenu, setShowBulkStatusMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [showSegmentSave, setShowSegmentSave] = useState(false);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statsCollapsed, setStatsCollapsed] = useState(false);
  const [inlineStatusId, setInlineStatusId] = useState<string | null>(null);

  // ── Data state ──
  const [emailCredits, setEmailCredits] = useState(250);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [automations, setAutomations] = useState<AutomationRule[]>(DEFAULT_AUTOMATIONS);
  const [leadTags, setLeadTags] = useState<Record<string, string[]>>({});
  const [leadNotes, setLeadNotes] = useState<Record<string, LeadNote[]>>({});
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [savedSegments, setSavedSegments] = useState<SavedSegment[]>([
    { id: "s1", name: "Hot Leads", filters: { ...DEFAULT_FILTERS, scoreMin: 70 } },
    { id: "s2", name: "Needs Follow-up", filters: { ...DEFAULT_FILTERS, isStale: true } },
    { id: "s3", name: "Has Email & Phone", filters: { ...DEFAULT_FILTERS, hasPhone: true, hasEmail: true } },
  ]);
  const [newSegmentName, setNewSegmentName] = useState("");
  const [noteInput, setNoteInput] = useState("");

  const detailPanelRef = useRef<HTMLDivElement>(null);

  // ── Data fetching ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchLeads(); }, [managedClientId]);
  useEffect(() => { setPage(0); }, [activeTab, search, sortBy, filters]);

  async function fetchLeads() {
    try {
      setLoading(true);
      let query = supabase
        .from("leads")
        .select("id, business_name, owner_name, phone, email, website, city, state, industry, google_rating, review_count, instagram_url, facebook_url, linkedin_url, tiktok_url, status, created_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (managedClientId) query = query.eq("client_id", managedClientId);
      const { data: leadsData } = await query;

      if (!leadsData || leadsData.length === 0) { setLeads([]); return; }

      const leadIds = leadsData.map((l: Record<string, unknown>) => l.id);
      const { data: outreachData } = await supabase
        .from("outreach_log")
        .select("id, lead_id, platform, message_text, status, reply_text, sent_at, replied_at")
        .in("lead_id", leadIds)
        .order("sent_at", { ascending: false });

      const outreachByLead: Record<string, OutreachLogEntry[]> = {};
      (outreachData || []).forEach((o: unknown) => {
        const entry = o as OutreachLogEntry & { lead_id: string };
        const lid = entry.lead_id;
        if (!outreachByLead[lid]) outreachByLead[lid] = [];
        outreachByLead[lid].push(entry);
      });

      setLeads(leadsData.map((l: Record<string, unknown>) => ({ ...l, review_count: (l.review_count as number) || 0, outreach_log: outreachByLead[l.id as string] || [] }) as unknown as CRMLead));
    } catch (err) {
      console.error("[CRM] fetchLeads error:", err);
    } finally { setLoading(false); }
  }

  // ── Computed data ──
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length, new: 0, contacted: 0, replied: 0, booked: 0, converted: 0 };
    leads.forEach(l => { const s = mapToCRMStatus(l.status); c[s] = (c[s] || 0) + 1; });
    return c;
  }, [leads]);

  const uniqueIndustries = useMemo(() => Array.from(new Set(leads.map(l => l.industry).filter(Boolean) as string[])).sort(), [leads]);
  const uniqueCities = useMemo(() => Array.from(new Set(leads.map(l => l.city).filter(Boolean) as string[])).sort(), [leads]);

  const hasActiveFilters = useMemo(() => {
    const f = filters;
    return f.industries.length > 0 || f.cities.length > 0 || f.hasPhone !== null || f.hasEmail !== null ||
      f.hasSocial !== null || f.ratingMin > 0 || f.ratingMax < 5 || f.scoreMin > 0 || f.scoreMax < 100 ||
      f.tags.length > 0 || f.dateFrom !== "" || f.dateTo !== "" || f.isStale !== null;
  }, [filters]);

  const filtered = useMemo(() => {
    let result = leads;
    if (activeTab !== "all") result = result.filter(l => mapToCRMStatus(l.status) === activeTab);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.business_name.toLowerCase().includes(q) ||
        (l.industry && l.industry.toLowerCase().includes(q)) ||
        (l.city && l.city.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.owner_name && l.owner_name.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q))
      );
    }
    // Advanced filters
    const f = filters;
    if (f.industries.length > 0) result = result.filter(l => l.industry && f.industries.includes(l.industry));
    if (f.cities.length > 0) result = result.filter(l => l.city && f.cities.includes(l.city));
    if (f.hasPhone === true) result = result.filter(l => !!l.phone);
    if (f.hasPhone === false) result = result.filter(l => !l.phone);
    if (f.hasEmail === true) result = result.filter(l => !!l.email);
    if (f.hasEmail === false) result = result.filter(l => !l.email);
    if (f.hasSocial === true) result = result.filter(l => !!(l.instagram_url || l.facebook_url || l.linkedin_url || l.tiktok_url));
    if (f.ratingMin > 0) result = result.filter(l => (l.google_rating || 0) >= f.ratingMin);
    if (f.ratingMax < 5) result = result.filter(l => (l.google_rating || 0) <= f.ratingMax);
    if (f.scoreMin > 0) result = result.filter(l => getLeadScore(l) >= f.scoreMin);
    if (f.scoreMax < 100) result = result.filter(l => getLeadScore(l) <= f.scoreMax);
    if (f.tags.length > 0) result = result.filter(l => f.tags.some(t => (leadTags[l.id] || []).includes(t)));
    if (f.dateFrom) result = result.filter(l => new Date(l.created_at) >= new Date(f.dateFrom));
    if (f.dateTo) result = result.filter(l => new Date(l.created_at) <= new Date(f.dateTo));
    if (f.isStale === true) result = result.filter(l => isLeadStale(l));
    if (f.isStale === false) result = result.filter(l => !isLeadStale(l));

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === "rating") return (b.google_rating || 0) - (a.google_rating || 0);
      if (sortBy === "reviews") return (b.review_count || 0) - (a.review_count || 0);
      if (sortBy === "score") return getLeadScore(b) - getLeadScore(a);
      if (sortBy === "name_az") return a.business_name.localeCompare(b.business_name);
      if (sortBy === "name_za") return b.business_name.localeCompare(a.business_name);
      if (sortBy === "last_contacted") {
        const aL = a.outreach_log[0]?.sent_at || "1970-01-01";
        const bL = b.outreach_log[0]?.sent_at || "1970-01-01";
        return new Date(bL).getTime() - new Date(aL).getTime();
      }
      return 0;
    });
    return result;
  }, [leads, activeTab, search, sortBy, filters, leadTags]);

  const searchFiltered = useMemo(() => {
    if (!search) return leads;
    const q = search.toLowerCase();
    return leads.filter(l =>
      l.business_name.toLowerCase().includes(q) || (l.industry && l.industry.toLowerCase().includes(q)) ||
      (l.city && l.city.toLowerCase().includes(q)) || (l.email && l.email.toLowerCase().includes(q)) ||
      (l.owner_name && l.owner_name.toLowerCase().includes(q))
    );
  }, [leads, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const detailLead = leads.find(l => l.id === detailLeadId) || null;

  // ── Stats ──
  const stats = useMemo(() => {
    const total = leads.length;
    const withEmail = leads.filter(l => l.email).length;
    const withPhone = leads.filter(l => l.phone).length;
    const totalOutreach = leads.reduce((s, l) => s + l.outreach_log.length, 0);
    const replied = leads.filter(l => l.outreach_log.some(o => o.status === "replied")).length;
    const stale = leads.filter(l => isLeadStale(l)).length;
    const avgScore = total > 0 ? Math.round(leads.reduce((s, l) => s + getLeadScore(l), 0) / total) : 0;
    const convRate = total > 0 ? Math.round((statusCounts.converted / total) * 100) : 0;
    const replyRate = totalOutreach > 0 ? Math.round((replied / Math.max(leads.filter(l => l.outreach_log.length > 0).length, 1)) * 100) : 0;
    const todayFollowUps = followUps.filter(f => {
      const d = new Date(f.date);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    return { total, withEmail, withPhone, totalOutreach, replied, stale, avgScore, convRate, replyRate, todayFollowUps };
  }, [leads, statusCounts, followUps]);

  // ── Actions ──
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(l => l.id)));
  }, [filtered]);

  function isLeadStale(lead: CRMLead): boolean {
    const age = Date.now() - new Date(lead.created_at).getTime();
    const days = age / 86400000;
    if (lead.outreach_log.length > 0) {
      const lastContact = new Date(lead.outreach_log[0].sent_at).getTime();
      return (Date.now() - lastContact) / 86400000 > LEAD_EXPIRY_DAYS;
    }
    return days > LEAD_EXPIRY_DAYS && lead.status === "new";
  }

  function getDaysUntilExpiry(lead: CRMLead): number | null {
    if (lead.status === "booked" || lead.status === "converted") return null;
    const ref = lead.outreach_log.length > 0 ? new Date(lead.outreach_log[0].sent_at) : new Date(lead.created_at);
    const remaining = Math.ceil(LEAD_EXPIRY_DAYS - (Date.now() - ref.getTime()) / 86400000);
    return remaining > 0 ? remaining : 0;
  }

  async function sendAction(lead: CRMLead, action: "email" | "sms" | "call") {
    if (action === "email" && !lead.email) { toast.error("No email"); return; }
    if ((action === "sms" || action === "call") && !lead.phone) { toast.error("No phone"); return; }
    setActionLoading(`${lead.id}-${action}`);
    try {
      let endpoint: string;
      let body: Record<string, unknown>;
      if (action === "email") {
        endpoint = "/api/outreach/email";
        body = { lead_ids: [lead.id] };
      } else if (action === "sms") {
        endpoint = "/api/twilio/send-sms";
        body = { lead_ids: [lead.id] };
      } else {
        endpoint = "/api/call";
        body = { lead_id: lead.id, phone: lead.phone!, business_name: lead.business_name, industry: lead.industry || "" };
      }
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success && (data.sent ?? 1) > 0) {
        toast.success(`${action === "email" ? "Email sent" : action === "sms" ? "SMS sent" : "Call initiated"}!`);
        fetchLeads();
      } else toast.error(data.error || "Failed to send");
    } catch { toast.error(`Error with ${action}`); }
    setActionLoading(null);
  }

  async function bulkAction(action: "email" | "sms" | "call") {
    const selected = leads.filter(l => selectedIds.has(l.id));
    if (selected.length === 0) { toast.error("No leads selected"); return; }
    const valid = action === "email" ? selected.filter(l => l.email) : selected.filter(l => l.phone);
    if (valid.length === 0) { toast.error(`No selected leads have ${action === "email" ? "email" : "phone"}`); return; }
    if (action === "email" && valid.length > emailCredits) {
      toast.error(`Need ${valid.length} credits, have ${emailCredits}`);
      setShowBuyCredits(true); return;
    }
    toast.loading(`Processing ${valid.length} ${action}s...`);
    let success = 0;
    if (action === "call") {
      // Calls must be sent individually (each is a live call)
      for (const lead of valid) {
        try {
          const res = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lead_id: lead.id, phone: lead.phone!, business_name: lead.business_name, industry: lead.industry || "" }) });
          const data = await res.json();
          if (data.success) success++;
        } catch { /* continue */ }
      }
    } else {
      // Email and SMS endpoints support batch via lead_ids array
      const endpoint = action === "email" ? "/api/outreach/email" : "/api/twilio/send-sms";
      try {
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_ids: valid.map(l => l.id) }) });
        const data = await res.json();
        success = data.sent || 0;
      } catch { /* continue */ }
    }
    toast.dismiss();
    if (action === "email") setEmailCredits(p => p - success);
    toast.success(`${success}/${valid.length} ${action}s completed`);
    setSelectedIds(new Set()); fetchLeads();
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} leads? This cannot be undone.`)) return;
    toast.loading(`Deleting ${selectedIds.size} leads...`);
    try {
      const { error } = await supabase.from("leads").delete().in("id", Array.from(selectedIds));
      toast.dismiss();
      if (error) { toast.error("Delete failed"); return; }
      toast.success(`Deleted ${selectedIds.size} leads`);
      setSelectedIds(new Set()); fetchLeads();
    } catch { toast.dismiss(); toast.error("Delete error"); }
  }

  async function bulkUpdateStatus(newStatus: string) {
    if (selectedIds.size === 0) return;
    toast.loading(`Updating ${selectedIds.size} leads...`);
    try {
      const { error } = await supabase.from("leads").update({ status: newStatus }).in("id", Array.from(selectedIds));
      toast.dismiss();
      if (error) { toast.error("Update failed"); return; }
      toast.success(`Updated ${selectedIds.size} leads to "${newStatus}"`);
      setShowBulkStatusMenu(false); setSelectedIds(new Set()); fetchLeads();
    } catch { toast.dismiss(); toast.error("Update error"); }
  }

  async function updateLeadStatus(leadId: string, newStatus: string) {
    try {
      const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", leadId);
      if (error) { toast.error("Update failed"); return; }
      toast.success(`Status → ${newStatus}`);
      setInlineStatusId(null); fetchLeads();
    } catch { toast.error("Update error"); }
  }

  function addTag(leadId: string, tagId: string) {
    setLeadTags(prev => {
      const tags = prev[leadId] || [];
      if (tags.includes(tagId)) return prev;
      return { ...prev, [leadId]: [...tags, tagId] };
    });
  }

  function removeTag(leadId: string, tagId: string) {
    setLeadTags(prev => ({ ...prev, [leadId]: (prev[leadId] || []).filter(t => t !== tagId) }));
  }

  function addNote(leadId: string) {
    if (!noteInput.trim()) return;
    const note: LeadNote = { id: `n-${Date.now()}`, text: noteInput, created: new Date().toISOString() };
    setLeadNotes(prev => ({ ...prev, [leadId]: [note, ...(prev[leadId] || [])] }));
    setNoteInput("");
    toast.success("Note added");
  }

  function addFollowUp(leadId: string, date: string, note: string) {
    setFollowUps(prev => [...prev, { leadId, date, note }]);
    toast.success("Follow-up scheduled");
  }

  function exportCSV() {
    const rows = filtered.filter(l => selectedIds.size === 0 || selectedIds.has(l.id));
    if (rows.length === 0) { toast.error("No leads to export"); return; }
    const headers = ["Business Name", "Owner", "Phone", "Email", "Industry", "City", "State", "Rating", "Reviews", "Status", "Score", "Tags", "Website"];
    const csv = [
      headers.join(","),
      ...rows.map(l => [
        `"${l.business_name}"`, `"${l.owner_name || ""}"`, `"${l.phone || ""}"`, `"${l.email || ""}"`,
        `"${l.industry || ""}"`, `"${l.city || ""}"`, `"${l.state || ""}"`, l.google_rating || "",
        l.review_count || 0, l.status, getLeadScore(l),
        `"${(leadTags[l.id] || []).join(";")}"`, `"${l.website || ""}"`,
      ].join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `crm-leads-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} leads`);
  }

  function saveSegment() {
    if (!newSegmentName.trim()) return;
    const seg: SavedSegment = { id: `seg-${Date.now()}`, name: newSegmentName, filters: { ...filters } };
    setSavedSegments(prev => [...prev, seg]);
    setNewSegmentName(""); setShowSegmentSave(false);
    toast.success(`Segment "${seg.name}" saved`);
  }

  function loadSegment(seg: SavedSegment) {
    setFilters(seg.filters);
    toast.success(`Loaded "${seg.name}"`);
  }

  // ── Density styles ──
  const dPy = density === "dense" ? "py-1" : density === "compact" ? "py-1.5" : "py-2.5";
  const dText = density === "dense" ? "text-[9px]" : density === "compact" ? "text-[10px]" : "text-[11px]";
  const dGap = density === "dense" ? "gap-1" : density === "compact" ? "gap-1.5" : "gap-2";

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */

  return (
    <div className="fade-in space-y-3">
      {/* ── Stats Dashboard ── */}
      <div className="card p-0 overflow-hidden">
        <button onClick={() => setStatsCollapsed(!statsCollapsed)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-light/50 transition-colors">
          <div className="flex items-center gap-2">
            <BarChart3 size={14} className="text-gold" />
            <span className="text-xs font-bold">CRM Dashboard</span>
            <span className="text-[9px] text-muted">{stats.total} total leads</span>
          </div>
          {statsCollapsed ? <ChevronDown size={14} className="text-muted" /> : <ChevronUp size={14} className="text-muted" />}
        </button>
        {!statsCollapsed && (
          <div className="px-4 pb-4 pt-1">
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
              {[
                { label: "Total Leads", value: stats.total, icon: Users, color: "text-foreground" },
                { label: "Avg Score", value: stats.avgScore, icon: Target, color: "text-gold", suffix: "/100" },
                { label: "Reply Rate", value: `${stats.replyRate}%`, icon: MessageCircle, color: "text-emerald-400" },
                { label: "Conv. Rate", value: `${stats.convRate}%`, icon: TrendingUp, color: "text-purple-400" },
                { label: "Outreach Sent", value: stats.totalOutreach, icon: Send, color: "text-blue-400" },
                { label: "With Email", value: stats.withEmail, icon: Mail, color: "text-amber-400" },
                { label: "With Phone", value: stats.withPhone, icon: Phone, color: "text-emerald-400" },
                { label: "Stale Leads", value: stats.stale, icon: AlertTriangle, color: stats.stale > 0 ? "text-red-400" : "text-muted" },
              ].map((s, i) => (
                <div key={i} className="rounded-lg bg-surface-light/50 px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <s.icon size={10} className={s.color} />
                    <span className="text-[8px] text-muted uppercase tracking-wider">{s.label}</span>
                  </div>
                  <p className={`text-sm font-bold ${s.color}`}>{s.value}<span className="text-[8px] text-muted font-normal">{s.suffix || ""}</span></p>
                </div>
              ))}
            </div>
            {/* Pipeline funnel */}
            <div className="mt-3 flex items-center gap-1">
              {STATUS_TABS.filter(t => t.key !== "all").map((t, i) => {
                const count = statusCounts[t.key] || 0;
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                const colors: Record<string, string> = { new: "#3b82f6", contacted: "#f59e0b", replied: "#10b981", booked: "#a855f7", converted: "#C9A84C" };
                return (
                  <div key={t.key} className="flex-1 group cursor-pointer" onClick={() => setActiveTab(t.key as CRMStatus)}>
                    <div className="h-2 rounded-full transition-all group-hover:h-3" style={{ background: colors[t.key], opacity: count > 0 ? 1 : 0.2 }} />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[8px] text-muted">{t.label}</span>
                      <span className="text-[8px] font-mono" style={{ color: colors[t.key] }}>{count} <span className="text-muted">({pct}%)</span></span>
                    </div>
                    {i < 4 && <ArrowRight size={8} className="text-muted/30 mx-auto mt-0.5 hidden xl:block" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Header Row ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div>
            <h1 className="text-sm font-bold flex items-center gap-2">
              <Users size={16} className="text-gold" /> CRM
            </h1>
            <p className="text-xs text-muted">Track leads, manage contacts, and close deals with AI assistance</p>
          </div>
          {hasActiveFilters && (
            <span className="text-[8px] px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20 flex items-center gap-1">
              <Filter size={8} /> Filtered
              <button onClick={() => setFilters(DEFAULT_FILTERS)} className="hover:text-red-400"><X size={8} /></button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* View mode */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            {([
              { key: "table" as ViewMode, icon: LayoutList, label: "Table" },
              { key: "card" as ViewMode, icon: LayoutGrid, label: "Cards" },
              { key: "pipeline" as ViewMode, icon: Layers, label: "Pipeline" },
            ]).map(v => (
              <button key={v.key} onClick={() => setViewMode(v.key)}
                className={`text-[9px] px-2 py-1.5 flex items-center gap-1 transition-all ${viewMode === v.key ? "bg-gold/10 text-gold" : "text-muted hover:text-foreground"}`}>
                <v.icon size={11} /> {v.label}
              </button>
            ))}
          </div>
          {/* Density */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            {([
              { key: "dense" as Density, icon: AlignJustify, tip: "Dense" },
              { key: "compact" as Density, icon: Grid3X3, tip: "Compact" },
              { key: "comfortable" as Density, icon: Columns3, tip: "Comfortable" },
            ]).map(d => (
              <button key={d.key} onClick={() => setDensity(d.key)} title={d.tip}
                className={`p-1.5 transition-all ${density === d.key ? "bg-gold/10 text-gold" : "text-muted hover:text-foreground"}`}>
                <d.icon size={11} />
              </button>
            ))}
          </div>
          {/* Action buttons */}
          <button onClick={() => setShowFilters(!showFilters)}
            className={`btn-ghost text-[9px] flex items-center gap-1 ${showFilters ? "text-gold" : ""}`}>
            <Filter size={11} /> Filters {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-gold" />}
          </button>
          <button onClick={() => setShowAutomation(true)} className="btn-ghost text-[9px] flex items-center gap-1">
            <Bot size={11} /> Automation
          </button>
          {viewMode === "table" && (
            <button onClick={() => setShowColumnConfig(!showColumnConfig)} className="btn-ghost text-[9px] flex items-center gap-1">
              <Settings2 size={11} /> Columns
            </button>
          )}
          <button onClick={exportCSV} className="btn-ghost text-[9px] flex items-center gap-1"><Download size={11} /> Export</button>
          <label className="btn-ghost text-[9px] flex items-center gap-1 cursor-pointer">
            <Upload size={11} /> Import
            <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              const text = await file.text();
              const lines = text.split("\n").filter(l => l.trim());
              if (lines.length < 2) { toast.error("Empty CSV"); return; }
              const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/["']/g, ""));
              const csvLeads = lines.slice(1).map(line => {
                const vals = line.split(",").map(v => v.trim().replace(/["']/g, ""));
                const obj: Record<string, string> = {};
                headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
                return obj;
              });
              toast.loading(`Importing ${csvLeads.length} leads...`);
              try {
                const res = await fetch("/api/leads/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leads: csvLeads }) });
                toast.dismiss();
                const data = await res.json();
                if (data.success) { toast.success(`Imported ${data.imported} leads`); fetchLeads(); }
                else toast.error(data.error || "Import failed");
              } catch { toast.dismiss(); toast.error("Import error"); }
              e.target.value = "";
            }} />
          </label>
          <button onClick={() => setShowBuyCredits(true)} className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-gold/20 bg-gold/5 hover:bg-gold/10 transition-all">
            <Coins size={11} className="text-gold" />
            <span className="text-[9px] font-medium text-gold">{emailCredits}</span>
          </button>
          <button onClick={fetchLeads} className="btn-ghost text-[9px] flex items-center gap-1"><RefreshCw size={11} /> Refresh</button>
        </div>
      </div>

      {/* ── Saved Segments ── */}
      {savedSegments.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Bookmark size={10} className="text-muted shrink-0" />
          {savedSegments.map(seg => (
            <button key={seg.id} onClick={() => loadSegment(seg)}
              className="text-[8px] px-2 py-1 rounded-full border border-border bg-surface-light hover:border-gold/20 hover:text-gold transition-all whitespace-nowrap flex items-center gap-1">
              {seg.name}
              <span role="button" onClick={(e) => { e.stopPropagation(); setSavedSegments(prev => prev.filter(s => s.id !== seg.id)); }}
                className="hover:text-red-400 cursor-pointer"><X size={7} /></span>
            </button>
          ))}
          <button onClick={() => setShowSegmentSave(true)} className="text-[8px] px-2 py-1 rounded-full border border-dashed border-border text-muted hover:text-gold hover:border-gold/20 transition-all flex items-center gap-1">
            <Plus size={8} /> Save Current
          </button>
        </div>
      )}

      {/* ── Column Config Dropdown ── */}
      {showColumnConfig && (
        <div className="card p-3 flex flex-wrap gap-2">
          <span className="text-[9px] text-muted font-medium w-full">Toggle Columns:</span>
          {columns.filter(c => c.key !== "select" && c.key !== "expand").map(col => (
            <button key={col.key} onClick={() => setColumns(prev => prev.map(c => c.key === col.key ? { ...c, visible: !c.visible } : c))}
              className={`text-[9px] px-2 py-1 rounded-lg border transition-all flex items-center gap-1 ${col.visible ? "border-gold/20 bg-gold/10 text-gold" : "border-border text-muted"}`}>
              {col.visible ? <Eye size={9} /> : <EyeOff size={9} />} {col.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Advanced Filters Panel ── */}
      {showFilters && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-2"><Filter size={12} className="text-gold" /> Advanced Filters</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setFilters(DEFAULT_FILTERS)} className="text-[9px] text-muted hover:text-foreground">Reset All</button>
              <button onClick={() => setShowFilters(false)} className="text-muted hover:text-foreground"><X size={14} /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Industry filter */}
            <div>
              <label className="text-[9px] text-muted uppercase tracking-wider font-semibold block mb-1">Industry</label>
              <div className="space-y-0.5 max-h-28 overflow-y-auto">
                {uniqueIndustries.slice(0, 15).map(ind => (
                  <label key={ind} className="flex items-center gap-1.5 text-[10px] cursor-pointer hover:text-gold transition-colors">
                    <input type="checkbox" checked={filters.industries.includes(ind)}
                      onChange={() => setFilters(prev => ({
                        ...prev,
                        industries: prev.industries.includes(ind) ? prev.industries.filter(i => i !== ind) : [...prev.industries, ind]
                      }))}
                      className="rounded border-border text-gold w-3 h-3" />
                    {ind}
                  </label>
                ))}
              </div>
            </div>
            {/* Location filter */}
            <div>
              <label className="text-[9px] text-muted uppercase tracking-wider font-semibold block mb-1">Location</label>
              <div className="space-y-0.5 max-h-28 overflow-y-auto">
                {uniqueCities.slice(0, 15).map(city => (
                  <label key={city} className="flex items-center gap-1.5 text-[10px] cursor-pointer hover:text-gold transition-colors">
                    <input type="checkbox" checked={filters.cities.includes(city)}
                      onChange={() => setFilters(prev => ({
                        ...prev,
                        cities: prev.cities.includes(city) ? prev.cities.filter(c => c !== city) : [...prev.cities, city]
                      }))}
                      className="rounded border-border text-gold w-3 h-3" />
                    {city}
                  </label>
                ))}
              </div>
            </div>
            {/* Contact info filters */}
            <div className="space-y-2">
              <label className="text-[9px] text-muted uppercase tracking-wider font-semibold block">Contact Info</label>
              {[
                { key: "hasPhone" as const, label: "Has Phone", icon: Phone },
                { key: "hasEmail" as const, label: "Has Email", icon: Mail },
                { key: "hasSocial" as const, label: "Has Social", icon: Camera },
              ].map(f => (
                <div key={f.key} className="flex items-center gap-2">
                  <f.icon size={10} className="text-muted" />
                  <span className="text-[10px] flex-1">{f.label}</span>
                  <div className="flex rounded-lg overflow-hidden border border-border text-[8px]">
                    {[
                      { val: null, label: "Any" },
                      { val: true, label: "Yes" },
                      { val: false, label: "No" },
                    ].map(o => (
                      <button key={String(o.val)} onClick={() => setFilters(prev => ({ ...prev, [f.key]: o.val }))}
                        className={`px-1.5 py-0.5 ${filters[f.key] === o.val ? "bg-gold/10 text-gold" : "text-muted"}`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="pt-1">
                <label className="text-[9px] text-muted uppercase tracking-wider font-semibold block mb-1">Staleness</label>
                <div className="flex rounded-lg overflow-hidden border border-border text-[8px]">
                  {[
                    { val: null, label: "Any" },
                    { val: true, label: "Stale Only" },
                    { val: false, label: "Active Only" },
                  ].map(o => (
                    <button key={String(o.val)} onClick={() => setFilters(prev => ({ ...prev, isStale: o.val }))}
                      className={`px-2 py-1 ${filters.isStale === o.val ? "bg-gold/10 text-gold" : "text-muted"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Score & Rating ranges */}
            <div className="space-y-2">
              <div>
                <label className="text-[9px] text-muted uppercase tracking-wider font-semibold block mb-1">Rating ({filters.ratingMin}–{filters.ratingMax})</label>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={5} step={0.5} value={filters.ratingMin}
                    onChange={e => setFilters(prev => ({ ...prev, ratingMin: parseFloat(e.target.value) }))}
                    className="flex-1 h-1 accent-gold" />
                  <input type="range" min={0} max={5} step={0.5} value={filters.ratingMax}
                    onChange={e => setFilters(prev => ({ ...prev, ratingMax: parseFloat(e.target.value) }))}
                    className="flex-1 h-1 accent-gold" />
                </div>
              </div>
              <div>
                <label className="text-[9px] text-muted uppercase tracking-wider font-semibold block mb-1">Lead Score ({filters.scoreMin}–{filters.scoreMax})</label>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={100} step={5} value={filters.scoreMin}
                    onChange={e => setFilters(prev => ({ ...prev, scoreMin: parseInt(e.target.value) }))}
                    className="flex-1 h-1 accent-gold" />
                  <input type="range" min={0} max={100} step={5} value={filters.scoreMax}
                    onChange={e => setFilters(prev => ({ ...prev, scoreMax: parseInt(e.target.value) }))}
                    className="flex-1 h-1 accent-gold" />
                </div>
              </div>
              <div>
                <label className="text-[9px] text-muted uppercase tracking-wider font-semibold block mb-1">Date Range</label>
                <div className="flex items-center gap-1">
                  <input type="date" value={filters.dateFrom} onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                    className="input text-[9px] px-1.5 py-1 flex-1" />
                  <span className="text-[8px] text-muted">to</span>
                  <input type="date" value={filters.dateTo} onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                    className="input text-[9px] px-1.5 py-1 flex-1" />
                </div>
              </div>
              {/* Tags filter */}
              <div>
                <label className="text-[9px] text-muted uppercase tracking-wider font-semibold block mb-1">Tags</label>
                <div className="flex flex-wrap gap-1">
                  {AVAILABLE_TAGS.map(tag => (
                    <button key={tag.id} onClick={() => setFilters(prev => ({
                      ...prev, tags: prev.tags.includes(tag.id) ? prev.tags.filter(t => t !== tag.id) : [...prev.tags, tag.id]
                    }))}
                      className={`text-[8px] px-1.5 py-0.5 rounded-full border transition-all ${filters.tags.includes(tag.id) ? getTagStyle(tag.color) : "border-border text-muted"}`}>
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Search + Sort ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, industry, city, email, phone..."
            className="input w-full text-[10px] pl-8 py-1.5" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={11} className="text-muted hover:text-foreground" /></button>}
        </div>
        <div className="relative">
          <button onClick={() => setShowSortMenu(!showSortMenu)} className="btn-ghost text-[9px] flex items-center gap-1 py-1.5">
            <ArrowUpDown size={11} /> {sortBy === "newest" ? "Newest" : sortBy === "oldest" ? "Oldest" : sortBy === "rating" ? "Rating" : sortBy === "reviews" ? "Reviews" : sortBy === "score" ? "Score" : sortBy === "name_az" ? "A→Z" : sortBy === "name_za" ? "Z→A" : "Last Contacted"}
            <ChevronDown size={9} />
          </button>
          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-xl z-50 py-1 min-w-[150px]">
              {(["newest", "oldest", "score", "rating", "reviews", "last_contacted", "name_az", "name_za"] as SortKey[]).map(s => (
                <button key={s} onClick={() => { setSortBy(s); setShowSortMenu(false); }}
                  className={`block w-full text-left text-[10px] px-3 py-1.5 hover:bg-surface-light transition-colors ${sortBy === s ? "text-gold" : "text-muted"}`}>
                  {s === "newest" ? "Newest First" : s === "oldest" ? "Oldest First" : s === "score" ? "Highest Score" : s === "rating" ? "Highest Rating" : s === "reviews" ? "Most Reviews" : s === "last_contacted" ? "Last Contacted" : s === "name_az" ? "Name A→Z" : "Name Z→A"}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-[9px] text-muted">{filtered.length} results</span>
      </div>

      {/* ── Status Tabs ── */}
      <div className="tab-group w-fit">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`${activeTab === t.key ? "tab-item-active" : "tab-item-inactive"} flex items-center gap-1`}>
            {t.label}
            <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${activeTab === t.key ? "bg-gold/20 text-gold" : "bg-surface-light text-muted"}`}>
              {statusCounts[t.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* ── Bulk Actions Bar ── */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${selectedIds.size > 0 ? "bg-gold/10 border-gold/15" : "bg-surface-light/20 border-transparent"}`}>
        {selectedIds.size > 0 ? (
          <>
            <span className="text-[9px] text-gold font-medium shrink-0">{selectedIds.size} selected</span>
            <div className="flex items-center gap-1 flex-wrap">
              <button onClick={() => bulkAction("email")} className="text-[8px] px-2 py-1 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-all flex items-center gap-1"><Mail size={9} /> Email All</button>
              <button onClick={() => bulkAction("sms")} className="text-[8px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-1"><MessageSquare size={9} /> SMS All</button>
              <button onClick={() => bulkAction("call")} className="text-[8px] px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all flex items-center gap-1"><PhoneCall size={9} /> Call All</button>
              <div className="relative">
                <button onClick={() => setShowBulkStatusMenu(!showBulkStatusMenu)} className="text-[8px] px-2 py-1 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all flex items-center gap-1">
                  <Tag size={9} /> Mark As <ChevronDown size={7} />
                </button>
                {showBulkStatusMenu && (
                  <div className="absolute left-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-xl z-50 py-1 min-w-[120px]">
                    {["new", "contacted", "replied", "booked", "converted", "not_interested"].map(s => (
                      <button key={s} onClick={() => bulkUpdateStatus(s)}
                        className="block w-full text-left text-[9px] px-3 py-1.5 hover:bg-surface-light transition-colors text-muted hover:text-foreground capitalize">
                        {s.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={bulkDelete} className="text-[8px] px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all flex items-center gap-1"><Trash2 size={9} /> Delete</button>
            </div>
            <button onClick={() => { setSelectedIds(new Set()); setShowBulkStatusMenu(false); }} className="text-[8px] text-muted hover:text-foreground ml-auto"><X size={10} /></button>
          </>
        ) : (
          <span className="text-[9px] text-muted flex items-center gap-1"><Zap size={9} /> Select leads for bulk actions</span>
        )}
      </div>

      {/* ── Main Content (with optional Detail Sidebar) ── */}
      <div className={`flex gap-3 ${detailLeadId ? "" : ""}`}>
        <div className={`flex-1 min-w-0 ${detailLeadId ? "max-w-[calc(100%-360px)]" : ""}`}>

          {/* ══ TABLE VIEW ══ */}
          {viewMode === "table" && (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className={`w-full ${dText}`}>
                  <thead>
                    <tr className="border-b border-border bg-surface-light">
                      {columns.filter(c => c.visible).map(col => {
                        if (col.key === "select") return (
                          <th key={col.key} className={`text-left px-2 ${dPy} ${col.width || ""}`}>
                            <button onClick={toggleSelectAll}>
                              {selectedIds.size === filtered.length && filtered.length > 0
                                ? <CheckSquare size={12} className="text-gold" />
                                : <Square size={12} className="text-muted/40" />}
                            </button>
                          </th>
                        );
                        if (col.key === "expand") return <th key={col.key} className={`${col.width || ""}`} />;
                        return (
                          <th key={col.key} className={`text-left px-2 ${dPy} text-[8px] text-muted uppercase tracking-wider font-semibold`}>
                            {col.label}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 && (
                      <tr><td colSpan={columns.filter(c => c.visible).length} className="text-center py-12 text-muted text-xs">No leads found</td></tr>
                    )}
                    {paginated.map(lead => {
                      const score = getLeadScore(lead);
                      const scoreInfo = getScoreInfo(score);
                      const stale = isLeadStale(lead);
                      const expiry = getDaysUntilExpiry(lead);
                      const tags = leadTags[lead.id] || [];
                      const isExpanded = expandedId === lead.id;
                      const selected = selectedIds.has(lead.id);

                      return (
                        <React.Fragment key={lead.id}>
                          <tr className={`border-b border-border/50 hover:bg-surface-light/30 transition-colors cursor-pointer ${isExpanded ? "bg-surface-light/20" : ""} ${selected ? "bg-gold/5" : ""}`}
                            onClick={() => setDetailLeadId(detailLeadId === lead.id ? null : lead.id)}>
                            {columns.filter(c => c.visible).map(col => {
                              if (col.key === "select") return (
                                <td key={col.key} className={`px-2 ${dPy}`} onClick={e => e.stopPropagation()}>
                                  <button onClick={() => toggleSelect(lead.id)}>
                                    {selected ? <CheckSquare size={12} className="text-gold" /> : <Square size={12} className="text-muted/40" />}
                                  </button>
                                </td>
                              );
                              if (col.key === "name") return (
                                <td key={col.key} className={`px-2 ${dPy}`}>
                                  <p className="font-medium truncate max-w-[180px]">{lead.business_name}</p>
                                  {density !== "dense" && lead.owner_name && <p className="text-[8px] text-muted truncate">{lead.owner_name}</p>}
                                </td>
                              );
                              if (col.key === "contact") return (
                                <td key={col.key} className={`px-2 ${dPy}`} onClick={e => e.stopPropagation()}>
                                  <div className={`flex items-center ${dGap}`}>
                                    {lead.email && <span title={lead.email} className="text-muted hover:text-gold cursor-pointer"><Mail size={11} /></span>}
                                    {lead.phone && <span title={lead.phone} className="text-muted hover:text-emerald-400 cursor-pointer"><Phone size={11} /></span>}
                                    {lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-foreground"><Globe size={11} /></a>}
                                  </div>
                                </td>
                              );
                              if (col.key === "industry") return (
                                <td key={col.key} className={`px-2 ${dPy} text-muted`}>
                                  <span className="truncate max-w-[100px] block">{lead.industry || "—"}</span>
                                </td>
                              );
                              if (col.key === "location") return (
                                <td key={col.key} className={`px-2 ${dPy} text-muted`}>
                                  <span className="truncate max-w-[100px] block">{lead.city ? `${lead.city}${lead.state ? `, ${lead.state}` : ""}` : "—"}</span>
                                </td>
                              );
                              if (col.key === "rating") return (
                                <td key={col.key} className={`px-2 ${dPy}`}>
                                  {lead.google_rating ? (
                                    <span className="flex items-center gap-0.5 text-amber-400">
                                      <Star size={9} className="fill-amber-400" /> {lead.google_rating}
                                      {density !== "dense" && <span className="text-muted text-[8px]">({lead.review_count})</span>}
                                    </span>
                                  ) : <span className="text-muted">—</span>}
                                </td>
                              );
                              if (col.key === "score") return (
                                <td key={col.key} className={`px-2 ${dPy}`}>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-10 h-1.5 rounded-full bg-surface-light overflow-hidden">
                                      <div className="h-full rounded-full" style={{ width: `${score}%`, background: scoreInfo.color }} />
                                    </div>
                                    <span className="text-[8px] font-bold" style={{ color: scoreInfo.color }}>{score}</span>
                                  </div>
                                </td>
                              );
                              if (col.key === "tags") return (
                                <td key={col.key} className={`px-2 ${dPy}`} onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center gap-0.5 flex-wrap">
                                    {tags.slice(0, 2).map(tagId => {
                                      const tag = AVAILABLE_TAGS.find(t => t.id === tagId);
                                      if (!tag) return null;
                                      return <span key={tagId} className={`text-[7px] px-1 py-0.5 rounded-full border ${getTagStyle(tag.color)}`}>{tag.label}</span>;
                                    })}
                                    {tags.length > 2 && <span className="text-[7px] text-muted">+{tags.length - 2}</span>}
                                  </div>
                                </td>
                              );
                              if (col.key === "status") return (
                                <td key={col.key} className={`px-2 ${dPy}`} onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center gap-1 relative">
                                    <button onClick={() => setInlineStatusId(inlineStatusId === lead.id ? null : lead.id)}
                                      className={`text-[8px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[lead.status] || STATUS_COLORS.new} hover:opacity-80 transition-all`}>
                                      {lead.status}
                                    </button>
                                    {stale && <AlertTriangle size={9} className="text-red-400" />}
                                    {!stale && expiry !== null && expiry <= 5 && <span className="text-[7px] text-amber-400">{expiry}d</span>}
                                    {inlineStatusId === lead.id && (
                                      <div className="absolute left-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-xl z-50 py-1 min-w-[110px]">
                                        {["new", "contacted", "replied", "booked", "converted", "not_interested"].map(s => (
                                          <button key={s} onClick={() => updateLeadStatus(lead.id, s)}
                                            className={`block w-full text-left text-[9px] px-3 py-1 hover:bg-surface-light transition-colors capitalize ${lead.status === s ? "text-gold" : "text-muted"}`}>
                                            {s.replace("_", " ")}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                              if (col.key === "last_contact") return (
                                <td key={col.key} className={`px-2 ${dPy}`}>
                                  <span className="text-[9px] text-muted flex items-center gap-1">
                                    <Clock size={8} />
                                    {lead.outreach_log[0] ? formatShortDate(lead.outreach_log[0].sent_at) : "Never"}
                                  </span>
                                </td>
                              );
                              if (col.key === "actions") return (
                                <td key={col.key} className={`px-2 ${dPy}`} onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center gap-0.5">
                                    <button onClick={() => sendAction(lead, "email")} disabled={!lead.email || actionLoading === `${lead.id}-email`}
                                      className="text-[8px] p-1 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 disabled:opacity-30 transition-all" title="Email">
                                      <Mail size={10} />
                                    </button>
                                    <button onClick={() => sendAction(lead, "sms")} disabled={!lead.phone || actionLoading === `${lead.id}-sms`}
                                      className="text-[8px] p-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-30 transition-all" title="SMS">
                                      <MessageSquare size={10} />
                                    </button>
                                    <button onClick={() => sendAction(lead, "call")} disabled={!lead.phone || actionLoading === `${lead.id}-call`}
                                      className="text-[8px] p-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-30 transition-all" title="Call">
                                      <Phone size={10} />
                                    </button>
                                  </div>
                                </td>
                              );
                              if (col.key === "expand") return (
                                <td key={col.key} className={`px-1 ${dPy}`}>
                                  <button onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : lead.id); }}
                                    className="p-1 hover:bg-surface-light rounded transition-colors">
                                    {isExpanded ? <ChevronUp size={11} className="text-muted" /> : <ChevronDown size={11} className="text-muted" />}
                                  </button>
                                </td>
                              );
                              return null;
                            })}
                          </tr>
                          {isExpanded && (
                            <tr className="bg-surface-light/10">
                              <td colSpan={columns.filter(c => c.visible).length} className="px-4 py-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <Send size={10} className="text-gold" />
                                  <span className="text-[9px] font-semibold text-gold">Outreach History</span>
                                  <span className="text-[8px] text-muted">({lead.outreach_log.length} messages)</span>
                                </div>
                                {lead.outreach_log.length === 0 ? (
                                  <p className="text-[9px] text-muted">No outreach yet</p>
                                ) : (
                                  <div className="space-y-1 max-h-36 overflow-y-auto">
                                    {lead.outreach_log.map(e => (
                                      <div key={e.id} className="flex items-start gap-2 text-[9px] py-1 px-2 rounded-lg bg-surface-light">
                                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                          {e.platform === "email" ? <Mail size={10} className="text-gold" /> :
                                           e.platform === "call" ? <Phone size={10} className="text-green-400" /> :
                                           <MessageSquare size={10} className="text-blue-400" />}
                                          <span className={`text-[8px] font-medium ${OUTREACH_STATUS_COLORS[e.status] || "text-muted"}`}>{e.status}</span>
                                        </div>
                                        <p className="flex-1 text-muted truncate">{e.message_text}</p>
                                        {e.reply_text && <p className="text-emerald-400 text-[8px] truncate max-w-[200px]">↩ {e.reply_text}</p>}
                                        <span className="text-[7px] text-muted shrink-0">{formatShortDate(e.sent_at)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ CARD VIEW ══ */}
          {viewMode === "card" && (
            <div className={`grid gap-2 ${density === "dense" ? "grid-cols-1 md:grid-cols-3 xl:grid-cols-4" : density === "compact" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
              {paginated.length === 0 && <div className="col-span-full text-center py-12 text-muted text-xs">No leads found</div>}
              {paginated.map(lead => {
                const score = getLeadScore(lead);
                const scoreInfo = getScoreInfo(score);
                const stale = isLeadStale(lead);
                const tags = leadTags[lead.id] || [];
                return (
                  <div key={lead.id} className={`card ${density === "dense" ? "p-2 space-y-1.5" : "p-3 space-y-2"} hover:border-gold/20 transition-all cursor-pointer ${selectedIds.has(lead.id) ? "border-gold/30 bg-gold/5" : ""}`}
                    onClick={() => setDetailLeadId(detailLeadId === lead.id ? null : lead.id)}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <button onClick={e => { e.stopPropagation(); toggleSelect(lead.id); }}>
                          {selectedIds.has(lead.id) ? <CheckSquare size={12} className="text-gold" /> : <Square size={12} className="text-muted/40" />}
                        </button>
                        <div className="min-w-0">
                          <h3 className={`font-semibold truncate ${density === "dense" ? "text-[10px]" : "text-xs"}`}>{lead.business_name}</h3>
                          <div className="flex items-center gap-1.5 text-[8px] text-muted">
                            {lead.industry && <span>{lead.industry}</span>}
                            {lead.city && <span>· {lead.city}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold ${scoreInfo.bg}`}>{scoreInfo.label}</span>
                        {stale && <AlertTriangle size={9} className="text-red-400" />}
                      </div>
                    </div>
                    {/* Score bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-surface-light">
                        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: scoreInfo.color }} />
                      </div>
                      <span className="text-[8px] font-mono" style={{ color: scoreInfo.color }}>{score}</span>
                    </div>
                    {/* Contact + social */}
                    <div className="flex items-center gap-2 text-[9px] text-muted">
                      {lead.email && <Mail size={9} />}
                      {lead.phone && <Phone size={9} />}
                      {lead.instagram_url && <Camera size={9} className="text-pink-400" />}
                      {lead.facebook_url && <Globe size={9} className="text-blue-400" />}
                      {lead.linkedin_url && <Briefcase size={9} className="text-blue-400" />}
                      {lead.google_rating && <span className="flex items-center gap-0.5 text-amber-400"><Star size={8} className="fill-amber-400" /> {lead.google_rating}</span>}
                      <span className="ml-auto text-[8px]">{lead.outreach_log[0] ? formatShortDate(lead.outreach_log[0].sent_at) : "No outreach"}</span>
                    </div>
                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="flex items-center gap-0.5 flex-wrap">
                        {tags.map(tagId => {
                          const tag = AVAILABLE_TAGS.find(t => t.id === tagId);
                          if (!tag) return null;
                          return <span key={tagId} className={`text-[7px] px-1 py-0.5 rounded-full border ${getTagStyle(tag.color)}`}>{tag.label}</span>;
                        })}
                      </div>
                    )}
                    {/* Status + actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <span className={`text-[8px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[lead.status] || STATUS_COLORS.new}`}>{lead.status}</span>
                      <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                        <button onClick={() => sendAction(lead, "email")} disabled={!lead.email} className="p-1 rounded bg-gold/10 text-gold hover:bg-gold/20 disabled:opacity-30"><Mail size={9} /></button>
                        <button onClick={() => sendAction(lead, "sms")} disabled={!lead.phone} className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-30"><MessageSquare size={9} /></button>
                        <button onClick={() => sendAction(lead, "call")} disabled={!lead.phone} className="p-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-30"><Phone size={9} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ PIPELINE VIEW ══ */}
          {viewMode === "pipeline" && (
            <div className="flex gap-2 overflow-x-auto pb-4" style={{ minHeight: "500px" }}>
              {STATUS_TABS.filter(t => t.key !== "all").map(stage => {
                const stageLeads = searchFiltered.filter(l => mapToCRMStatus(l.status) === stage.key);
                const colors: Record<string, string> = { new: "#3b82f6", contacted: "#f59e0b", replied: "#10b981", booked: "#a855f7", converted: "#C9A84C" };
                const color = colors[stage.key] || "#6b7280";
                return (
                  <div key={stage.key} className="flex-shrink-0 w-[260px]">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{stage.label}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md font-mono" style={{ background: `${color}15`, color }}>{stageLeads.length}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                      {stageLeads.length === 0 && (
                        <div className="text-center py-8 border border-dashed rounded-lg" style={{ borderColor: `${color}20` }}>
                          <p className="text-[9px] text-muted">No leads</p>
                        </div>
                      )}
                      {stageLeads.map(lead => {
                        const score = getLeadScore(lead);
                        const scoreInfo = getScoreInfo(score);
                        const tags = leadTags[lead.id] || [];
                        return (
                          <div key={lead.id}
                            className="rounded-lg p-2.5 space-y-1.5 cursor-pointer bg-surface-light border border-border hover:border-gold/20 transition-all"
                            onClick={() => setDetailLeadId(detailLeadId === lead.id ? null : lead.id)}>
                            <div className="flex items-start justify-between">
                              <div className="min-w-0">
                                <h4 className="text-[10px] font-bold truncate">{lead.business_name}</h4>
                                <p className="text-[8px] text-muted truncate">{lead.industry || "Business"} {lead.city ? `· ${lead.city}` : ""}</p>
                              </div>
                              <span className="text-[7px] px-1.5 py-0.5 rounded font-bold shrink-0" style={{ background: `${scoreInfo.color}15`, color: scoreInfo.color }}>{scoreInfo.label}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[8px] text-muted">
                              {lead.email && <Mail size={8} />} {lead.phone && <Phone size={8} />}
                              {lead.google_rating && <span className="flex items-center gap-0.5 text-amber-400"><Star size={7} className="fill-amber-400" /> {lead.google_rating}</span>}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 h-1 rounded-full bg-border"><div className="h-1 rounded-full" style={{ width: `${score}%`, background: scoreInfo.color }} /></div>
                              <span className="text-[7px] font-mono" style={{ color: scoreInfo.color }}>{score}</span>
                            </div>
                            {tags.length > 0 && (
                              <div className="flex gap-0.5 flex-wrap">
                                {tags.slice(0, 2).map(tagId => {
                                  const tag = AVAILABLE_TAGS.find(t => t.id === tagId);
                                  return tag ? <span key={tagId} className={`text-[6px] px-1 py-0.5 rounded-full border ${getTagStyle(tag.color)}`}>{tag.label}</span> : null;
                                })}
                              </div>
                            )}
                            <div className="flex items-center justify-between text-[7px] text-muted">
                              <span>{lead.outreach_log[0] ? formatShortDate(lead.outreach_log[0].sent_at) : "No outreach"}</span>
                              <span>{lead.outreach_log.length} msgs</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Pagination ── */}
          {totalPages > 1 && viewMode !== "pipeline" && (
            <div className="flex items-center justify-between px-1 mt-2">
              <span className="text-[9px] text-muted">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(0)} disabled={page === 0} className="text-[9px] px-2 py-1 rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-30">First</button>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="text-[9px] px-2 py-1 rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-30">Prev</button>
                <span className="text-[9px] text-muted px-2">{page + 1}/{totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="text-[9px] px-2 py-1 rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-30">Next</button>
                <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="text-[9px] px-2 py-1 rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-30">Last</button>
              </div>
            </div>
          )}
        </div>

        {/* ══ DETAIL SIDEBAR ══ */}
        {detailLead && (
          <div ref={detailPanelRef} className="w-[350px] shrink-0 card p-0 overflow-hidden sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto hidden xl:block">
            <div className="px-4 py-3 border-b border-border bg-surface-light/50 flex items-center justify-between">
              <h3 className="text-xs font-bold truncate">{detailLead.business_name}</h3>
              <button onClick={() => setDetailLeadId(null)} className="text-muted hover:text-foreground"><X size={14} /></button>
            </div>
            <div className="p-4 space-y-4">
              {/* Score */}
              {(() => { const s = getLeadScore(detailLead); const si = getScoreInfo(s); return (
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-surface-light" />
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke={si.color} strokeWidth="3"
                        strokeDasharray={`${s * 0.975} 100`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color: si.color }}>{s}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold" style={{ color: si.color }}>{si.label} LEAD</span>
                    <p className="text-[8px] text-muted">Score based on data completeness & engagement</p>
                  </div>
                </div>
              ); })()}
              {/* Contact info */}
              <div className="space-y-1.5">
                <span className="text-[8px] text-muted uppercase tracking-wider font-semibold">Contact</span>
                {detailLead.owner_name && <p className="text-[10px] flex items-center gap-1.5"><Users size={10} className="text-muted" /> {detailLead.owner_name}</p>}
                {detailLead.email && <p className="text-[10px] flex items-center gap-1.5"><Mail size={10} className="text-muted" /> {detailLead.email}</p>}
                {detailLead.phone && <p className="text-[10px] flex items-center gap-1.5"><Phone size={10} className="text-muted" /> {detailLead.phone}</p>}
                {detailLead.website && <a href={detailLead.website} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center gap-1.5 text-gold hover:underline"><Globe size={10} /> {detailLead.website}</a>}
                <div className="flex items-center gap-2 pt-1">
                  {detailLead.instagram_url && <a href={detailLead.instagram_url} target="_blank" rel="noopener noreferrer"><Camera size={14} className="text-pink-400 hover:scale-110 transition-transform" /></a>}
                  {detailLead.facebook_url && <a href={detailLead.facebook_url} target="_blank" rel="noopener noreferrer"><Globe size={14} className="text-blue-400 hover:scale-110 transition-transform" /></a>}
                  {detailLead.linkedin_url && <a href={detailLead.linkedin_url} target="_blank" rel="noopener noreferrer"><Briefcase size={14} className="text-blue-400 hover:scale-110 transition-transform" /></a>}
                  {detailLead.tiktok_url && <a href={detailLead.tiktok_url} target="_blank" rel="noopener noreferrer"><Music size={14} className="text-foreground hover:scale-110 transition-transform" /></a>}
                </div>
              </div>
              {/* Quick actions */}
              <div className="flex items-center gap-1">
                <button onClick={() => sendAction(detailLead, "email")} disabled={!detailLead.email}
                  className="flex-1 text-[9px] py-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 disabled:opacity-30 flex items-center justify-center gap-1"><Mail size={10} /> Email</button>
                <button onClick={() => sendAction(detailLead, "sms")} disabled={!detailLead.phone}
                  className="flex-1 text-[9px] py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-30 flex items-center justify-center gap-1"><MessageSquare size={10} /> SMS</button>
                <button onClick={() => sendAction(detailLead, "call")} disabled={!detailLead.phone}
                  className="flex-1 text-[9px] py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-30 flex items-center justify-center gap-1"><Phone size={10} /> Call</button>
              </div>
              {/* Tags */}
              <div>
                <span className="text-[8px] text-muted uppercase tracking-wider font-semibold block mb-1">Tags</span>
                <div className="flex flex-wrap gap-1">
                  {(leadTags[detailLead.id] || []).map(tagId => {
                    const tag = AVAILABLE_TAGS.find(t => t.id === tagId);
                    if (!tag) return null;
                    return (
                      <span key={tagId} className={`text-[8px] px-1.5 py-0.5 rounded-full border ${getTagStyle(tag.color)} flex items-center gap-0.5`}>
                        {tag.label}
                        <button onClick={() => removeTag(detailLead.id, tagId)} className="hover:text-red-400"><X size={7} /></button>
                      </span>
                    );
                  })}
                  {AVAILABLE_TAGS.filter(t => !(leadTags[detailLead.id] || []).includes(t.id)).slice(0, 4).map(tag => (
                    <button key={tag.id} onClick={() => addTag(detailLead.id, tag.id)}
                      className="text-[8px] px-1.5 py-0.5 rounded-full border border-dashed border-border text-muted hover:text-gold hover:border-gold/20 transition-all">
                      + {tag.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Notes */}
              <div>
                <span className="text-[8px] text-muted uppercase tracking-wider font-semibold block mb-1">Notes</span>
                <div className="flex gap-1 mb-2">
                  <input value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder="Add a note..."
                    className="input text-[9px] px-2 py-1 flex-1" onKeyDown={e => { if (e.key === "Enter") addNote(detailLead.id); }} />
                  <button onClick={() => addNote(detailLead.id)} className="text-[9px] px-2 py-1 rounded-lg bg-gold/10 text-gold hover:bg-gold/20"><Plus size={10} /></button>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {(leadNotes[detailLead.id] || []).map(note => (
                    <div key={note.id} className="text-[9px] p-1.5 rounded bg-surface-light">
                      <p>{note.text}</p>
                      <span className="text-[7px] text-muted">{formatShortDate(note.created)}</span>
                    </div>
                  ))}
                  {(leadNotes[detailLead.id] || []).length === 0 && <p className="text-[8px] text-muted">No notes yet</p>}
                </div>
              </div>
              {/* Follow-up scheduler */}
              <div>
                <span className="text-[8px] text-muted uppercase tracking-wider font-semibold block mb-1">Schedule Follow-up</span>
                <div className="flex gap-1">
                  <input type="datetime-local" id="followup-date" className="input text-[9px] px-2 py-1 flex-1" />
                  <button onClick={() => {
                    const el = document.getElementById("followup-date") as HTMLInputElement;
                    if (el?.value) { addFollowUp(detailLead.id, el.value, "Follow up"); el.value = ""; }
                  }} className="text-[9px] px-2 py-1 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20">
                    <CalendarClock size={10} />
                  </button>
                </div>
                {followUps.filter(f => f.leadId === detailLead.id).length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {followUps.filter(f => f.leadId === detailLead.id).map((f, i) => (
                      <div key={i} className="text-[8px] text-muted flex items-center gap-1">
                        <Bell size={8} className="text-purple-400" /> {new Date(f.date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Outreach timeline */}
              <div>
                <span className="text-[8px] text-muted uppercase tracking-wider font-semibold block mb-1">Outreach Timeline</span>
                {detailLead.outreach_log.length === 0 ? (
                  <p className="text-[8px] text-muted">No outreach yet</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {detailLead.outreach_log.map(e => (
                      <div key={e.id} className="flex items-start gap-2 text-[9px] py-1.5 px-2 rounded-lg bg-surface-light">
                        {e.platform === "email" ? <Mail size={10} className="text-gold shrink-0 mt-0.5" /> :
                         e.platform === "call" ? <Phone size={10} className="text-green-400 shrink-0 mt-0.5" /> :
                         <MessageSquare size={10} className="text-blue-400 shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className={`text-[8px] font-medium ${OUTREACH_STATUS_COLORS[e.status] || "text-muted"}`}>{e.status}</span>
                            <span className="text-[7px] text-muted">{formatShortDate(e.sent_at)}</span>
                          </div>
                          <p className="text-muted truncate">{e.message_text}</p>
                          {e.reply_text && <p className="text-emerald-400 text-[8px] mt-0.5">↩ {e.reply_text}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ AUTOMATION MODAL ══ */}
      {showAutomation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowAutomation(false)}>
          <div className="bg-surface border border-border rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2"><Bot size={16} className="text-gold" /> Automation Rules</h3>
                <p className="text-[10px] text-muted mt-0.5">Auto-fire SMS, emails, and calls based on lead events</p>
              </div>
              <button onClick={() => setShowAutomation(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-3">
              {automations.map(rule => {
                const triggerLabels: Record<string, string> = {
                  new_lead: "When new lead arrives", no_reply_2d: "No reply after 2 days",
                  no_reply_5d: "No reply after 5 days", after_reply: "When lead replies",
                  after_booking: "When lead books",
                };
                const actionLabels: Record<string, { label: string; icon: typeof Mail; color: string }> = {
                  send_sms: { label: "Send SMS", icon: MessageSquare, color: "text-emerald-400" },
                  send_email: { label: "Send Email", icon: Mail, color: "text-gold" },
                  ai_call: { label: "AI Cold Call", icon: PhoneCall, color: "text-blue-400" },
                  update_status: { label: "Update Status", icon: Tag, color: "text-purple-400" },
                  add_tag: { label: "Add Tag", icon: Hash, color: "text-pink-400" },
                  notify: { label: "Notify Team", icon: Bell, color: "text-amber-400" },
                };
                const action = actionLabels[rule.action];
                const ActionIcon = action.icon;
                return (
                  <div key={rule.id} className={`rounded-xl border p-4 transition-all ${rule.enabled ? "border-gold/20 bg-gold/5" : "border-border bg-surface-light/50 opacity-60"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ActionIcon size={14} className={action.color} />
                        <span className="text-xs font-semibold">{rule.name}</span>
                      </div>
                      <button onClick={() => setAutomations(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))}
                        className={`w-8 h-4 rounded-full transition-all relative ${rule.enabled ? "bg-gold" : "bg-surface-light"}`}>
                        <div className={`absolute w-3 h-3 rounded-full bg-white top-0.5 transition-all ${rule.enabled ? "left-4.5" : "left-0.5"}`}
                          style={{ left: rule.enabled ? "18px" : "2px" }} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted">
                      <span className="flex items-center gap-1"><Timer size={10} /> {triggerLabels[rule.trigger]}</span>
                      <ArrowRight size={10} />
                      <span className={`flex items-center gap-1 ${action.color}`}>{action.label}</span>
                    </div>
                    {rule.message && (
                      <p className="text-[9px] text-muted mt-2 p-2 rounded-lg bg-surface-light/50 border border-border/50 italic">
                        &ldquo;{rule.message}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-border bg-surface-light/30 flex items-center justify-between">
              <span className="text-[9px] text-muted">{automations.filter(r => r.enabled).length}/{automations.length} rules active</span>
              <button onClick={() => { toast.success("Automation settings saved"); setShowAutomation(false); }}
                className="text-[10px] px-4 py-1.5 rounded-lg bg-gold text-black font-medium hover:bg-gold-light transition-all">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ BUY CREDITS MODAL ══ */}
      {showBuyCredits && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowBuyCredits(false)}>
          <div className="bg-surface border border-border rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2"><Coins size={16} className="text-gold" /> Buy Email Credits</h3>
                <p className="text-[10px] text-muted mt-0.5">Balance: {emailCredits} credits</p>
              </div>
              <button onClick={() => setShowBuyCredits(false)}><X size={16} className="text-muted hover:text-foreground" /></button>
            </div>
            <div className="grid gap-3">
              {[
                { amount: 500, price: "$29", per: "$0.058" },
                { amount: 2000, price: "$79", per: "$0.040", popular: true },
                { amount: 10000, price: "$199", per: "$0.020" },
              ].map(tier => (
                <button key={tier.amount} onClick={() => { setEmailCredits(p => p + tier.amount); setShowBuyCredits(false); toast.success(`Added ${tier.amount} credits`); }}
                  className={`relative flex items-center justify-between p-4 rounded-xl border transition-all hover:scale-[1.02] ${tier.popular ? "border-gold/30 bg-gold/5" : "border-border bg-surface-light hover:border-gold/20"}`}>
                  {tier.popular && <span className="absolute -top-2 left-4 text-[8px] px-2 py-0.5 rounded-full bg-gold text-black font-bold">BEST VALUE</span>}
                  <div className="text-left">
                    <span className="text-sm font-bold">{tier.amount.toLocaleString()}</span> <span className="text-[10px] text-muted">credits</span>
                    <p className="text-[9px] text-muted">{tier.per}/email</p>
                  </div>
                  <span className="text-lg font-bold text-gold">{tier.price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ SAVE SEGMENT MODAL ══ */}
      {showSegmentSave && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowSegmentSave(false)}>
          <div className="bg-surface border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Bookmark size={14} className="text-gold" /> Save Segment</h3>
            <input value={newSegmentName} onChange={e => setNewSegmentName(e.target.value)} placeholder="Segment name..."
              className="input w-full text-xs px-3 py-2 mb-3" onKeyDown={e => { if (e.key === "Enter") saveSegment(); }} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSegmentSave(false)} className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted">Cancel</button>
              <button onClick={saveSegment} className="text-[10px] px-4 py-1.5 rounded-lg bg-gold text-black font-medium">Save</button>
            </div>
          </div>
        </div>
      )}

      <PageAI pageName="CRM"
        context={`${leads.length} total leads. ${stats.stale} stale. Avg score: ${stats.avgScore}. Reply rate: ${stats.replyRate}%. Conv rate: ${stats.convRate}%.`}
        suggestions={[
          "Draft follow-up emails for leads who haven't replied",
          "Which leads should I prioritize today?",
          "Write a cold DM for a dental practice",
          "Analyze my conversion rate and suggest improvements",
        ]}
      />
    </div>
  );
}

// Need React import for React.Fragment in table rows
import React from "react";
