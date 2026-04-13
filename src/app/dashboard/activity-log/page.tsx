"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import {
  Activity, Search, Loader,
  Zap, Users, Mail, Globe, Bot, CreditCard
} from "lucide-react";

interface LogEntry {
  id: string;
  agent: string;
  action_type: string;
  description: string;
  status: string;
  client_id: string | null;
  created_at: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  lead_gen: <Zap size={12} className="text-emerald-400" />,
  outreach: <Mail size={12} className="text-blue-400" />,
  content: <Globe size={12} className="text-purple-400" />,
  automation: <Bot size={12} className="text-gold" />,
  custom: <Activity size={12} className="text-gray-400" />,
  appointment: <Users size={12} className="text-cyan-400" />,
  invoice: <CreditCard size={12} className="text-green-400" />,
  website: <Globe size={12} className="text-indigo-400" />,
};

export default function ActivityLogPage() {
  useAuth();
  const supabase = createClient();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchLogs(); }, []);

  async function fetchLogs() {
    setLoading(true);
    const { data } = await supabase
      .from("trinity_log")
      .select("id, agent, action_type, description, status, client_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setLogs(data || []);
    setLoading(false);
  }

  const types = ["all", ...Array.from(new Set(logs.map(l => l.action_type).filter(Boolean)))];
  const filtered = logs
    .filter(l => typeFilter === "all" || l.action_type === typeFilter)
    .filter(l => !search || (l.description || "").toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center py-20"><Loader size={20} className="animate-spin text-gold" /></div>;

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2">
          <Activity size={18} className="text-gold" /> Activity Log
        </h1>
        <p className="text-xs text-muted mt-0.5">{logs.length} events — everything that happened in your agency</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input w-full text-xs pl-8" placeholder="Search activity..." />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input text-xs w-40">
          {types.map(t => <option key={t} value={t}>{t === "all" ? "All Types" : t.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      <div className="space-y-1">
        {filtered.length === 0 ? (
          <div className="card text-center py-12">
            <Activity size={24} className="mx-auto mb-2 text-muted/30" />
            <p className="text-xs text-muted">No activity found</p>
          </div>
        ) : (
          filtered.map(log => (
            <div key={log.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.01] transition-colors border-b border-border">
              <div className="mt-0.5 shrink-0">
                {TYPE_ICONS[log.action_type] || <Activity size={12} className="text-muted" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] leading-relaxed">{log.description || "No description"}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[8px] text-muted">{formatRelativeTime(log.created_at)}</span>
                  {log.agent && <span className="text-[8px] text-muted/50 capitalize">{log.agent.replace(/-/g, " ")}</span>}
                  <span className={`text-[7px] px-1.5 py-0.5 rounded-full ${
                    log.status === "completed" || log.status === "success" ? "bg-success/10 text-success" :
                    log.status === "error" ? "bg-danger/10 text-danger" :
                    "bg-warning/10 text-warning"
                  }`}>{log.status}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
