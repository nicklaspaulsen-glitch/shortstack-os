"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Client, ContentCalendarEntry } from "@/lib/types";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import {
  Bot, Play, Pause, Calendar, Camera, Music,
  MessageSquare, Sparkles, Send, Clock, CheckCircle,
  Loader, Settings, ArrowRight, Globe, Film,
  Briefcase
} from "lucide-react";
import toast from "react-hot-toast";

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Camera size={14} className="text-pink-400" />,
  facebook: <MessageSquare size={14} className="text-blue-400" />,
  tiktok: <Music size={14} className="text-white" />,
  linkedin: <Briefcase size={14} className="text-blue-300" />,
  youtube: <Film size={14} className="text-red-400" />,
};

export default function SocialManagerPage() {
  useAuth();
  const [clients, setClients] = useState<Array<Client & { accounts: string[] }>>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [autopilot, setAutopilot] = useState<Record<string, boolean>>({});
  const [scheduledPosts, setScheduledPosts] = useState<ContentCalendarEntry[]>([]);
  const [recentPosts, setRecentPosts] = useState<ContentCalendarEntry[]>([]);
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekConfig, setWeekConfig] = useState({ posts_per_day: 1, tone: "professional yet approachable", topics: "" });
  const [tab, setTab] = useState<"dashboard" | "scheduled" | "published" | "config">("dashboard");
  const supabase = createClient();

  useEffect(() => { fetchClients(); }, []);

  useEffect(() => {
    if (selectedClient) fetchPosts();
  }, [selectedClient]);

  async function fetchClients() {
    const { data: cl } = await supabase.from("clients").select("*").eq("is_active", true).order("business_name");
    const clientsWithAccounts = [];
    for (const c of (cl || [])) {
      const { data: accs } = await supabase
        .from("social_accounts")
        .select("platform")
        .eq("client_id", c.id)
        .eq("is_active", true);
      clientsWithAccounts.push({ ...c, accounts: (accs || []).map((a: { platform: string }) => a.platform) });
    }
    setClients(clientsWithAccounts);
    if (clientsWithAccounts.length > 0 && !selectedClient) {
      setSelectedClient(clientsWithAccounts[0].id);
    }

    // Load autopilot state
    const saved = localStorage.getItem("social_autopilot");
    if (saved) setAutopilot(JSON.parse(saved));
    setLoading(false);
  }

  async function fetchPosts() {
    const [{ data: scheduled }, { data: published }] = await Promise.all([
      supabase.from("content_calendar").select("*").eq("client_id", selectedClient).in("status", ["scheduled", "idea"]).order("scheduled_at"),
      supabase.from("content_calendar").select("*").eq("client_id", selectedClient).eq("status", "published").order("scheduled_at", { ascending: false }).limit(20),
    ]);
    setScheduledPosts(scheduled || []);
    setRecentPosts(published || []);
  }

  function toggleAutopilot(clientId: string) {
    const updated = { ...autopilot, [clientId]: !autopilot[clientId] };
    setAutopilot(updated);
    localStorage.setItem("social_autopilot", JSON.stringify(updated));
    toast.success(updated[clientId] ? "Autopilot ON — AI will manage this account" : "Autopilot OFF");
  }

  async function generateWeek() {
    if (!selectedClient) return;
    setGenerating(true);
    toast.loading("AI is creating your content plan...");
    try {
      const res = await fetch("/api/social/generate-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: selectedClient, ...weekConfig }),
      });
      toast.dismiss();
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.posts_generated} posts generated!`);
        fetchPosts();
      } else {
        toast.error(data.error || "Failed to generate");
      }
    } catch {
      toast.dismiss();
      toast.error("Error generating content");
    }
    setGenerating(false);
  }

  async function publishPost(post: ContentCalendarEntry) {
    setPosting(post.id);
    try {
      const meta = (post.metadata as Record<string, unknown>) || {};
      const res = await fetch("/api/social/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient,
          platform: post.platform,
          caption: (meta.caption as string) || post.title,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Posted to ${post.platform}!`);
        // Update status
        await supabase.from("content_calendar").update({ status: "published" }).eq("id", post.id);
        fetchPosts();
      } else {
        toast.error(data.error || "Failed to post");
      }
    } catch {
      toast.error("Posting failed");
    }
    setPosting(null);
  }

  const currentClient = clients.find(c => c.id === selectedClient);
  const isAutopilot = autopilot[selectedClient] || false;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader size={20} className="animate-spin text-gold" />
    </div>
  );

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Bot size={18} className="text-gold" /> AI Social Manager
          </h1>
          <p className="text-xs text-muted mt-0.5">Autonomous AI that creates, schedules, and publishes content</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Client selector */}
          <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
            className="input text-xs py-1.5 min-w-[160px]">
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.business_name}</option>
            ))}
          </select>

          {/* Autopilot toggle */}
          <button onClick={() => toggleAutopilot(selectedClient)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isAutopilot
                ? "bg-success/10 text-success border border-success/20 pulse-ring"
                : "bg-surface-light text-muted border border-border hover:border-gold/20"
            }`}>
            {isAutopilot ? <Play size={12} /> : <Pause size={12} />}
            {isAutopilot ? "Autopilot ON" : "Autopilot OFF"}
          </button>
        </div>
      </div>

      {/* Connected platforms */}
      {currentClient && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted">Connected:</span>
          {currentClient.accounts.length > 0 ? (
            currentClient.accounts.map(p => (
              <div key={p} className="flex items-center gap-1 text-[10px] bg-surface-light px-2 py-0.5 rounded border border-border/30">
                {PLATFORM_ICONS[p] || <Globe size={10} />}
                <span className="capitalize">{p}</span>
              </div>
            ))
          ) : (
            <span className="text-[10px] text-warning">No accounts connected — go to Socials page</span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="tab-group w-fit">
        {(["dashboard", "scheduled", "published", "config"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={tab === t ? "tab-item-active" : "tab-item-inactive"}>
            {t === "dashboard" ? "Dashboard" : t === "scheduled" ? `Queue (${scheduledPosts.length})` : t === "published" ? "Published" : "Settings"}
          </button>
        ))}
      </div>

      {/* Dashboard */}
      {tab === "dashboard" && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <StatCard label="Scheduled" value={scheduledPosts.length} icon={<Calendar size={14} />} />
            <StatCard label="Published" value={recentPosts.length} icon={<CheckCircle size={14} />} changeType="positive" />
            <StatCard label="Platforms" value={currentClient?.accounts.length || 0} icon={<Globe size={14} />} />
            <StatCard label="Autopilot" value={isAutopilot ? "Active" : "Off"} icon={<Bot size={14} />}
              changeType={isAutopilot ? "positive" : "neutral"} />
          </div>

          {/* Generate week */}
          <div className="card border-gold/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-mesh opacity-30" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-gold/10 rounded-lg flex items-center justify-center breathe">
                    <Sparkles size={18} className="text-gold" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Generate This Week</h2>
                    <p className="text-[10px] text-muted">AI creates 7 days of content in one click</p>
                  </div>
                </div>
                <button onClick={generateWeek} disabled={generating}
                  className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                  {generating ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {generating ? "Creating..." : "Generate Week"}
                </button>
              </div>
            </div>
          </div>

          {/* Up next */}
          {scheduledPosts.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-header mb-0 flex items-center gap-2">
                  <Clock size={13} className="text-accent" /> Up Next
                </h2>
                <button onClick={() => setTab("scheduled")} className="text-[10px] text-gold flex items-center gap-0.5">
                  View all <ArrowRight size={10} />
                </button>
              </div>
              <div className="space-y-2">
                {scheduledPosts.slice(0, 5).map(post => {
                  const meta = (post.metadata as Record<string, unknown>) || {};
                  return (
                    <div key={post.id} className="flex items-center gap-3 p-2.5 bg-surface-light/30 rounded-lg border border-border/15 hover:border-gold/10 transition-all">
                      <div className="shrink-0">{PLATFORM_ICONS[post.platform] || <Globe size={14} />}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{post.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-muted capitalize">{post.platform}</span>
                          {post.scheduled_at && <span className="text-[9px] text-muted">{formatDate(post.scheduled_at)}</span>}
                          {meta.best_time && <span className="text-[9px] text-gold">{meta.best_time as string}</span>}
                        </div>
                      </div>
                      <button onClick={() => publishPost(post)} disabled={posting === post.id}
                        className="btn-primary text-[9px] py-1 px-2.5 flex items-center gap-1 disabled:opacity-50">
                        {posting === post.id ? <Loader size={10} className="animate-spin" /> : <Send size={10} />}
                        Post
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent published */}
          {recentPosts.length > 0 && (
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <CheckCircle size={13} className="text-success" /> Recently Published
              </h2>
              <div className="space-y-1.5">
                {recentPosts.slice(0, 5).map(post => (
                  <div key={post.id} className="flex items-center gap-2.5 py-1.5 border-b border-border/10 last:border-0">
                    {PLATFORM_ICONS[post.platform] || <Globe size={12} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] truncate">{post.title}</p>
                      <p className="text-[9px] text-muted">{post.scheduled_at ? formatRelativeTime(post.scheduled_at) : ""}</p>
                    </div>
                    <StatusBadge status="published" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scheduled queue */}
      {tab === "scheduled" && (
        <div className="space-y-2">
          {scheduledPosts.length === 0 ? (
            <div className="card text-center py-8">
              <Calendar size={24} className="mx-auto mb-2 text-muted/30" />
              <p className="text-xs text-muted mb-2">No content scheduled</p>
              <button onClick={generateWeek} className="btn-primary text-xs">Generate This Week</button>
            </div>
          ) : (
            scheduledPosts.map(post => {
              const meta = (post.metadata as Record<string, unknown>) || {};
              return (
                <div key={post.id} className="card-hover p-3">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-1">{PLATFORM_ICONS[post.platform] || <Globe size={14} />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-semibold">{post.title}</p>
                        <StatusBadge status={post.status} />
                      </div>
                      {meta.caption && (
                        <p className="text-[10px] text-muted leading-relaxed mb-2 line-clamp-3">{meta.caption as string}</p>
                      )}
                      <div className="flex items-center gap-3 text-[9px] text-muted">
                        <span className="capitalize">{post.platform}</span>
                        {post.scheduled_at && <span>{formatDate(post.scheduled_at)}</span>}
                        {meta.best_time && <span className="text-gold">{meta.best_time as string}</span>}
                        {meta.topic && <span>{meta.topic as string}</span>}
                      </div>
                    </div>
                    <button onClick={() => publishPost(post)} disabled={posting === post.id}
                      className="btn-primary text-[10px] py-1.5 px-3 flex items-center gap-1 shrink-0 disabled:opacity-50">
                      {posting === post.id ? <Loader size={10} className="animate-spin" /> : <Send size={10} />}
                      Publish
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Published */}
      {tab === "published" && (
        <div className="space-y-2">
          {recentPosts.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-xs text-muted">Nothing published yet</p>
            </div>
          ) : (
            recentPosts.map(post => (
              <div key={post.id} className="card p-3 flex items-center gap-3">
                {PLATFORM_ICONS[post.platform] || <Globe size={14} />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{post.title}</p>
                  <p className="text-[9px] text-muted">{post.scheduled_at ? formatRelativeTime(post.scheduled_at) : ""} · {post.platform}</p>
                </div>
                <StatusBadge status="published" />
              </div>
            ))
          )}
        </div>
      )}

      {/* Config */}
      {tab === "config" && (
        <div className="card max-w-lg space-y-4">
          <h2 className="section-header flex items-center gap-2"><Settings size={13} className="text-gold" /> Content Settings</h2>

          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Posts Per Day</label>
            <input type="number" min={1} max={5} value={weekConfig.posts_per_day}
              onChange={e => setWeekConfig({ ...weekConfig, posts_per_day: parseInt(e.target.value) || 1 })}
              className="input w-full text-xs" />
          </div>

          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Brand Tone</label>
            <select value={weekConfig.tone} onChange={e => setWeekConfig({ ...weekConfig, tone: e.target.value })}
              className="input w-full text-xs">
              <option value="professional yet approachable">Professional & Approachable</option>
              <option value="casual and fun">Casual & Fun</option>
              <option value="authoritative and expert">Authoritative & Expert</option>
              <option value="bold and edgy">Bold & Edgy</option>
              <option value="warm and caring">Warm & Caring</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Topics to Cover</label>
            <textarea value={weekConfig.topics}
              onChange={e => setWeekConfig({ ...weekConfig, topics: e.target.value })}
              className="input w-full h-20 text-xs"
              placeholder="e.g., client results, tips, behind the scenes, promotions, educational content, trending topics" />
          </div>

          <p className="text-[9px] text-muted">These settings apply when generating weekly content. The AI uses your client&apos;s industry, services, and connected platforms to create platform-specific content.</p>
        </div>
      )}
    </div>
  );
}
