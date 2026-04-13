"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Search, ChevronDown, Mail, Phone, MessageSquare,
  ExternalLink, Star, Download, LayoutGrid, LayoutList,
  CheckSquare, Square, Filter, ArrowUpDown, Clock, MapPin,
  Briefcase, Globe, Camera, Music, Send, Users, ChevronUp,
  X, RefreshCw, Upload
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";

type CRMStatus = "new" | "contacted" | "replied" | "booked" | "converted";

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

type SortKey = "newest" | "rating" | "reviews" | "last_contacted";
type ViewMode = "table" | "card" | "pipeline";

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
  sent: "text-blue-400",
  delivered: "text-blue-400",
  replied: "text-emerald-400",
  no_reply: "text-muted",
  bounced: "text-red-400",
  failed: "text-red-400",
  pending: "text-amber-400",
};

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
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const PAGE_SIZE = 50;

export default function CRMPage() {
  useAuth();
  const supabase = createClient();

  const [leads, setLeads] = useState<CRMLead[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<CRMStatus | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchLeads(); cleanupStaleLeads(); }, []);

  async function fetchLeads() {
    try {
      setLoading(true);
      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, business_name, owner_name, phone, email, website, city, state, industry, google_rating, review_count, instagram_url, facebook_url, linkedin_url, tiktok_url, status, created_at")
        .order("created_at", { ascending: false })
        .limit(2000);

      if (!leadsData || leadsData.length === 0) {
        setLeads([]);
        return;
      }

      const leadIds = leadsData.map(l => l.id);
      const { data: outreachData } = await supabase
        .from("outreach_log")
        .select("id, lead_id, platform, message_text, status, reply_text, sent_at, replied_at")
        .in("lead_id", leadIds)
        .order("sent_at", { ascending: false });

      const outreachByLead: Record<string, OutreachLogEntry[]> = {};
      (outreachData || []).forEach(o => {
        const lid = (o as { lead_id: string }).lead_id;
        if (!outreachByLead[lid]) outreachByLead[lid] = [];
        outreachByLead[lid].push(o as OutreachLogEntry);
      });

      const merged: CRMLead[] = leadsData.map(l => ({
        ...l,
        review_count: l.review_count || 0,
        outreach_log: outreachByLead[l.id] || [],
      }));

      setLeads(merged);
    } catch (err) {
      console.error("[CRM] fetchLeads error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function cleanupStaleLeads() {
    try {
      const res = await fetch("/api/leads/cleanup", { method: "POST" });
      const data = await res.json();
      if (data.success && data.deleted > 0) {
        toast.success(`Cleaned up ${data.deleted} stale leads (uncontacted 2+ days)`);
        fetchLeads();
      }
    } catch { /* silent */ }
  }

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [activeTab, search, sortBy]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length, new: 0, contacted: 0, replied: 0, booked: 0, converted: 0 };
    leads.forEach(l => {
      const s = mapToCRMStatus(l.status);
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads;

    if (activeTab !== "all") {
      result = result.filter(l => mapToCRMStatus(l.status) === activeTab);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.business_name.toLowerCase().includes(q) ||
        (l.industry && l.industry.toLowerCase().includes(q)) ||
        (l.city && l.city.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.owner_name && l.owner_name.toLowerCase().includes(q))
      );
    }

    result = [...result].sort((a, b) => {
      if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "rating") return (b.google_rating || 0) - (a.google_rating || 0);
      if (sortBy === "reviews") return (b.review_count || 0) - (a.review_count || 0);
      if (sortBy === "last_contacted") {
        const aLast = a.outreach_log[0]?.sent_at || "1970-01-01";
        const bLast = b.outreach_log[0]?.sent_at || "1970-01-01";
        return new Date(bLast).getTime() - new Date(aLast).getTime();
      }
      return 0;
    });

    return result;
  }, [leads, activeTab, search, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(l => l.id)));
    }
  }, [filtered, selectedIds.size]);

  async function sendEmail(lead: CRMLead) {
    if (!lead.email) { toast.error("No email for this lead"); return; }
    setActionLoading(lead.id + "-email");
    try {
      const res = await fetch("/api/outreach/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id, email: lead.email, business_name: lead.business_name }),
      });
      const data = await res.json();
      if (data.success) { toast.success("Email sent!"); fetchLeads(); }
      else toast.error(data.error || "Failed to send email");
    } catch { toast.error("Error sending email"); }
    setActionLoading(null);
  }

  async function sendSMS(lead: CRMLead) {
    if (!lead.phone) { toast.error("No phone for this lead"); return; }
    setActionLoading(lead.id + "-sms");
    try {
      const res = await fetch("/api/messaging/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id, phone: lead.phone, business_name: lead.business_name }),
      });
      const data = await res.json();
      if (data.success) { toast.success("SMS sent!"); fetchLeads(); }
      else toast.error(data.error || "Failed to send SMS");
    } catch { toast.error("Error sending SMS"); }
    setActionLoading(null);
  }

  async function callLead(lead: CRMLead) {
    if (!lead.phone) { toast.error("No phone for this lead"); return; }
    setActionLoading(lead.id + "-call");
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id, phone: lead.phone, business_name: lead.business_name, industry: lead.industry }),
      });
      const data = await res.json();
      if (data.success) { toast.success("AI call initiated!"); fetchLeads(); }
      else toast.error(data.error || "Failed to initiate call");
    } catch { toast.error("Error initiating call"); }
    setActionLoading(null);
  }

  async function bulkAction(action: "email" | "sms") {
    const selected = leads.filter(l => selectedIds.has(l.id));
    if (selected.length === 0) { toast.error("No leads selected"); return; }
    const endpoint = action === "email" ? "/api/outreach/email" : "/api/messaging/send";
    const field = action === "email" ? "email" : "phone";
    const valid = selected.filter(l => l[field]);
    if (valid.length === 0) { toast.error(`No selected leads have ${field}`); return; }

    toast.loading(`Sending ${action} to ${valid.length} leads...`);
    let success = 0;
    for (const lead of valid) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_id: lead.id, [field]: lead[field], business_name: lead.business_name }),
        });
        const data = await res.json();
        if (data.success) success++;
      } catch { /* continue */ }
    }
    toast.dismiss();
    toast.success(`${success}/${valid.length} ${action}s sent`);
    setSelectedIds(new Set());
    fetchLeads();
  }

  function exportCSV() {
    const rows = filtered.filter(l => selectedIds.size === 0 || selectedIds.has(l.id));
    if (rows.length === 0) { toast.error("No leads to export"); return; }
    const headers = ["Business Name", "Owner", "Phone", "Email", "Industry", "City", "State", "Rating", "Reviews", "Status", "Website", "Instagram", "Facebook", "LinkedIn", "TikTok", "Last Contacted"];
    const csv = [
      headers.join(","),
      ...rows.map(l => [
        `"${l.business_name}"`,
        `"${l.owner_name || ""}"`,
        `"${l.phone || ""}"`,
        `"${l.email || ""}"`,
        `"${l.industry || ""}"`,
        `"${l.city || ""}"`,
        `"${l.state || ""}"`,
        l.google_rating || "",
        l.review_count || 0,
        l.status,
        `"${l.website || ""}"`,
        `"${l.instagram_url || ""}"`,
        `"${l.facebook_url || ""}"`,
        `"${l.linkedin_url || ""}"`,
        `"${l.tiktok_url || ""}"`,
        l.outreach_log[0]?.sent_at || "",
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm-leads-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} leads`);
  }

  const SocialIcon = ({ url, type }: { url: string | null; type: string }) => {
    if (!url) return null;
    const icons: Record<string, React.ReactNode> = {
      instagram: <Camera size={13} className="text-pink-400" />,
      facebook: <Globe size={13} className="text-blue-400" />,
      linkedin: <Briefcase size={13} className="text-blue-400" />,
      tiktok: <Music size={13} className="text-foreground" />,
    };
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform" title={type}>
        {icons[type] || <ExternalLink size={13} />}
      </a>
    );
  };

  const LeadActions = ({ lead }: { lead: CRMLead }) => (
    <div className="flex items-center gap-1">
      <button onClick={() => sendEmail(lead)} disabled={!lead.email || actionLoading === lead.id + "-email"}
        className="text-[9px] px-2 py-1 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-all disabled:opacity-30 flex items-center gap-1"
        title={lead.email || "No email"}>
        <Mail size={10} /> Email
      </button>
      <button onClick={() => sendSMS(lead)} disabled={!lead.phone || actionLoading === lead.id + "-sms"}
        className="text-[9px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-30 flex items-center gap-1"
        title={lead.phone || "No phone"}>
        <MessageSquare size={10} /> SMS
      </button>
      <button onClick={() => callLead(lead)} disabled={!lead.phone || actionLoading === lead.id + "-call"}
        className="text-[9px] px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-30 flex items-center gap-1"
        title={lead.phone || "No phone"}>
        <Phone size={10} /> Call
      </button>
    </div>
  );

  const OutreachHistory = ({ entries }: { entries: OutreachLogEntry[] }) => {
    if (entries.length === 0) return <p className="text-[10px] text-muted py-2">No outreach yet</p>;
    return (
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {entries.map(e => (
          <div key={e.id} className="flex items-start gap-2 text-[10px] py-1.5 px-2 rounded-lg bg-surface-light">
            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
              {e.platform === "email" ? <Mail size={11} className="text-gold" /> :
               e.platform === "call" ? <Phone size={11} className="text-green-400" /> :
               e.platform === "instagram" ? <Camera size={11} className="text-pink-400" /> :
               e.platform === "linkedin" ? <Briefcase size={11} className="text-blue-400" /> :
               e.platform === "tiktok" ? <Music size={11} className="text-foreground" /> :
               <MessageSquare size={11} className="text-blue-400" />}
              <span className={`text-[9px] font-medium ${OUTREACH_STATUS_COLORS[e.status] || "text-muted"}`}>
                {e.status}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-muted truncate">{e.message_text}</p>
              {e.reply_text && (
                <p className="text-emerald-400 mt-0.5 truncate">Reply: {e.reply_text}</p>
              )}
            </div>
            <span className="text-[8px] text-muted shrink-0">{formatShortDate(e.sent_at)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Users size={18} className="text-gold" /> CRM / Outreach
          </h1>
          <p className="text-xs text-muted mt-0.5">{leads.length} leads &middot; Manage outreach, track replies, close deals</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-border">
            {([
              { key: "table" as ViewMode, icon: <LayoutList size={12} />, label: "Table" },
              { key: "card" as ViewMode, icon: <LayoutGrid size={12} />, label: "Cards" },
              { key: "pipeline" as ViewMode, icon: <ArrowUpDown size={12} />, label: "Pipeline" },
            ]).map(v => (
              <button key={v.key} onClick={() => setViewMode(v.key)}
                className={`text-[10px] px-2.5 py-1.5 flex items-center gap-1 transition-all ${
                  viewMode === v.key ? "bg-gold/10 text-gold" : "text-muted hover:text-foreground"
                }`}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} className="btn-ghost text-[10px] flex items-center gap-1">
            <Download size={12} /> Export
          </button>
          <label className="btn-ghost text-[10px] flex items-center gap-1 cursor-pointer">
            <Upload size={12} /> Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const lines = text.split("\n").filter(l => l.trim());
              if (lines.length < 2) { toast.error("Empty CSV"); return; }
              const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/["']/g, ""));
              const leads = lines.slice(1).map(line => {
                const vals = line.split(",").map(v => v.trim().replace(/["']/g, ""));
                const obj: Record<string, string> = {};
                headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
                return obj;
              });
              toast.loading(`Importing ${leads.length} leads...`);
              try {
                const res = await fetch("/api/leads/import", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ leads }),
                });
                toast.dismiss();
                const data = await res.json();
                if (data.success) {
                  toast.success(`Imported ${data.imported} leads (${data.skipped} skipped)`);
                  fetchLeads();
                } else toast.error(data.error || "Import failed");
              } catch { toast.dismiss(); toast.error("Import error"); }
              e.target.value = "";
            }} />
          </label>
          <button onClick={fetchLeads} className="btn-ghost text-[10px] flex items-center gap-1">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, industry, city, email..."
            className="input w-full text-xs pl-9 py-2" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={12} className="text-muted hover:text-foreground" />
            </button>
          )}
        </div>
        <div className="relative">
          <button onClick={() => setShowSortMenu(!showSortMenu)} className="btn-ghost text-[10px] flex items-center gap-1 py-2">
            <ArrowUpDown size={12} /> Sort: {sortBy === "newest" ? "Newest" : sortBy === "rating" ? "Rating" : sortBy === "reviews" ? "Reviews" : "Last Contacted"}
            <ChevronDown size={10} />
          </button>
          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-xl z-50 py-1 min-w-[140px]">
              {(["newest", "rating", "reviews", "last_contacted"] as SortKey[]).map(s => (
                <button key={s} onClick={() => { setSortBy(s); setShowSortMenu(false); }}
                  className={`block w-full text-left text-[10px] px-3 py-1.5 hover:bg-surface-light transition-colors ${sortBy === s ? "text-gold" : "text-muted"}`}>
                  {s === "newest" ? "Newest First" : s === "rating" ? "Highest Rating" : s === "reviews" ? "Most Reviews" : "Last Contacted"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="tab-group w-fit">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`${activeTab === t.key ? "tab-item-active" : "tab-item-inactive"} flex items-center gap-1.5`}>
            {t.label}
            <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${activeTab === t.key ? "bg-gold/20 text-gold" : "bg-surface-light text-muted"}`}>
              {statusCounts[t.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gold/10 border border-gold/15">
          <span className="text-[10px] text-gold font-medium">{selectedIds.size} selected</span>
          <button onClick={() => bulkAction("email")} className="text-[9px] px-2 py-1 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-all flex items-center gap-1">
            <Mail size={10} /> Bulk Email
          </button>
          <button onClick={() => bulkAction("sms")} className="text-[9px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-1">
            <MessageSquare size={10} /> Bulk SMS
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-[9px] text-muted hover:text-foreground ml-auto flex items-center gap-1">
            <X size={10} /> Clear
          </button>
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border bg-surface-light">
                  <th className="text-left px-3 py-2.5 w-8">
                    <button onClick={toggleSelectAll}>
                      {selectedIds.size === filtered.length && filtered.length > 0
                        ? <CheckSquare size={13} className="text-gold" />
                        : <Square size={13} className="text-muted/40" />}
                    </button>
                  </th>
                  <th className="text-left px-3 py-2.5 text-[9px] text-muted uppercase tracking-wider font-semibold">Name</th>
                  <th className="text-left px-3 py-2.5 text-[9px] text-muted uppercase tracking-wider font-semibold">Contact</th>
                  <th className="text-left px-3 py-2.5 text-[9px] text-muted uppercase tracking-wider font-semibold">Socials</th>
                  <th className="text-left px-3 py-2.5 text-[9px] text-muted uppercase tracking-wider font-semibold">Status</th>
                  <th className="text-left px-3 py-2.5 text-[9px] text-muted uppercase tracking-wider font-semibold">Last Contact</th>
                  <th className="text-left px-3 py-2.5 text-[9px] text-muted uppercase tracking-wider font-semibold">Actions</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-muted text-xs">No leads found</td></tr>
                )}
                {paginated.map(lead => (
                  <LeadTableRow key={lead.id} lead={lead} expanded={expandedId === lead.id}
                    selected={selectedIds.has(lead.id)}
                    onToggleExpand={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                    onToggleSelect={() => toggleSelect(lead.id)}
                    actions={<LeadActions lead={lead} />}
                    outreachHistory={<OutreachHistory entries={lead.outreach_log} />}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Card View */}
      {viewMode === "card" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {paginated.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted text-xs">No leads found</div>
          )}
          {paginated.map(lead => (
            <div key={lead.id} className="card space-y-2.5 hover:border-border transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleSelect(lead.id)}>
                    {selectedIds.has(lead.id)
                      ? <CheckSquare size={13} className="text-gold" />
                      : <Square size={13} className="text-muted/40" />}
                  </button>
                  <div>
                    <h3 className="text-xs font-semibold">{lead.business_name}</h3>
                    <div className="flex items-center gap-2 text-[9px] text-muted mt-0.5">
                      {lead.industry && <span className="flex items-center gap-0.5"><Filter size={8} /> {lead.industry}</span>}
                      {lead.city && <span className="flex items-center gap-0.5"><MapPin size={8} /> {lead.city}{lead.state ? `, ${lead.state}` : ""}</span>}
                    </div>
                  </div>
                </div>
                <span className={`text-[8px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[lead.status] || STATUS_COLORS.new}`}>
                  {lead.status}
                </span>
              </div>

              {lead.google_rating && (
                <div className="flex items-center gap-1 text-[10px]">
                  <Star size={10} className="text-amber-400 fill-amber-400" />
                  <span className="text-amber-300 font-medium">{lead.google_rating}</span>
                  <span className="text-muted">({lead.review_count} reviews)</span>
                </div>
              )}

              <div className="flex items-center gap-3 text-[10px]">
                {lead.phone && <span className="flex items-center gap-1 text-muted"><Phone size={10} /> {lead.phone}</span>}
                {lead.email && <span className="flex items-center gap-1 text-muted truncate"><Mail size={10} /> {lead.email}</span>}
              </div>

              <div className="flex items-center gap-2">
                <SocialIcon url={lead.instagram_url} type="instagram" />
                <SocialIcon url={lead.facebook_url} type="facebook" />
                <SocialIcon url={lead.linkedin_url} type="linkedin" />
                <SocialIcon url={lead.tiktok_url} type="tiktok" />
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform" title="Website">
                    <Globe size={13} className="text-muted" />
                  </a>
                )}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="text-[8px] text-muted flex items-center gap-1">
                  <Clock size={8} />
                  {lead.outreach_log[0] ? `Last: ${formatShortDate(lead.outreach_log[0].sent_at)}` : "No outreach yet"}
                  {lead.outreach_log.length > 0 && <span>&middot; {lead.outreach_log.length} messages</span>}
                </span>
                <button onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                  className="text-[9px] text-gold hover:text-gold-light flex items-center gap-0.5">
                  {expandedId === lead.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  History
                </button>
              </div>

              {expandedId === lead.id && (
                <div className="pt-2 border-t border-border">
                  <OutreachHistory entries={lead.outreach_log} />
                </div>
              )}

              <LeadActions lead={lead} />
            </div>
          ))}
        </div>
      )}
      {/* Pipeline / Kanban View */}
      {viewMode === "pipeline" && (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "500px" }}>
          {STATUS_TABS.filter(t => t.key !== "all").map(stage => {
            const stageLeads = leads.filter(l => mapToCRMStatus(l.status) === stage.key);
            const stageColor: Record<string, string> = {
              new: "#3b82f6", contacted: "#f59e0b", replied: "#10b981", booked: "#a855f7", converted: "#C9A84C",
            };
            const color = stageColor[stage.key] || "#6b7280";

            return (
              <div key={stage.key} className="flex-shrink-0 w-[280px]">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-xs font-bold uppercase tracking-wider">{stage.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono" style={{ background: `${color}15`, color }}>{stageLeads.length}</span>
                  </div>
                </div>

                {/* Cards */}
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {stageLeads.length === 0 && (
                    <div className="text-center py-8 border border-dashed rounded-lg" style={{ borderColor: `${color}20` }}>
                      <p className="text-[10px] text-muted">No leads</p>
                    </div>
                  )}
                  {stageLeads.map(lead => {
                    // Lead score: based on data completeness + engagement
                    const hasEmail = !!lead.email;
                    const hasPhone = !!lead.phone;
                    const hasSocial = !!(lead.instagram_url || lead.facebook_url || lead.linkedin_url);
                    const hasReplied = lead.outreach_log.some(o => o.status === "replied");
                    const score = (hasEmail ? 20 : 0) + (hasPhone ? 20 : 0) + (hasSocial ? 15 : 0) + (lead.google_rating ? Math.min(lead.google_rating * 5, 25) : 0) + (hasReplied ? 20 : 0);
                    const temp = score >= 70 ? "hot" : score >= 40 ? "warm" : "cold";
                    const tempColor = temp === "hot" ? "#ef4444" : temp === "warm" ? "#f59e0b" : "#3b82f6";
                    const tempLabel = temp === "hot" ? "HOT" : temp === "warm" ? "WARM" : "COLD";

                    return (
                      <div key={lead.id} className="rounded-lg p-3 space-y-2 cursor-pointer bg-surface-light border border-border hover:border-gold/20 transition-all"
                        onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}>
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <h4 className="text-[11px] font-bold truncate">{lead.business_name}</h4>
                            <p className="text-[9px] text-muted truncate">{lead.industry || "Business"} {lead.city ? `· ${lead.city}` : ""}</p>
                          </div>
                          <span className="text-[7px] px-1.5 py-0.5 rounded font-bold shrink-0" style={{ background: `${tempColor}15`, color: tempColor }}>{tempLabel}</span>
                        </div>

                        {/* Contact info */}
                        <div className="flex items-center gap-2 text-[9px] text-muted">
                          {lead.email && <Mail size={9} />}
                          {lead.phone && <Phone size={9} />}
                          {lead.instagram_url && <Camera size={9} />}
                          {lead.google_rating && (
                            <span className="flex items-center gap-0.5 text-amber-400">
                              <Star size={8} className="fill-amber-400" /> {lead.google_rating}
                            </span>
                          )}
                        </div>

                        {/* Score bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-border">
                            <div className="h-1 rounded-full transition-all" style={{ width: `${score}%`, background: tempColor }} />
                          </div>
                          <span className="text-[8px] font-mono" style={{ color: tempColor }}>{score}</span>
                        </div>

                        {/* Last activity */}
                        <div className="flex items-center justify-between text-[8px] text-muted">
                          <span>{lead.outreach_log[0] ? formatShortDate(lead.outreach_log[0].sent_at) : "No outreach"}</span>
                          <span>{lead.outreach_log.length} msgs</span>
                        </div>

                        {/* Quick actions on expand */}
                        {expandedId === lead.id && (
                          <div className="pt-2 border-t border-border space-y-2">
                            <OutreachHistory entries={lead.outreach_log.slice(0, 3)} />
                            <LeadActions lead={lead} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-muted">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(0)} disabled={page === 0}
              className="text-[10px] px-2 py-1 rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-30 transition-all">First</button>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="text-[10px] px-2 py-1 rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-30 transition-all">Prev</button>
            <span className="text-[10px] text-muted px-2">Page {page + 1} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="text-[10px] px-2 py-1 rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-30 transition-all">Next</button>
            <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
              className="text-[10px] px-2 py-1 rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-30 transition-all">Last</button>
          </div>
        </div>
      )}

      <PageAI
        pageName="CRM"
        context={`${leads.length} total leads. Filters: ${activeTab}. ${leads.filter(l => l.status === "new").length} new, ${leads.filter(l => l.status === "contacted").length} contacted, ${leads.filter(l => l.status === "replied").length} replied, ${leads.filter(l => l.status === "booked").length} booked.`}
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

function LeadTableRow({ lead, expanded, selected, onToggleExpand, onToggleSelect, actions, outreachHistory }: {
  lead: CRMLead;
  expanded: boolean;
  selected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  actions: React.ReactNode;
  outreachHistory: React.ReactNode;
}) {
  return (
    <>
      <tr className={`border-b border-border hover:bg-surface-light/10 transition-colors ${expanded ? "bg-surface-light/10" : ""}`}>
        <td className="px-3 py-2.5">
          <button onClick={onToggleSelect}>
            {selected ? <CheckSquare size={13} className="text-gold" /> : <Square size={13} className="text-muted/40" />}
          </button>
        </td>
        <td className="px-3 py-2.5">
          <div>
            <p className="font-medium text-[11px]">{lead.business_name}</p>
            <div className="flex items-center gap-2 text-[9px] text-muted mt-0.5">
              {lead.industry && <span className="flex items-center gap-0.5"><Briefcase size={8} /> {lead.industry}</span>}
              {lead.city && <span className="flex items-center gap-0.5"><MapPin size={8} /> {lead.city}</span>}
              {lead.google_rating && (
                <span className="flex items-center gap-0.5">
                  <Star size={8} className="text-amber-400 fill-amber-400" /> {lead.google_rating} ({lead.review_count})
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            {lead.phone && <span className="text-muted flex items-center gap-0.5" title={lead.phone}><Phone size={11} /></span>}
            {lead.email && <span className="text-muted flex items-center gap-0.5" title={lead.email}><Mail size={11} /></span>}
            {lead.website && (
              <a href={lead.website} target="_blank" rel="noopener noreferrer" title={lead.website}>
                <Globe size={11} className="text-muted hover:text-foreground" />
              </a>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            {lead.instagram_url && <a href={lead.instagram_url} target="_blank" rel="noopener noreferrer"><Camera size={12} className="text-pink-400 hover:scale-110 transition-transform" /></a>}
            {lead.facebook_url && <a href={lead.facebook_url} target="_blank" rel="noopener noreferrer"><Globe size={12} className="text-blue-400 hover:scale-110 transition-transform" /></a>}
            {lead.linkedin_url && <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer"><Briefcase size={12} className="text-blue-400 hover:scale-110 transition-transform" /></a>}
            {lead.tiktok_url && <a href={lead.tiktok_url} target="_blank" rel="noopener noreferrer"><Music size={12} className="text-foreground hover:scale-110 transition-transform" /></a>}
          </div>
        </td>
        <td className="px-3 py-2.5">
          <span className={`text-[8px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[lead.status] || STATUS_COLORS.new}`}>
            {lead.status}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <span className="text-[9px] text-muted flex items-center gap-1">
            <Clock size={9} />
            {lead.outreach_log[0] ? formatShortDate(lead.outreach_log[0].sent_at) : "Never"}
          </span>
          {lead.outreach_log.length > 0 && (
            <span className="text-[8px] text-muted">{lead.outreach_log.length} msgs</span>
          )}
        </td>
        <td className="px-3 py-2.5">{actions}</td>
        <td className="px-2 py-2.5">
          <button onClick={onToggleExpand} className="hover:bg-surface-light rounded-lg p-1 transition-colors">
            {expanded ? <ChevronUp size={12} className="text-muted" /> : <ChevronDown size={12} className="text-muted" />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-surface-light/5">
          <td colSpan={8} className="px-6 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Send size={11} className="text-gold" />
              <span className="text-[10px] font-semibold text-gold">Outreach History</span>
              <span className="text-[8px] text-muted">({lead.outreach_log.length} messages)</span>
            </div>
            {outreachHistory}
          </td>
        </tr>
      )}
    </>
  );
}
