"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Lead, OutreachEntry, FollowUp } from "@/lib/types";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import DataTable from "@/components/ui/data-table";
import { PageLoading } from "@/components/ui/loading";
import { formatRelativeTime, formatDate } from "@/lib/utils";
import {
  Zap, MessageSquare, RefreshCw, Search,
  Phone, Globe, Mail, Star
} from "lucide-react";

type Tab = "leads" | "outreach" | "followups" | "ghl";

export default function LeadEnginePage() {
  const [tab, setTab] = useState<Tab>("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [outreach, setOutreach] = useState<OutreachEntry[]>([]);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 3000); return () => clearTimeout(t); }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [stats, setStats] = useState({
    leadsToday: 0, totalLeads: 0, dmsSent: 0, dmsTarget: 80,
    repliesThisWeek: 0, pendingFollowups: 0, ghlSynced: 0, ghlFailed: 0,
  });
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [tab, statusFilter, industryFilter]);

  async function fetchData() {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // Fetch stats
    const [
      { count: leadsToday },
      { count: totalLeads },
      { count: dmsSent },
      { count: replies },
      { count: pendingFollowups },
      { count: ghlSynced },
      { count: ghlFailed },
    ] = await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }).gte("scraped_at", today),
      supabase.from("leads").select("*", { count: "exact", head: true }),
      supabase.from("outreach_log").select("*", { count: "exact", head: true }).gte("sent_at", today),
      supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "replied").gte("sent_at", weekAgo),
      supabase.from("follow_up_queue").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("ghl_sync_status", "synced"),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("ghl_sync_status", "failed"),
    ]);

    setStats({
      leadsToday: leadsToday || 0,
      totalLeads: totalLeads || 0,
      dmsSent: dmsSent || 0,
      dmsTarget: 80,
      repliesThisWeek: replies || 0,
      pendingFollowups: pendingFollowups || 0,
      ghlSynced: ghlSynced || 0,
      ghlFailed: ghlFailed || 0,
    });

    // Fetch tab data
    if (tab === "leads") {
      let query = supabase.from("leads").select("*").order("scraped_at", { ascending: false }).limit(100);
      if (statusFilter) query = query.eq("status", statusFilter);
      if (industryFilter) query = query.eq("industry", industryFilter);
      const { data } = await query;
      setLeads(data || []);
    } else if (tab === "outreach") {
      const { data } = await supabase.from("outreach_log").select("*").order("sent_at", { ascending: false }).limit(100);
      setOutreach(data || []);
    } else if (tab === "followups") {
      const { data } = await supabase.from("follow_up_queue").select("*").order("scheduled_date").eq("status", "pending").limit(100);
      setFollowups(data || []);
    }

    setLoading(false);
  }

  const filteredLeads = leads.filter((l) =>
    !searchQuery || l.business_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "leads", label: "All Leads" },
    { key: "outreach", label: "Outreach Tracker" },
    { key: "followups", label: "Follow-up Queue" },
    { key: "ghl", label: "GHL Sync" },
  ];

  const industries = ["plumber", "dentist", "lawyer", "gym", "electrician", "roofer", "accountant", "chiropractor", "real estate agent", "restaurant"];

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0">Lead Engine</h1>
          <p className="text-muted text-sm">Automated lead scraping, outreach & GHL import</p>
        </div>
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Leads Scraped Today" value={stats.leadsToday} icon={<Zap size={18} />} change={`${stats.totalLeads} total`} />
        <StatCard
          label="DMs Sent Today"
          value={`${stats.dmsSent}/${stats.dmsTarget}`}
          icon={<MessageSquare size={18} />}
          change={`${Math.round((stats.dmsSent / stats.dmsTarget) * 100)}% of target`}
        />
        <StatCard label="Replies This Week" value={stats.repliesThisWeek} changeType="positive" change="Keep going!" />
        <StatCard label="Pending Follow-ups" value={stats.pendingFollowups} change={`${stats.ghlSynced} synced to GHL`} />
      </div>

      {/* DM Progress Bars */}
      <div className="card">
        <h3 className="text-sm font-medium text-muted mb-3">Daily DM Progress</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["Instagram", "LinkedIn", "Facebook", "TikTok"].map((platform) => (
            <div key={platform}>
              <div className="flex justify-between text-xs mb-1">
                <span>{platform}</span>
                <span className="text-muted">0/20</span>
              </div>
              <div className="w-full bg-surface-light rounded-full h-2">
                <div className="bg-gold rounded-full h-2 transition-all" style={{ width: "0%" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-md transition-all ${
              tab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters (for leads tab) */}
      {tab === "leads" && (
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search businesses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="called">Called</option>
            <option value="not_interested">Not Interested</option>
            <option value="booked">Booked</option>
            <option value="converted">Converted</option>
          </select>
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="input"
          >
            <option value="">All Industries</option>
            {industries.map((i) => (
              <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <PageLoading />
      ) : (
        <>
          {/* Leads Table */}
          {tab === "leads" && (
            <DataTable
              columns={[
                { key: "business_name", label: "Business", render: (l: Lead) => (
                  <div>
                    <p className="font-medium">{l.business_name}</p>
                    <p className="text-xs text-muted">{l.industry}</p>
                  </div>
                )},
                { key: "phone", label: "Phone", render: (l: Lead) => l.phone ? (
                  <a href={`tel:${l.phone}`} className="text-gold hover:text-gold-light flex items-center gap-1">
                    <Phone size={12} /> {l.phone}
                  </a>
                ) : <span className="text-muted">-</span> },
                { key: "email", label: "Email", render: (l: Lead) => l.email ? (
                  <a href={`mailto:${l.email}`} className="text-gold hover:text-gold-light flex items-center gap-1">
                    <Mail size={12} /> {l.email}
                  </a>
                ) : <span className="text-muted">-</span> },
                { key: "website", label: "Website", render: (l: Lead) => l.website ? (
                  <a href={l.website} target="_blank" rel="noopener" className="text-gold hover:text-gold-light flex items-center gap-1">
                    <Globe size={12} /> Visit
                  </a>
                ) : <span className="text-muted">-</span> },
                { key: "google_rating", label: "Rating", render: (l: Lead) => l.google_rating ? (
                  <span className="flex items-center gap-1">
                    <Star size={12} className="text-gold" /> {l.google_rating} ({l.review_count})
                  </span>
                ) : <span className="text-muted">-</span> },
                { key: "source", label: "Source", render: (l: Lead) => (
                  <span className="text-xs capitalize">{l.source.replace("_", " ")}</span>
                )},
                { key: "status", label: "Status", render: (l: Lead) => <StatusBadge status={l.status} /> },
                { key: "ghl_sync_status", label: "GHL", render: (l: Lead) => <StatusBadge status={l.ghl_sync_status} /> },
                { key: "scraped_at", label: "Scraped", render: (l: Lead) => (
                  <span className="text-xs text-muted">{formatRelativeTime(l.scraped_at)}</span>
                )},
              ]}
              data={filteredLeads}
              emptyMessage="No leads found. Run the scraper to get started."
            />
          )}

          {/* Outreach Table */}
          {tab === "outreach" && (
            <DataTable
              columns={[
                { key: "platform", label: "Platform", render: (o: OutreachEntry) => (
                  <span className="capitalize font-medium">{o.platform}</span>
                )},
                { key: "business_name", label: "Business" },
                { key: "message_text", label: "Message", render: (o: OutreachEntry) => (
                  <p className="text-xs text-muted max-w-xs truncate">{o.message_text}</p>
                )},
                { key: "status", label: "Status", render: (o: OutreachEntry) => <StatusBadge status={o.status} /> },
                { key: "reply_text", label: "Reply", render: (o: OutreachEntry) => o.reply_text ? (
                  <p className="text-xs text-success max-w-xs truncate">{o.reply_text}</p>
                ) : <span className="text-muted">-</span> },
                { key: "sent_at", label: "Sent", render: (o: OutreachEntry) => (
                  <span className="text-xs text-muted">{formatRelativeTime(o.sent_at)}</span>
                )},
              ]}
              data={outreach}
              emptyMessage="No outreach messages sent yet."
            />
          )}

          {/* Follow-up Queue */}
          {tab === "followups" && (
            <DataTable
              columns={[
                { key: "platform", label: "Platform", render: (f: FollowUp) => (
                  <span className="capitalize">{f.platform}</span>
                )},
                { key: "followup_number", label: "Follow-up #", render: (f: FollowUp) => (
                  <span>{f.followup_number === 1 ? "Day 3" : "Day 7"}</span>
                )},
                { key: "scheduled_date", label: "Scheduled", render: (f: FollowUp) => (
                  <span>{formatDate(f.scheduled_date)}</span>
                )},
                { key: "status", label: "Status", render: (f: FollowUp) => <StatusBadge status={f.status} /> },
                { key: "message_text", label: "Message", render: (f: FollowUp) => (
                  <p className="text-xs text-muted max-w-xs truncate">{f.message_text || "Will be generated"}</p>
                )},
              ]}
              data={followups}
              emptyMessage="No pending follow-ups."
            />
          )}

          {/* GHL Sync Tab */}
          {tab === "ghl" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Synced to GHL" value={stats.ghlSynced} changeType="positive" />
                <StatCard label="Failed Syncs" value={stats.ghlFailed} changeType={stats.ghlFailed > 0 ? "negative" : "neutral"} />
                <StatCard label="Pending" value={stats.totalLeads - stats.ghlSynced - stats.ghlFailed} />
              </div>
              <DataTable
                columns={[
                  { key: "business_name", label: "Business" },
                  { key: "phone", label: "Phone" },
                  { key: "ghl_contact_id", label: "GHL ID", render: (l: Lead) => l.ghl_contact_id || <span className="text-muted">-</span> },
                  { key: "ghl_sync_status", label: "Sync Status", render: (l: Lead) => <StatusBadge status={l.ghl_sync_status} /> },
                  { key: "ghl_synced_at", label: "Synced At", render: (l: Lead) => l.ghl_synced_at ? formatRelativeTime(l.ghl_synced_at) : "-" },
                ]}
                data={leads.filter((l) => l.ghl_sync_status !== "pending")}
                emptyMessage="No GHL sync data yet."
              />
            </div>
          )}
        </>
      )}

      {/* Weekly Stats */}
      <div className="card">
        <h3 className="section-header">Weekly Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gold">{stats.totalLeads}</p>
            <p className="text-xs text-muted">Total Leads</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.dmsSent}</p>
            <p className="text-xs text-muted">DMs Sent</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-success">{stats.repliesThisWeek}</p>
            <p className="text-xs text-muted">Replies</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-info">0</p>
            <p className="text-xs text-muted">Calls Booked</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gold">{stats.ghlSynced}</p>
            <p className="text-xs text-muted">GHL Imports</p>
          </div>
        </div>
      </div>
    </div>
  );
}
