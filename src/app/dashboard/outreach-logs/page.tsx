"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import { formatRelativeTime } from "@/lib/utils";
import {
  MessageSquare, Mail, Phone, Camera, Music, Briefcase,
  Globe, Search, Download,
  CheckCircle, XCircle, Clock, Send, Eye
} from "lucide-react";
import toast from "react-hot-toast";

interface OutreachEntry {
  id: string;
  lead_id: string;
  platform: string;
  business_name: string;
  recipient_handle: string;
  message_text: string;
  status: string;
  reply_text: string | null;
  replied_at: string | null;
  sent_at: string;
  source: string;
  ai_generated: boolean;
  metadata: Record<string, unknown>;
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Camera size={14} className="text-pink-400" />,
  facebook: <MessageSquare size={14} className="text-blue-400" />,
  tiktok: <Music size={14} className="text-white" />,
  linkedin: <Briefcase size={14} className="text-blue-400" />,
  email: <Mail size={14} className="text-gold" />,
  call: <Phone size={14} className="text-green-400" />,
};

export default function OutreachLogsPage() {
  useAuth();
  const [entries, setEntries] = useState<OutreachEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, sent: 0, replied: 0, bounced: 0, pending: 0 });
  const supabase = createClient();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchLogs(); }, [filter, statusFilter]);

  async function fetchLogs() {
    setLoading(true);
    let query = supabase
      .from("outreach_log")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(200);

    if (filter !== "all") query = query.eq("platform", filter);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);

    const { data } = await query;
    setEntries(data || []);

    // Stats
    const all = data || [];
    setStats({
      total: all.length,
      sent: all.filter(e => e.status === "sent" || e.status === "delivered").length,
      replied: all.filter(e => e.status === "replied").length,
      bounced: all.filter(e => e.status === "bounced" || e.status === "failed").length,
      pending: all.filter(e => e.status === "pending").length,
    });

    setLoading(false);
  }

  const filtered = entries.filter(e =>
    !search || e.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.recipient_handle?.toLowerCase().includes(search.toLowerCase()) ||
    e.message_text?.toLowerCase().includes(search.toLowerCase())
  );

  const replyRate = stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0;

  function exportCSV() {
    const csv = "Business,Platform,Handle,Status,Message,Reply,Sent At\n" +
      filtered.map(e => `"${e.business_name}","${e.platform}","${e.recipient_handle}","${e.status}","${(e.message_text || "").replace(/"/g, '""').substring(0, 200)}","${(e.reply_text || "").replace(/"/g, '""')}","${e.sent_at}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "outreach_logs.csv"; a.click();
    toast.success("Exported");
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Send size={18} className="text-gold" /> Outreach Logs
          </h1>
          <p className="text-xs text-muted mt-0.5">Every DM, email, and call — tracked and logged by AI</p>
        </div>
        <button onClick={exportCSV} className="btn-secondary text-xs flex items-center gap-1.5">
          <Download size={12} /> Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <StatCard label="Total Sent" value={stats.total} icon={<Send size={14} />} />
        <StatCard label="Delivered" value={stats.sent} icon={<CheckCircle size={14} />} changeType="positive" />
        <StatCard label="Replied" value={stats.replied} icon={<MessageSquare size={14} />}
          change={`${replyRate}% rate`} changeType={replyRate >= 5 ? "positive" : "neutral"} />
        <StatCard label="Bounced" value={stats.bounced} icon={<XCircle size={14} />}
          changeType={stats.bounced > 0 ? "negative" : "positive"} />
        <StatCard label="Pending" value={stats.pending} icon={<Clock size={14} />} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Platform filter */}
        <div className="tab-group">
          {["all", "instagram", "facebook", "linkedin", "tiktok", "email"].map(p => (
            <button key={p} onClick={() => setFilter(p)}
              className={filter === p ? "tab-item-active" : "tab-item-inactive"}>
              <span className="flex items-center gap-1">
                {p !== "all" && PLATFORM_ICONS[p]}
                {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
              </span>
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input text-xs py-1.5">
          <option value="all">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="replied">Replied</option>
          <option value="bounced">Bounced</option>
          <option value="pending">Pending</option>
        </select>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search business, handle, message..."
            className="input w-full pl-8 text-xs py-1.5" />
        </div>
      </div>

      {/* Log entries */}
      <div className="space-y-1.5">
        {loading ? (
          <div className="card text-center py-8 text-xs text-muted">Loading logs...</div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-8">
            <Send size={24} className="mx-auto mb-2 text-muted/30" />
            <p className="text-xs text-muted">No outreach logs yet</p>
            <p className="text-[10px] text-muted/60 mt-1">Logs appear here when DMs, emails, or calls are sent</p>
          </div>
        ) : (
          filtered.map(entry => {
            const isExpanded = expandedId === entry.id;
            return (
              <div key={entry.id}
                className={`card p-3 transition-all duration-200 cursor-pointer ${
                  entry.status === "replied" ? "border-success/15" :
                  entry.status === "bounced" ? "border-danger/15" : ""
                }`}
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
              >
                <div className="flex items-center gap-3">
                  {/* Platform icon */}
                  <div className="shrink-0">
                    {PLATFORM_ICONS[entry.platform] || <Globe size={14} className="text-muted" />}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium truncate">{entry.business_name || "Unknown"}</p>
                      {entry.ai_generated && (
                        <span className="text-[8px] bg-gold/10 text-gold px-1 py-0.5 rounded">AI</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted truncate">
                      {entry.recipient_handle} · {entry.platform}
                    </p>
                  </div>

                  {/* Status + time */}
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={entry.status} />
                    <span className="text-[9px] text-muted font-mono">{formatRelativeTime(entry.sent_at)}</span>
                    <Eye size={11} className={`transition-transform ${isExpanded ? "rotate-180 text-gold" : "text-muted"}`} />
                  </div>
                </div>

                {/* Expanded view */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2 slide-up">
                    {/* Sent message */}
                    <div>
                      <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Message Sent</p>
                      <div className="bg-gold/[0.03] border border-gold/10 rounded-lg p-2.5">
                        <p className="text-[11px] whitespace-pre-wrap leading-relaxed">{entry.message_text}</p>
                      </div>
                    </div>

                    {/* Reply */}
                    {entry.reply_text && (
                      <div>
                        <p className="text-[9px] text-success uppercase tracking-wider mb-1">Reply Received</p>
                        <div className="bg-success/[0.03] border border-success/10 rounded-lg p-2.5">
                          <p className="text-[11px] whitespace-pre-wrap leading-relaxed">{entry.reply_text}</p>
                          {entry.replied_at && (
                            <p className="text-[9px] text-muted mt-1">{formatRelativeTime(entry.replied_at)}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-3 text-[9px] text-muted">
                      <span>Source: {entry.source || "manual"}</span>
                      <span>Platform: {entry.platform}</span>
                      {entry.ai_generated && <span className="text-gold">AI Generated</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
