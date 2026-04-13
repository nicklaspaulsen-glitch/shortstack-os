"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Briefing } from "@/lib/types";
import { PageLoading } from "@/components/ui/loading";
import EmptyState from "@/components/ui/empty-state";
import { formatRelativeTime } from "@/lib/utils";
import { Sun, RefreshCw, Zap, MessageSquare, Users, DollarSign, Bot, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

interface BriefingContent {
  leads: { scraped_since: number; total: number };
  outreach: { sent_since: number; replies: number };
  team: { messages: number; active_members: number };
  clients: { updates: number; deliverables_pending: number };
  trinity: { actions_since: number };
  system: { issues: number; details: string[] };
  revenue: { new_deals: number; mrr_change: number; total_mrr: number };
  summary: string;
}

export default function BriefingPage() {
  const { profile } = useAuth();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchLatestBriefing();
    generateBriefingOnLogin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchLatestBriefing() {
    if (!profile) return;
    try {
      setLoading(true);
      const { data } = await supabase
        .from("briefings")
        .select("*")
        .eq("user_id", profile.id)
        .order("generated_at", { ascending: false })
        .limit(1)
        .single();
      setBriefing(data);
    } catch (err) {
      console.error("[BriefingPage] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function generateBriefingOnLogin() {
    // Auto-generate on admin login
    if (!profile || profile.role !== "admin") return;

    // Check if briefing exists for today
    const today = new Date().toISOString().split("T")[0];
    const { data: existing } = await supabase
      .from("briefings")
      .select("id")
      .eq("user_id", profile.id)
      .gte("generated_at", today)
      .limit(1);

    if (existing && existing.length > 0) return;

    await generateBriefing();
  }

  async function generateBriefing() {
    setGenerating(true);
    try {
      const res = await fetch("/api/briefing/generate", { method: "POST" });
      if (res.ok) {
        toast.success("Briefing generated");
        fetchLatestBriefing();
      } else {
        toast.error("Failed to generate briefing");
      }
    } catch {
      toast.error("Error generating briefing");
    }
    setGenerating(false);
  }

  if (loading) return <PageLoading />;

  const content = briefing?.content as unknown as BriefingContent | null;

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center">
            <Sun size={28} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Morning Briefing</h1>
            <p className="text-muted text-sm">
              {briefing ? `Generated ${formatRelativeTime(briefing.generated_at)}` : "No briefing yet"}
            </p>
          </div>
        </div>
        <button onClick={generateBriefing} disabled={generating} className="btn-primary flex items-center gap-2 disabled:opacity-50">
          <RefreshCw size={16} className={generating ? "animate-spin" : ""} />
          {generating ? "Generating..." : "Refresh Briefing"}
        </button>
      </div>

      {!content ? (
        <EmptyState
          icon={<Sun size={48} />}
          title="No briefing available"
          description="Click 'Refresh Briefing' to generate your morning briefing."
          action={
            <button onClick={generateBriefing} className="btn-primary">Generate Now</button>
          }
        />
      ) : (
        <>
          {/* AI Summary */}
          {content.summary && (
            <div className="card bg-gold/5 border-gold/20">
              <p className="text-sm leading-relaxed">{content.summary}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Leads */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={18} className="text-gold" />
                <h3 className="font-medium">Lead Engine</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">New leads scraped</span>
                  <span className="font-medium">{content.leads?.scraped_since || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Total in database</span>
                  <span>{content.leads?.total || 0}</span>
                </div>
              </div>
            </div>

            {/* Outreach */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={18} className="text-gold" />
                <h3 className="font-medium">Outreach</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">DMs sent</span>
                  <span className="font-medium">{content.outreach?.sent_since || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Replies received</span>
                  <span className="text-success">{content.outreach?.replies || 0}</span>
                </div>
              </div>
            </div>

            {/* Team */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Users size={18} className="text-gold" />
                <h3 className="font-medium">Team Activity</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Active members</span>
                  <span>{content.team?.active_members || 0}</span>
                </div>
              </div>
            </div>

            {/* Clients */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Users size={18} className="text-gold" />
                <h3 className="font-medium">Client Updates</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Updates since last login</span>
                  <span>{content.clients?.updates || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Pending deliverables</span>
                  <span className="text-warning">{content.clients?.deliverables_pending || 0}</span>
                </div>
              </div>
            </div>

            {/* Trinity */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Bot size={18} className="text-gold" />
                <h3 className="font-medium">Trinity Actions</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Actions taken</span>
                  <span>{content.trinity?.actions_since || 0}</span>
                </div>
              </div>
            </div>

            {/* Revenue */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign size={18} className="text-gold" />
                <h3 className="font-medium">Revenue</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">New deals closed</span>
                  <span className="text-success font-medium">{content.revenue?.new_deals || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Total MRR</span>
                  <span className="font-bold text-gold">${(content.revenue?.total_mrr || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* System Issues */}
          {(content.system?.issues || 0) > 0 && (
            <div className="card border-danger/20">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-danger" />
                <h3 className="font-medium text-danger">System Issues</h3>
              </div>
              <ul className="space-y-1 text-sm">
                {content.system?.details?.map((d, i) => (
                  <li key={i} className="text-danger">&bull; {d}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
