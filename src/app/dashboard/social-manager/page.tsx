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
  Briefcase, Lightbulb, Video, LayoutGrid, FileText as FileTextIcon,
  ToggleLeft, ToggleRight, Zap, Shield, Activity, Hash
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Camera size={14} className="text-pink-400" />,
  facebook: <MessageSquare size={14} className="text-blue-400" />,
  tiktok: <Music size={14} className="text-white" />,
  linkedin: <Briefcase size={14} className="text-blue-400" />,
  youtube: <Film size={14} className="text-red-400" />,
};

export default function SocialManagerPage() {
  useAuth();
  const [clients, setClients] = useState<Array<Client & { accounts: string[] }>>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [scheduledPosts, setScheduledPosts] = useState<ContentCalendarEntry[]>([]);
  const [recentPosts, setRecentPosts] = useState<ContentCalendarEntry[]>([]);
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekConfig, setWeekConfig] = useState({ posts_per_day: 1, tone: "professional yet approachable", topics: "" });
  const [tab, setTab] = useState<"dashboard" | "scheduled" | "published" | "config">("dashboard");
  const [suggestions, setSuggestions] = useState<Array<{ id: string; description: string; status: string; metadata: Record<string, unknown>; created_at: string }>>([]);
  const [autopilotConfig, setAutopilotConfig] = useState<Record<string, unknown>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [runningAutopilot, setRunningAutopilot] = useState(false);
  const supabase = createClient();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchClients(); fetchAutopilotConfig(); }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchPosts();
      fetchSuggestions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient]);

  async function fetchClients() {
    try {
      setLoading(true);
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
    } catch (err) {
      console.error("[SocialManagerPage] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAutopilotConfig() {
    try {
      const res = await fetch("/api/social/autopilot");
      const data = await res.json();
      setAutopilotConfig(data.config || {});
    } catch { /* silent */ }
  }

  async function saveAutopilotSetting(updates: Record<string, unknown>) {
    setSavingConfig(true);
    const newConfig = { ...autopilotConfig, ...updates };
    setAutopilotConfig(newConfig);
    try {
      await fetch("/api/social/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_config", config: newConfig }),
      });
      toast.success("Settings saved");
    } catch { toast.error("Failed to save"); }
    setSavingConfig(false);
  }

  async function runSocialAutopilot() {
    setRunningAutopilot(true);
    try {
      const res = await fetch("/api/social/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run" }),
      });
      const data = await res.json();
      if (data.skipped) { toast.error(data.reason || "Autopilot skipped"); }
      else {
        toast.success(`Autopilot: ${data.content_generated || 0} generated, ${data.posts_published || 0} published`);
        fetchPosts();
      }
    } catch { toast.error("Autopilot error"); }
    setRunningAutopilot(false);
  }

  async function fetchPosts() {
    const [{ data: scheduled }, { data: published }] = await Promise.all([
      supabase.from("content_calendar").select("*").eq("client_id", selectedClient).in("status", ["scheduled", "idea"]).order("scheduled_at"),
      supabase.from("content_calendar").select("*").eq("client_id", selectedClient).eq("status", "published").order("scheduled_at", { ascending: false }).limit(20),
    ]);
    setScheduledPosts(scheduled || []);
    setRecentPosts(published || []);
  }

  async function fetchSuggestions() {
    if (!selectedClient) return;
    try {
      const res = await fetch(`/api/ai/content-suggestions?client_id=${selectedClient}`);
      const data = await res.json();
      setSuggestions((data.suggestions || []).filter((s: { status: string }) => s.status === "pending"));
    } catch { /* best-effort */ }
  }

  function toggleAutopilot() {
    saveAutopilotSetting({ enabled: !autopilotConfig.enabled });
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
  const isAutopilot = !!autopilotConfig.enabled;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader size={20} className="animate-spin text-gold" />
    </div>
  );

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Bot size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Social Manager</h1>
            <p className="text-xs text-muted">Autonomous AI that creates, schedules & publishes content</p>
          </div>
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
          <button onClick={() => toggleAutopilot()}
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
              <div key={p} className="flex items-center gap-1 text-[10px] bg-surface-light px-2 py-0.5 rounded border border-border">
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

          {/* AI Content Suggestions */}
          {suggestions.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-header mb-0 flex items-center gap-2">
                  <Lightbulb size={13} className="text-gold" /> AI Suggestions
                </h2>
                <span className="text-[9px] text-muted">{suggestions.length} ideas</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {suggestions.slice(0, 6).map(s => {
                  const meta = s.metadata || {};
                  const typeIcon: Record<string, React.ReactNode> = {
                    short_video: <Video size={12} className="text-pink-400" />,
                    carousel: <LayoutGrid size={12} className="text-blue-400" />,
                    script: <FileTextIcon size={12} className="text-yellow-400" />,
                    reel: <Film size={12} className="text-purple-400" />,
                    story: <Camera size={12} className="text-orange-400" />,
                    post: <MessageSquare size={12} className="text-green-400" />,
                    thread: <FileTextIcon size={12} className="text-cyan-400" />,
                  };
                  return (
                    <div key={s.id} className="p-2.5 bg-surface-light rounded-lg border border-border hover:border-gold/10 transition-all">
                      <div className="flex items-center gap-2 mb-1">
                        {typeIcon[String(meta.type)] || <Sparkles size={12} className="text-gold" />}
                        <span className="text-[10px] font-medium text-gold uppercase">{String(meta.type || "").replace("_", " ")}</span>
                        <span className="text-[9px] text-muted ml-auto capitalize">{String(meta.platform || "")}</span>
                      </div>
                      <p className="text-xs font-medium truncate">{String(meta.title || s.description)}</p>
                      <p className="text-[10px] text-muted mt-0.5 line-clamp-2">{String(meta.description || "")}</p>
                      {typeof meta.hook === "string" && meta.hook && (
                        <p className="text-[10px] text-foreground/70 mt-1 italic border-l-2 border-gold/30 pl-2">&ldquo;{meta.hook}&rdquo;</p>
                      )}
                      {Array.isArray(meta.tags) && (
                        <div className="flex gap-1 mt-1.5">
                          {(meta.tags as string[]).map(tag => (
                            <span key={tag} className="text-[8px] text-muted bg-surface px-1.5 py-0.5 rounded">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Up next */}
          {scheduledPosts.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-header mb-0 flex items-center gap-2">
                  <Clock size={13} className="text-gold" /> Up Next
                </h2>
                <button onClick={() => setTab("scheduled")} className="text-[10px] text-gold flex items-center gap-0.5">
                  View all <ArrowRight size={10} />
                </button>
              </div>
              <div className="space-y-2">
                {scheduledPosts.slice(0, 5).map(post => {
                  const meta = (post.metadata as Record<string, unknown>) || {};
                  return (
                    <div key={post.id} className="flex items-center gap-3 p-2.5 bg-surface-light rounded-lg border border-border hover:border-gold/10 transition-all">
                      <div className="shrink-0">{PLATFORM_ICONS[post.platform] || <Globe size={14} />}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{post.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-muted capitalize">{post.platform}</span>
                          {post.scheduled_at && <span className="text-[9px] text-muted">{formatDate(post.scheduled_at)}</span>}
                          {meta.best_time ? <span className="text-[9px] text-gold">{String(meta.best_time)}</span> : null}
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
                  <div key={post.id} className="flex items-center gap-2.5 py-1.5 border-b border-border last:border-0">
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
                      {meta.caption ? (
                        <p className="text-[10px] text-muted leading-relaxed mb-2 line-clamp-3">{String(meta.caption)}</p>
                      ) : null}
                      <div className="flex items-center gap-3 text-[9px] text-muted">
                        <span className="capitalize">{post.platform}</span>
                        {post.scheduled_at && <span>{formatDate(post.scheduled_at)}</span>}
                        {meta.best_time ? <span className="text-gold">{String(meta.best_time)}</span> : null}
                        {meta.topic ? <span>{String(meta.topic)}</span> : null}
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

      {/* Config / Autopilot Settings */}
      {tab === "config" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Content Generation Settings */}
          <div className="card-static space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Settings size={13} className="text-gold" /> Content Settings</h2>

            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Posts Per Day</label>
              <input type="number" min={1} max={5} value={weekConfig.posts_per_day}
                onChange={e => setWeekConfig({ ...weekConfig, posts_per_day: parseInt(e.target.value) || 1 })}
                className="input w-full text-xs" />
            </div>

            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Brand Tone</label>
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
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Topics to Cover</label>
              <textarea value={weekConfig.topics}
                onChange={e => setWeekConfig({ ...weekConfig, topics: e.target.value })}
                className="input w-full h-20 text-xs"
                placeholder="e.g., client results, tips, behind the scenes, promotions, educational content, trending topics" />
            </div>

            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Topics to Avoid</label>
              <input value={String(autopilotConfig.blacklist_topics || "")}
                onChange={e => saveAutopilotSetting({ blacklist_topics: e.target.value })}
                className="input w-full text-xs"
                placeholder="e.g., politics, religion, competitors by name" />
            </div>

            <p className="text-[9px] text-muted">These settings apply when generating content. AI uses your client&apos;s industry, services, and connected platforms to create platform-specific content.</p>
          </div>

          {/* Autopilot Controls */}
          <div className="space-y-4">
            <div className="card-static border-gold/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bot size={16} className="text-gold" />
                  <h2 className="text-sm font-semibold">Social Autopilot</h2>
                </div>
                <button onClick={toggleAutopilot} disabled={savingConfig}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isAutopilot ? "bg-success/10 text-success border border-success/20" : "bg-surface-light text-muted border border-border"
                  }`}>
                  {isAutopilot ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {isAutopilot ? "ON" : "OFF"}
                </button>
              </div>

              <p className="text-[10px] text-muted mb-3">AI automatically generates content, schedules posts, and publishes when the time comes. Control exactly what it can do.</p>

              <button onClick={runSocialAutopilot} disabled={runningAutopilot || !isAutopilot}
                className="btn-primary w-full text-xs flex items-center justify-center gap-2 mb-4 disabled:opacity-50">
                {runningAutopilot ? <><Loader size={12} className="animate-spin" /> Running...</> : <><Zap size={12} /> Run Autopilot Now</>}
              </button>

              {/* Granular controls */}
              <div className="space-y-2">
                <p className="text-[9px] text-muted font-semibold uppercase tracking-wider">Allowed Actions</p>
                {[
                  { key: "auto_generate_content", label: "Auto-generate content", desc: "AI creates posts when queue is low", icon: <Sparkles size={11} className="text-gold" /> },
                  { key: "auto_publish_scheduled", label: "Auto-publish on schedule", desc: "Publish posts when scheduled time arrives", icon: <Send size={11} className="text-blue-400" /> },
                  { key: "auto_reply_comments", label: "Auto-reply to comments", desc: "AI responds to comments & DMs", icon: <MessageSquare size={11} className="text-green-400" /> },
                  { key: "auto_hashtag_research", label: "Trending hashtag research", desc: "AI finds trending hashtags for posts", icon: <Hash size={11} className="text-purple-400" /> },
                  { key: "require_approval", label: "Require approval before post", desc: "Posts go to queue for review first", icon: <Shield size={11} className="text-orange-400" /> },
                ].map(toggle => (
                  <div key={toggle.key} className="flex items-center justify-between p-2 rounded-lg border border-border hover:border-gold/10 transition-all">
                    <div className="flex items-center gap-2">
                      {toggle.icon}
                      <div>
                        <p className="text-[10px] font-medium">{toggle.label}</p>
                        <p className="text-[8px] text-muted">{toggle.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => saveAutopilotSetting({ [toggle.key]: !autopilotConfig[toggle.key] })}
                      className={`w-8 h-4.5 rounded-full transition-all flex items-center ${
                        autopilotConfig[toggle.key] ? "bg-success justify-end" : "bg-surface-light border border-border justify-start"
                      }`}>
                      <div className={`w-3.5 h-3.5 rounded-full mx-0.5 transition-all ${
                        autopilotConfig[toggle.key] ? "bg-white" : "bg-muted/40"
                      }`} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Platform filters */}
              <div className="mt-3">
                <p className="text-[9px] text-muted font-semibold uppercase tracking-wider mb-1.5">Allowed Platforms</p>
                <div className="flex gap-2">
                  {["instagram", "facebook", "tiktok", "linkedin", "youtube"].map(p => {
                    const allowed = Array.isArray(autopilotConfig.allowed_platforms)
                      ? (autopilotConfig.allowed_platforms as string[]).includes(p)
                      : true;
                    return (
                      <button key={p} onClick={() => {
                        const current = Array.isArray(autopilotConfig.allowed_platforms)
                          ? [...autopilotConfig.allowed_platforms as string[]]
                          : ["instagram", "facebook", "tiktok", "linkedin", "youtube"];
                        const updated = allowed ? current.filter(x => x !== p) : [...current, p];
                        saveAutopilotSetting({ allowed_platforms: updated });
                      }}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium border transition-all ${
                          allowed ? "border-gold/30 bg-gold/5" : "border-border bg-surface-light text-muted"
                        }`}>
                        {PLATFORM_ICONS[p]} <span className="capitalize">{p}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Posting hours */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] text-muted font-semibold">Posting starts (hour)</label>
                  <input type="number" min={0} max={23}
                    value={(autopilotConfig.posting_hours as Record<string, number>)?.start ?? 9}
                    onChange={e => saveAutopilotSetting({ posting_hours: { ...(autopilotConfig.posting_hours as Record<string, number> || {}), start: parseInt(e.target.value) || 9 } })}
                    className="input w-full text-xs py-1" />
                </div>
                <div>
                  <label className="text-[8px] text-muted font-semibold">Posting ends (hour)</label>
                  <input type="number" min={0} max={23}
                    value={(autopilotConfig.posting_hours as Record<string, number>)?.end ?? 18}
                    onChange={e => saveAutopilotSetting({ posting_hours: { ...(autopilotConfig.posting_hours as Record<string, number> || {}), end: parseInt(e.target.value) || 18 } })}
                    className="input w-full text-xs py-1" />
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="card-static bg-gold/[0.02] border-gold/10">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-2"><Activity size={12} className="text-gold" /> How Social Autopilot Works</h3>
              <ol className="space-y-1 text-[10px] text-muted">
                <li className="flex gap-2"><span className="text-gold font-bold">1.</span> Checks if content queue is running low (less than 3 days ahead)</li>
                <li className="flex gap-2"><span className="text-gold font-bold">2.</span> AI generates platform-specific content based on your settings</li>
                <li className="flex gap-2"><span className="text-gold font-bold">3.</span> Posts go to queue (or publish immediately if approval is off)</li>
                <li className="flex gap-2"><span className="text-gold font-bold">4.</span> Scheduled posts auto-publish when the time arrives</li>
                <li className="flex gap-2"><span className="text-gold font-bold">5.</span> AI can auto-reply to comments on connected accounts</li>
              </ol>
            </div>
          </div>
        </div>
      )}
      <PageAI pageName="Social Manager" context="Autonomous social media manager. Schedule posts, generate content calendars, manage multiple platforms." suggestions={["Generate this week's content for Instagram", "What trending topics should I post about?", "Write 5 engaging captions for a dental practice", "Create a 30-day content calendar"]} />
    </div>
  );
}
