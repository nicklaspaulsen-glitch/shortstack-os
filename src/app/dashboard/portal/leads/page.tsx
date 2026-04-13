"use client";

import { useState, useEffect } from "react";
import {
  Search, Zap, Download, Filter, MapPin, Star,
  Mail, Phone, MessageSquare, Globe,
  Sparkles, Target, Users, ChevronDown,
  Loader,
} from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

const NICHES = [
  "Dentist", "Lawyer", "Plumber", "Electrician", "Gym", "Roofer",
  "Real Estate Agent", "Restaurant", "Hair Salon", "HVAC",
  "Accountant", "Chiropractor", "Auto Repair", "Landscaper",
  "Photographer", "Yoga Studio", "Insurance Agent", "Veterinarian",
  "Financial Advisor", "Wedding Planner", "Med Spa", "Tattoo Shop",
];

const PLATFORMS = [
  { id: "google_maps", label: "Google Maps", color: "#34a853" },
  { id: "facebook", label: "Facebook", color: "#1877f2" },
  { id: "instagram", label: "Instagram", color: "#e4405f" },
  { id: "linkedin", label: "LinkedIn", color: "#0a66c2" },
  { id: "tiktok", label: "TikTok", color: "#ffffff" },
];

interface Lead {
  id: string;
  business_name: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  google_rating: number | null;
  review_count: number;
  industry: string | null;
  source: string;
  status: string;
  lead_score?: number;
  instagram_url?: string;
  facebook_url?: string;
  linkedin_url?: string;
  tiktok_url?: string;
  created_at: string;
}

export default function ClientLeadEnginePage() {
  useAuth();
  const supabase = createClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  // Search config
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [platform, setPlatform] = useState("google_maps");
  const [maxResults, setMaxResults] = useState(25);
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [requirePhone, setRequirePhone] = useState(false);
  const [requireEmail, setRequireEmail] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total: 0, withEmail: 0, withPhone: 0, avgScore: 0 });

  useEffect(() => {
    fetchExistingLeads();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchExistingLeads() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;
      const list = (data || []) as Lead[];
      setLeads(list);
      updateStats(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  function updateStats(list: Lead[]) {
    setStats({
      total: list.length,
      withEmail: list.filter((l) => l.email).length,
      withPhone: list.filter((l) => l.phone).length,
      avgScore: list.length > 0
        ? Math.round(list.reduce((s, l) => s + (l.lead_score || 50), 0) / list.length)
        : 0,
    });
  }

  async function runSearch() {
    if (!niche || !location) {
      toast.error("Enter a niche and location");
      return;
    }
    setSearching(true);

    try {
      const res = await fetch("/api/scraper/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: [platform],
          niches: [niche],
          locations: [location],
          max_results: maxResults,
          filters: {
            min_rating: minRating || undefined,
            require_phone: requirePhone,
            require_email: requireEmail,
          },
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast.success(`Found ${data.leads_found || 0} leads`);
      await fetchExistingLeads();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  function toggleLead(id: string) {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function selectAll() {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map((l) => l.id)));
    }
  }

  async function bulkAction(type: "email" | "dm" | "call") {
    const ids = Array.from(selectedLeads);
    if (ids.length === 0) {
      toast.error("Select leads first");
      return;
    }

    const endpoints: Record<string, string> = {
      email: "/api/outreach/email",
      dm: "/api/dm/browser-send",
      call: "/api/outreach/bulk",
    };

    try {
      toast.loading(`Queueing ${type} for ${ids.length} leads...`);
      const res = await fetch(endpoints[type], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_ids: ids,
          action: type,
          batch_size: ids.length,
        }),
      });
      const data = await res.json();
      toast.dismiss();

      if (data.error) throw new Error(data.error);
      toast.success(`${type === "email" ? "Emails" : type === "dm" ? "DMs" : "Calls"} queued for ${ids.length} leads`);
      setSelectedLeads(new Set());
    } catch (err) {
      toast.dismiss();
      toast.error(err instanceof Error ? err.message : `${type} failed`);
    }
  }

  async function downloadCSV() {
    const rows = leads.map((l) => ({
      business: l.business_name,
      phone: l.phone || "",
      email: l.email || "",
      website: l.website || "",
      city: l.city || "",
      rating: l.google_rating || "",
      reviews: l.review_count,
      industry: l.industry || "",
      score: l.lead_score || "",
    }));
    const headers = Object.keys(rows[0] || {}).join(",");
    const csv = [headers, ...rows.map((r) => Object.values(r).map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 50) return "text-gold";
    return "text-muted";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles size={20} className="text-gold" />
            AI Lead Engine
          </h1>
          <p className="text-xs text-muted mt-1">Find, score, and reach high-value prospects instantly</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedLeads.size > 0 && (
            <span className="text-[10px] text-gold font-medium px-2 py-1 bg-gold/10 rounded-lg">
              {selectedLeads.size} selected
            </span>
          )}
          <button onClick={downloadCSV} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Leads", value: stats.total, icon: <Users size={14} />, color: "text-info" },
          { label: "With Email", value: stats.withEmail, icon: <Mail size={14} />, color: "text-success" },
          { label: "With Phone", value: stats.withPhone, icon: <Phone size={14} />, color: "text-gold" },
          { label: "Avg Score", value: `${stats.avgScore}%`, icon: <Target size={14} />, color: "text-gold" },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-3 py-3">
            <div className={`${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-[9px] text-muted uppercase tracking-wider">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search Bar — The Engine */}
      <div className="card border-gold/20">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-gold" />
          <span className="text-xs font-semibold">Find New Leads</span>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Industry (e.g. Dentist, Gym, Lawyer)"
              className="input w-full text-xs pl-9"
              list="niche-list"
            />
            <datalist id="niche-list">
              {NICHES.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>
          <div className="flex-1 relative">
            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (e.g. Miami, FL)"
              className="input w-full text-xs pl-9"
            />
          </div>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="input text-xs w-40"
          >
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button
            onClick={runSearch}
            disabled={searching}
            className="btn-primary text-xs px-5 flex items-center gap-2"
          >
            {searching ? <Loader size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {searching ? "Searching..." : "Find Leads"}
          </button>
        </div>

        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1 text-[10px] text-muted hover:text-foreground mt-2 transition-colors"
        >
          <Filter size={10} /> Advanced Filters <ChevronDown size={10} className={`transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </button>

        {showFilters && (
          <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t border-border">
            <div>
              <label className="text-[9px] text-muted uppercase block mb-1">Max Results</label>
              <input type="number" value={maxResults} onChange={(e) => setMaxResults(+e.target.value)}
                className="input w-full text-xs" min={5} max={100} />
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase block mb-1">Min Rating</label>
              <select value={minRating} onChange={(e) => setMinRating(+e.target.value)} className="input w-full text-xs">
                <option value={0}>Any</option>
                <option value={3}>3+ Stars</option>
                <option value={4}>4+ Stars</option>
                <option value={4.5}>4.5+ Stars</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-4">
              <input type="checkbox" checked={requirePhone} onChange={(e) => setRequirePhone(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border" />
              <span className="text-[10px]">Has Phone</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer pt-4">
              <input type="checkbox" checked={requireEmail} onChange={(e) => setRequireEmail(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border" />
              <span className="text-[10px]">Has Email</span>
            </label>
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedLeads.size > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-gold/5 border border-gold/15">
          <span className="text-xs font-medium text-gold">{selectedLeads.size} leads selected</span>
          <div className="flex-1" />
          <button onClick={() => bulkAction("email")} className="text-[10px] px-3 py-1.5 rounded-lg bg-info/10 text-info hover:bg-info/20 flex items-center gap-1.5 transition-colors">
            <Mail size={11} /> Email All
          </button>
          <button onClick={() => bulkAction("dm")} className="text-[10px] px-3 py-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 flex items-center gap-1.5 transition-colors">
            <MessageSquare size={11} /> DM All
          </button>
          <button onClick={() => bulkAction("call")} className="text-[10px] px-3 py-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 flex items-center gap-1.5 transition-colors">
            <Phone size={11} /> Call All
          </button>
        </div>
      )}

      {/* Leads Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-light">
                <th className="px-3 py-2.5 text-left">
                  <input type="checkbox" checked={selectedLeads.size === leads.length && leads.length > 0}
                    onChange={selectAll} className="w-3.5 h-3.5 rounded border-border" />
                </th>
                <th className="px-3 py-2.5 text-left text-[9px] uppercase tracking-wider text-muted font-semibold">Business</th>
                <th className="px-3 py-2.5 text-left text-[9px] uppercase tracking-wider text-muted font-semibold">Contact</th>
                <th className="px-3 py-2.5 text-left text-[9px] uppercase tracking-wider text-muted font-semibold">Location</th>
                <th className="px-3 py-2.5 text-center text-[9px] uppercase tracking-wider text-muted font-semibold">Rating</th>
                <th className="px-3 py-2.5 text-center text-[9px] uppercase tracking-wider text-muted font-semibold">Score</th>
                <th className="px-3 py-2.5 text-center text-[9px] uppercase tracking-wider text-muted font-semibold">Status</th>
                <th className="px-3 py-2.5 text-center text-[9px] uppercase tracking-wider text-muted font-semibold">Socials</th>
                <th className="px-3 py-2.5 text-right text-[9px] uppercase tracking-wider text-muted font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted">
                  <Loader size={16} className="animate-spin mx-auto mb-2" /> Loading leads...
                </td></tr>
              ) : error ? (
                <tr><td colSpan={9} className="text-center py-12 text-danger">
                  <p className="text-xs mb-2">Failed to load leads: {error}</p>
                  <button onClick={fetchExistingLeads} className="text-[10px] text-gold hover:text-gold-light underline">Try again</button>
                </td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted">
                  <Sparkles size={20} className="mx-auto mb-2 text-gold/40" />
                  <p className="text-xs">No leads yet. Use the search above to find prospects.</p>
                </td></tr>
              ) : (
                leads.map((lead) => {
                  const score = lead.lead_score || 50;
                  return (
                    <tr key={lead.id} className="border-b border-border/50 hover:bg-surface-light/50 transition-colors">
                      <td className="px-3 py-2.5">
                        <input type="checkbox" checked={selectedLeads.has(lead.id)}
                          onChange={() => toggleLead(lead.id)} className="w-3.5 h-3.5 rounded border-border" />
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-foreground">{lead.business_name}</p>
                        <p className="text-[10px] text-muted">{lead.industry || lead.source}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="space-y-0.5">
                          {lead.email && (
                            <p className="text-[10px] text-muted flex items-center gap-1">
                              <Mail size={9} className="text-info" /> {lead.email}
                            </p>
                          )}
                          {lead.phone && (
                            <p className="text-[10px] text-muted flex items-center gap-1">
                              <Phone size={9} className="text-success" /> {lead.phone}
                            </p>
                          )}
                          {!lead.email && !lead.phone && (
                            <span className="text-[10px] text-muted/50">No contact info</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-muted">{lead.city || lead.address || "—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        {lead.google_rating ? (
                          <span className="flex items-center justify-center gap-0.5 text-[10px]">
                            <Star size={10} className="text-gold fill-gold" /> {lead.google_rating}
                            <span className="text-muted">({lead.review_count})</span>
                          </span>
                        ) : <span className="text-muted text-[10px]">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-[11px] font-bold ${getScoreColor(score)}`}>{score}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                          lead.status === "new" ? "bg-info/10 text-info" :
                          lead.status === "contacted" ? "bg-gold/10 text-gold" :
                          lead.status === "replied" ? "bg-success/10 text-success" :
                          lead.status === "booked" ? "bg-gold/10 text-gold" :
                          "bg-surface-light text-muted"
                        }`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          {lead.instagram_url && <span className="w-4 h-4 rounded-full bg-[#e4405f]/10 flex items-center justify-center" title="Instagram"><span className="text-[7px]">IG</span></span>}
                          {lead.facebook_url && <span className="w-4 h-4 rounded-full bg-[#1877f2]/10 flex items-center justify-center" title="Facebook"><span className="text-[7px]">FB</span></span>}
                          {lead.linkedin_url && <span className="w-4 h-4 rounded-full bg-[#0a66c2]/10 flex items-center justify-center" title="LinkedIn"><span className="text-[7px]">LI</span></span>}
                          {lead.tiktok_url && <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center" title="TikTok"><span className="text-[7px]">TT</span></span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {lead.email && (
                            <button onClick={() => { setSelectedLeads(new Set([lead.id])); bulkAction("email"); }}
                              className="p-1.5 rounded-lg hover:bg-info/10 text-muted hover:text-info transition-colors" title="Send Email">
                              <Mail size={12} />
                            </button>
                          )}
                          {lead.phone && (
                            <button onClick={() => { setSelectedLeads(new Set([lead.id])); bulkAction("call"); }}
                              className="p-1.5 rounded-lg hover:bg-success/10 text-muted hover:text-success transition-colors" title="Call">
                              <Phone size={12} />
                            </button>
                          )}
                          {lead.website && (
                            <a href={lead.website} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 rounded-lg hover:bg-surface-light text-muted hover:text-foreground transition-colors" title="Website">
                              <Globe size={12} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
