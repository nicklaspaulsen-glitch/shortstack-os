"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Search, Download, Activity, CheckCircle, AlertTriangle,
  Clock, Filter, Zap, Users, Mail, FileText, Globe, Settings, Bot
} from "lucide-react";
import toast from "react-hot-toast";

interface AuditEntry {
  id: string;
  action_type: string;
  description: string;
  status: string;
  created_at: string;
  client_id: string | null;
}

const AGENT_MAP: Record<string, { name: string; icon: React.ReactNode }> = {
  lead_gen: { name: "Lead Finder", icon: <Users size={12} className="text-blue-400" /> },
  outreach: { name: "Outreach Agent", icon: <Mail size={12} className="text-pink-400" /> },
  content: { name: "Content Engine", icon: <FileText size={12} className="text-purple-400" /> },
  automation: { name: "Automation Bot", icon: <Zap size={12} className="text-yellow-400" /> },
  website: { name: "Website Builder", icon: <Globe size={12} className="text-green-400" /> },
  system: { name: "System", icon: <Settings size={12} className="text-muted" /> },
  custom: { name: "Custom Agent", icon: <Bot size={12} className="text-gold" /> },
};

const FILTER_TABS = ["All", "Lead Gen", "Outreach", "Content", "Automation", "Website", "Custom"] as const;
const TAB_TO_TYPE: Record<string, string> = {
  "Lead Gen": "lead_gen",
  "Outreach": "outreach",
  "Content": "content",
  "Automation": "automation",
  "Website": "website",
  "Custom": "custom",
};

const DATE_RANGES = [
  { label: "Today", days: 1 },
  { label: "7 Days", days: 7 },
  { label: "30 Days", days: 30 },
  { label: "All Time", days: 0 },
];

function getAgent(actionType: string) {
  return AGENT_MAP[actionType] || AGENT_MAP.system;
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default function AuditPage() {
  useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState(0);
  const [stats, setStats] = useState({ total: 0, successRate: 0, mostActive: "", today: 0 });
  const supabase = createClient();

  useEffect(() => { fetchAudit(); }, [activeTab, dateRange]);

  async function fetchAudit() {
    setLoading(true);
    let query = supabase
      .from("trinity_log")
      .select("id, action_type, description, status, created_at, client_id")
      .order("created_at", { ascending: false })
      .limit(100);

    if (activeTab !== "All" && TAB_TO_TYPE[activeTab]) {
      query = query.eq("action_type", TAB_TO_TYPE[activeTab]);
    }

    if (dateRange > 0) {
      const since = new Date(Date.now() - dateRange * 86400000).toISOString();
      query = query.gte("created_at", since);
    }

    const { data } = await query;
    const all = data || [];
    setEntries(all);

    const successes = all.filter(e => e.status === "success" || e.status === "completed").length;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayCount = all.filter(e => new Date(e.created_at) >= todayStart).length;

    const typeCounts: Record<string, number> = {};
    all.forEach(e => { typeCounts[e.action_type] = (typeCounts[e.action_type] || 0) + 1; });
    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];

    setStats({
      total: all.length,
      successRate: all.length > 0 ? Math.round((successes / all.length) * 100) : 0,
      mostActive: topType ? getAgent(topType[0]).name : "None",
      today: todayCount,
    });

    setLoading(false);
  }

  const filtered = entries.filter(e =>
    !search || e.description?.toLowerCase().includes(search.toLowerCase())
  );

  function exportCSV() {
    const csv = "Timestamp,Agent,Description,Status,Client ID\n" +
      filtered.map(e =>
        `"${e.created_at}","${getAgent(e.action_type).name}","${(e.description || "").replace(/"/g, '""')}","${e.status}","${e.client_id || ""}"`
      ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit_trail.csv"; a.click();
    toast.success("Exported audit trail");
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Activity size={18} className="text-gold" /> Audit Trail
          </h1>
          <p className="text-xs text-muted mt-0.5">Complete activity history across all AI agents</p>
        </div>
        <button onClick={exportCSV} className="btn-primary text-xs flex items-center gap-1.5">
          <Download size={12} /> Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="card p-3">
          <p className="text-[10px] text-muted uppercase tracking-wider">Total Actions</p>
          <p className="text-lg font-bold text-gold">{stats.total}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-muted uppercase tracking-wider">Success Rate</p>
          <p className="text-lg font-bold text-green-400">{stats.successRate}%</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-muted uppercase tracking-wider">Most Active Agent</p>
          <p className="text-xs font-semibold mt-1">{stats.mostActive}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-muted uppercase tracking-wider">Actions Today</p>
          <p className="text-lg font-bold">{stats.today}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-card/50 rounded-lg p-0.5">
          {FILTER_TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                activeTab === tab ? "bg-gold/20 text-gold" : "text-muted hover:text-foreground"
              }`}>
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Filter size={11} className="text-muted" />
          {DATE_RANGES.map(dr => (
            <button key={dr.label} onClick={() => setDateRange(dr.days)}
              className={`px-2 py-1 rounded text-[10px] transition-colors ${
                dateRange === dr.days ? "bg-gold/20 text-gold" : "text-muted hover:text-foreground"
              }`}>
              {dr.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search activity..."
            className="input w-full pl-8 text-xs py-1.5" />
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-1.5">
        {loading ? (
          <div className="card text-center py-8 text-xs text-muted">Loading audit trail...</div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-8">
            <Activity size={24} className="mx-auto mb-2 text-muted/30" />
            <p className="text-xs text-muted">No activity found</p>
            <p className="text-[10px] text-muted/60 mt-1">Activity from AI agents will appear here</p>
          </div>
        ) : (
          filtered.map(entry => {
            const agent = getAgent(entry.action_type);
            return (
              <div key={entry.id} className="card card-hover p-3 flex items-center gap-3">
                <div className="shrink-0 w-6 h-6 rounded-full bg-card flex items-center justify-center">
                  {agent.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gold">{agent.name}</span>
                    <span className="text-[9px] text-muted font-mono">{formatTimestamp(entry.created_at)}</span>
                  </div>
                  <p className="text-xs truncate mt-0.5">{entry.description || "No description"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {entry.client_id && (
                    <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">Client</span>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                    entry.status === "success" || entry.status === "completed"
                      ? "bg-green-500/10 text-green-400"
                      : entry.status === "failed"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-yellow-500/10 text-yellow-400"
                  }`}>
                    {entry.status === "success" || entry.status === "completed"
                      ? <CheckCircle size={9} />
                      : entry.status === "failed"
                      ? <AlertTriangle size={9} />
                      : <Clock size={9} />}
                    {entry.status}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
