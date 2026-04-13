"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Users, Phone, Mail, MessageCircle, Search, Filter,
  ChevronDown, ChevronUp, Calendar, Send, Clock,
  Flame, Thermometer, Snowflake, Skull, Star
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";

type Tier = "all" | "hot" | "warm" | "cold" | "dead";

interface Lead {
  id: string;
  business_name: string;
  phone: string;
  email: string;
  status: string;
  industry: string;
  city: string;
  platform: string;
  tier: string;
  last_contact: string;
  next_action: string;
  created_at: string;
}

interface OutreachLog {
  id: string;
  lead_id: string;
  platform: string;
  message_text: string;
  status: string;
  sent_at: string;
  reply_text: string | null;
  source: string;
}

const TIER_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; bgColor: string }> = {
  hot: { label: "Hot", color: "text-red-400", icon: <Flame size={12} className="text-red-400" />, bgColor: "bg-red-400/10" },
  warm: { label: "Warm", color: "text-orange-400", icon: <Thermometer size={12} className="text-orange-400" />, bgColor: "bg-orange-400/10" },
  cold: { label: "Cold", color: "text-blue-400", icon: <Snowflake size={12} className="text-blue-400" />, bgColor: "bg-blue-400/10" },
  dead: { label: "Dead", color: "text-muted", icon: <Skull size={12} className="text-muted" />, bgColor: "bg-muted/10" },
};

const CATEGORY_BADGES: Record<string, { label: string; color: string }> = {
  cold_dm: { label: "Cold DM", color: "bg-purple-400/10 text-purple-400" },
  cold_call: { label: "Cold Call", color: "bg-green-400/10 text-green-400" },
  email: { label: "Email", color: "bg-blue-400/10 text-blue-400" },
  follow_up: { label: "Follow-up", color: "bg-yellow-400/10 text-yellow-400" },
};

export default function OutreachHubPage() {
  useAuth();
  const supabase = createClient();
  const [tab, setTab] = useState<Tier>("all");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [outreachLogs, setOutreachLogs] = useState<Record<string, OutreachLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [schedulingLeadId, setSchedulingLeadId] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [tierCounts, setTierCounts] = useState({ all: 0, hot: 0, warm: 0, cold: 0, dead: 0 });

  const fetchLeads = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      setLoading(true);
      let query = supabase.from("leads").select("*").order("created_at", { ascending: false });

      if (tab === "hot") query = query.eq("status", "replied");
      else if (tab === "warm") query = query.eq("status", "contacted");
      else if (tab === "cold") query = query.eq("status", "new");
      else if (tab === "dead") query = query.eq("status", "bounced");

      if (industryFilter) query = query.eq("industry", industryFilter);
      if (cityFilter) query = query.ilike("city", `%${cityFilter}%`);
      if (platformFilter) query = query.eq("platform", platformFilter);

      const { data, error } = await query;

      if (error) {
        toast.error("Failed to load leads");
        return;
      }

      setLeads(data || []);

      // Fetch tier counts
      const [
        { count: allCount },
        { count: hotCount },
        { count: warmCount },
        { count: coldCount },
        { count: deadCount },
      ] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "replied"),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "contacted"),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "bounced"),
      ]);

      setTierCounts({
        all: allCount || 0,
        hot: hotCount || 0,
        warm: warmCount || 0,
        cold: coldCount || 0,
        dead: deadCount || 0,
      });
    } catch (err) {
      console.error("[OutreachHub] fetchLeads error:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, tab, industryFilter, cityFilter, platformFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function fetchOutreachHistory(leadId: string) {
    if (outreachLogs[leadId]) return;
    const { data } = await supabase
      .from("outreach_log")
      .select("*")
      .eq("lead_id", leadId)
      .order("sent_at", { ascending: false });
    setOutreachLogs((prev) => ({ ...prev, [leadId]: data || [] }));
  }

  function toggleExpand(leadId: string) {
    if (expandedId === leadId) {
      setExpandedId(null);
    } else {
      setExpandedId(leadId);
      fetchOutreachHistory(leadId);
    }
  }

  async function bulkAction(action: "email" | "call" | "dm") {
    const filtered = getFilteredLeads();
    if (filtered.length === 0) {
      toast.error("No leads in this tier");
      return;
    }

    toast.loading(`Queuing ${action} for ${filtered.length} leads...`);
    try {
      const res = await fetch("/api/outreach/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          lead_ids: filtered.map((l) => l.id),
          tier: tab,
        }),
      });
      toast.dismiss();
      if (res.ok) {
        toast.success(`${action.toUpperCase()} queued for ${filtered.length} leads`);
      } else {
        toast.error(`Failed to queue ${action}`);
      }
    } catch {
      toast.dismiss();
      toast.error("Bulk action failed");
    }
  }

  async function scheduleFollowUp(leadId: string) {
    if (!followUpDate) {
      toast.error("Please select a date");
      return;
    }
    const { error } = await supabase.from("leads").update({
      next_action: `Follow-up scheduled: ${followUpDate}`,
    }).eq("id", leadId);

    if (error) {
      toast.error("Failed to schedule follow-up");
    } else {
      toast.success("Follow-up scheduled");
      setSchedulingLeadId(null);
      setFollowUpDate("");
      fetchLeads();
    }
  }

  function getFilteredLeads() {
    return leads.filter((l) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        l.business_name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.phone?.includes(q)
      );
    });
  }

  function getTierForLead(lead: Lead): string {
    if (lead.status === "replied") return "hot";
    if (lead.status === "contacted") return "warm";
    if (lead.status === "bounced") return "dead";
    return "cold";
  }

  function getCategoryForLog(log: OutreachLog): string {
    if (log.source === "follow_up" || log.status === "follow_up") return "follow_up";
    if (log.platform === "email") return "email";
    if (log.platform === "call" || log.platform === "phone") return "cold_call";
    return "cold_dm";
  }

  function formatTime(ts: string) {
    if (!ts) return "—";
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  const filteredLeads = getFilteredLeads();
  const industries = Array.from(new Set(leads.map((l) => l.industry).filter(Boolean)));
  const platforms = Array.from(new Set(leads.map((l) => l.platform).filter(Boolean)));

  const TABS: { key: Tier; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "All Leads", icon: <Users size={14} /> },
    { key: "hot", label: "Hot", icon: <Flame size={14} /> },
    { key: "warm", label: "Warm", icon: <Thermometer size={14} /> },
    { key: "cold", label: "Cold", icon: <Snowflake size={14} /> },
    { key: "dead", label: "Dead", icon: <Skull size={14} /> },
  ];

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-3">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
              <Users size={24} className="text-gold" />
            </div>
            Outreach Hub
          </h1>
          <p className="text-muted text-sm mt-1">Manage leads by tier with bulk outreach actions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs rounded-md flex items-center gap-2 whitespace-nowrap transition-all ${
              tab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
            }`}
          >
            {t.icon} {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              tab === t.key ? "bg-black/20" : "bg-surface-light"
            }`}>
              {tierCounts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Filters & Bulk Actions */}
      <div className="card rounded-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input w-full pl-9 text-xs"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted" />
            <select
              className="input text-xs py-1.5"
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
            >
              <option value="">All Industries</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
            <input
              className="input text-xs py-1.5 w-32"
              placeholder="City..."
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            />
            <select
              className="input text-xs py-1.5"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
            >
              <option value="">All Platforms</option>
              {platforms.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => bulkAction("email")} className="btn-secondary flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg">
              <Mail size={12} /> Email All
            </button>
            <button onClick={() => bulkAction("call")} className="btn-secondary flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg">
              <Phone size={12} /> Call All
            </button>
            <button onClick={() => bulkAction("dm")} className="btn-primary flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg">
              <MessageCircle size={12} /> DM All
            </button>
          </div>
        </div>
      </div>

      {/* Lead List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Clock size={24} className="animate-spin text-gold" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="card rounded-xl text-center py-12">
          <Star size={32} className="text-muted mx-auto mb-3" />
          <p className="text-sm text-muted">No leads found in this tier</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLeads.map((lead) => {
            const tier = getTierForLead(lead);
            const tierConfig = TIER_CONFIG[tier];
            const isExpanded = expandedId === lead.id;

            return (
              <div key={lead.id} className="card card-hover rounded-xl">
                {/* Lead Row */}
                <div
                  className="flex items-center gap-4 cursor-pointer"
                  onClick={() => toggleExpand(lead.id)}
                >
                  <div className="flex items-center gap-2 min-w-[200px]">
                    {isExpanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                    <div>
                      <p className="text-sm font-medium">{lead.business_name || "Unknown Business"}</p>
                      <p className="text-[10px] text-muted">{lead.industry || "—"} {lead.city ? `· ${lead.city}` : ""}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-1 text-xs text-muted min-w-[140px]">
                      <Phone size={10} /> <span className="truncate">{lead.phone || "—"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted min-w-[180px]">
                      <Mail size={10} /> <span className="truncate">{lead.email || "—"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {tierConfig && (
                      <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${tierConfig.bgColor} ${tierConfig.color}`}>
                        {tierConfig.icon} {tierConfig.label}
                      </span>
                    )}
                    <span className="text-[10px] text-muted">{formatTime(lead.last_contact || lead.created_at)}</span>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Outreach History */}
                      <div>
                        <h4 className="text-xs font-medium mb-2 flex items-center gap-2">
                          <Send size={12} /> Outreach History
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {(!outreachLogs[lead.id] || outreachLogs[lead.id].length === 0) ? (
                            <p className="text-[10px] text-muted py-4 text-center">No outreach history</p>
                          ) : (
                            outreachLogs[lead.id].map((log) => {
                              const category = getCategoryForLog(log);
                              const badge = CATEGORY_BADGES[category];
                              return (
                                <div key={log.id} className="bg-surface-light rounded-lg p-2.5">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.color}`}>
                                      {badge.label}
                                    </span>
                                    <span className="text-[10px] text-muted capitalize">{log.platform}</span>
                                    <span className="text-[10px] text-muted ml-auto">{formatTime(log.sent_at)}</span>
                                  </div>
                                  <p className="text-xs text-foreground truncate">{log.message_text}</p>
                                  {log.reply_text && (
                                    <p className="text-xs text-green-400 mt-1 truncate">Reply: {log.reply_text}</p>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Schedule Follow-Up */}
                      <div>
                        <h4 className="text-xs font-medium mb-2 flex items-center gap-2">
                          <Calendar size={12} /> Schedule Follow-Up
                        </h4>
                        {lead.next_action && (
                          <div className="bg-gold/10 rounded-lg p-2.5 mb-3">
                            <p className="text-[10px] text-gold flex items-center gap-1">
                              <Clock size={10} /> {lead.next_action}
                            </p>
                          </div>
                        )}
                        {schedulingLeadId === lead.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="datetime-local"
                              className="input text-xs flex-1"
                              value={followUpDate}
                              onChange={(e) => setFollowUpDate(e.target.value)}
                            />
                            <button
                              onClick={() => scheduleFollowUp(lead.id)}
                              className="btn-primary text-[10px] px-3 py-1.5 rounded-lg"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => { setSchedulingLeadId(null); setFollowUpDate(""); }}
                              className="btn-secondary text-[10px] px-3 py-1.5 rounded-lg"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSchedulingLeadId(lead.id)}
                            className="btn-secondary flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg"
                          >
                            <Calendar size={10} /> Schedule Next Follow-Up
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <PageAI pageName="Outreach Hub" context="Lead outreach tiers with hot, warm, cold, dead leads. Manage follow-ups and prioritize outreach." suggestions={["Write 5 follow-up messages for warm leads", "Which leads should I call first today?", "Draft a personalized email for a gym owner", "What's the best time to send cold DMs?"]} />
    </div>
  );
}
