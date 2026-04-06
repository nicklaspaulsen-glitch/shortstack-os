"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import {
  Search, Send, Film, Camera, Megaphone, Zap, Bot, Phone,
  Globe, CheckCircle, XCircle, Clock, Sparkles
} from "lucide-react";

interface AgentLog {
  id: string;
  action_type: string;
  description: string;
  status: string;
  created_at: string;
  client_id: string | null;
}

const AGENT_MAP: Record<string, { name: string; icon: React.ReactNode; color: string }> = {
  lead_gen: { name: "Scout", icon: <Search size={10} />, color: "text-gold" },
  automation: { name: "Nexus", icon: <Zap size={10} />, color: "text-purple-400" },
  website: { name: "Pixel", icon: <Globe size={10} />, color: "text-cyan-400" },
  custom: { name: "Trinity", icon: <Bot size={10} />, color: "text-gold" },
  ai_receptionist: { name: "Ring", icon: <Phone size={10} />, color: "text-green-400" },
  content: { name: "Pixel", icon: <Film size={10} />, color: "text-pink-400" },
  outreach: { name: "Echo", icon: <Send size={10} />, color: "text-blue-400" },
  social: { name: "Wave", icon: <Camera size={10} />, color: "text-emerald-400" },
  ads: { name: "Blaze", icon: <Megaphone size={10} />, color: "text-amber-400" },
  insights: { name: "Nexus", icon: <Sparkles size={10} />, color: "text-purple-400" },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle size={8} className="text-success" />,
  failed: <XCircle size={8} className="text-danger" />,
  in_progress: <Clock size={8} className="text-warning animate-pulse" />,
};

export default function AgentActivityFeed({ clientId }: { clientId?: string | null }) {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const supabase = createClient();

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 15000);
    return () => clearInterval(interval);
  }, [clientId]);

  async function fetchLogs() {
    let query = supabase
      .from("trinity_log")
      .select("id, action_type, description, status, created_at, client_id")
      .order("created_at", { ascending: false })
      .limit(15);

    if (clientId) query = query.eq("client_id", clientId);
    const { data } = await query;
    setLogs(data || []);
  }

  if (logs.length === 0) return null;

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] text-muted uppercase tracking-[0.15em] font-bold flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          Agent Activity
        </h3>
        <span className="text-[8px] text-muted">Live</span>
      </div>
      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {logs.map((log, i) => {
          const agent = AGENT_MAP[log.action_type] || { name: "Agent", icon: <Bot size={10} />, color: "text-muted" };
          return (
            <div key={log.id} className={`flex items-start gap-2 py-1.5 ${i < logs.length - 1 ? "border-b border-border/10" : ""}`}
              style={{ animationDelay: `${i * 0.05}s` }}>
              <div className={`shrink-0 mt-0.5 ${agent.color}`}>{agent.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className={`text-[9px] font-semibold ${agent.color}`}>{agent.name}</span>
                  {STATUS_ICONS[log.status] || null}
                </div>
                <p className="text-[9px] text-muted truncate">{log.description}</p>
              </div>
              <span className="text-[7px] text-muted/50 shrink-0">{formatRelativeTime(log.created_at)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
