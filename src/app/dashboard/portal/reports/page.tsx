"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import StatCard from "@/components/ui/stat-card";
import { PageLoading } from "@/components/ui/loading";
import { formatRelativeTime } from "@/lib/utils";
import {
  BarChart3, TrendingUp, Film, Zap, Calendar
} from "lucide-react";

export default function ClientReportsPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ contentPublished: 0, totalContent: 0, campaigns: 0, tasksCompleted: 0, totalTasks: 0 });
  const [recentActions, setRecentActions] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (profile) fetchReports();
  }, [profile]);

  async function fetchReports() {
    const { data: clientData } = await supabase.from("clients").select("id").eq("profile_id", profile!.id).single();
    if (!clientData) { setLoading(false); return; }

    const [
      { count: contentPublished },
      { count: totalContent },
      { count: campaigns },
      { count: tasksCompleted },
      { count: totalTasks },
      { data: actions },
    ] = await Promise.all([
      supabase.from("content_calendar").select("*", { count: "exact", head: true }).eq("client_id", clientData.id).eq("status", "published"),
      supabase.from("content_calendar").select("*", { count: "exact", head: true }).eq("client_id", clientData.id),
      supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("client_id", clientData.id),
      supabase.from("client_tasks").select("*", { count: "exact", head: true }).eq("client_id", clientData.id).eq("is_completed", true),
      supabase.from("client_tasks").select("*", { count: "exact", head: true }).eq("client_id", clientData.id),
      supabase.from("trinity_log").select("description, status, created_at, action_type").eq("client_id", clientData.id).order("created_at", { ascending: false }).limit(20),
    ]);

    setStats({
      contentPublished: contentPublished || 0,
      totalContent: totalContent || 0,
      campaigns: campaigns || 0,
      tasksCompleted: tasksCompleted || 0,
      totalTasks: totalTasks || 0,
    });
    setRecentActions(actions || []);
    setLoading(false);
  }

  if (loading) return <PageLoading />;

  const completionRate = stats.totalTasks > 0 ? Math.round((stats.tasksCompleted / stats.totalTasks) * 100) : 0;

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2"><BarChart3 size={18} className="text-success" /> Reports</h1>
        <p className="text-xs text-muted mt-0.5">Performance overview and activity log</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatCard label="Content Published" value={stats.contentPublished} icon={<Film size={14} />} change={`${stats.totalContent} total`} changeType="positive" />
        <StatCard label="Active Campaigns" value={stats.campaigns} icon={<Zap size={14} />} />
        <StatCard label="Task Completion" value={`${completionRate}%`} icon={<TrendingUp size={14} />} changeType={completionRate >= 80 ? "positive" : completionRate >= 50 ? "neutral" : "negative"} />
        <StatCard label="AI Actions" value={recentActions.length} icon={<Zap size={14} />} change="this month" />
      </div>

      {/* Progress bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="section-header mb-0">Project Progress</h2>
          <span className="text-[10px] font-mono text-gold">{stats.tasksCompleted}/{stats.totalTasks} tasks</span>
        </div>
        <div className="w-full bg-surface-light rounded-full h-2.5">
          <div className="bg-gradient-gold rounded-full h-2.5 transition-all" style={{ width: `${completionRate}%` }} />
        </div>
      </div>

      {/* Activity log */}
      <div className="card">
        <h2 className="section-header flex items-center gap-2">
          <Calendar size={13} className="text-gold" /> Activity Log
        </h2>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {recentActions.length === 0 ? (
            <p className="text-xs text-muted py-4 text-center">No activity recorded yet</p>
          ) : (
            recentActions.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2 border-b border-border/15 last:border-0">
                <div className="w-6 h-6 bg-gold/10 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                  <Zap size={10} className="text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs">{a.description as string}</p>
                  <p className="text-[9px] text-muted mt-0.5">{formatRelativeTime(a.created_at as string)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
