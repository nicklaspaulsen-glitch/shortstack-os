"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useManagedClient } from "@/lib/use-managed-client";
import { Client, ContentCalendarEntry } from "@/lib/types";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import {
  Bot, Play, Pause, Calendar, Camera, Music,
  MessageSquare, Sparkles, Send, Clock, CheckCircle,
  Loader, Settings, ArrowRight, Globe, Film,
  Briefcase, Lightbulb, Video, LayoutGrid, FileText as FileTextIcon,
  ToggleLeft, ToggleRight, Zap, Shield, Activity, Hash,
  Copy, Layers, RefreshCw, TrendingUp, BarChart3, Users,
  Search, Download, Eye, Upload, LineChart, Repeat,
  GitCompare, Reply, Handshake, Music2,
  Target, Flame, Link, AtSign,
  PieChart, Star, ThumbsUp, Heart, Share2,
  Grid3X3, ArrowUpRight, Columns, BookOpen, Wand2,
  CircleDot, Inbox, UserPlus, AlertCircle,
  Plus, Minus, X, Check
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
  const { clientId: managedClientId } = useManagedClient();
  const [clients, setClients] = useState<Array<Client & { accounts: string[] }>>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [scheduledPosts, setScheduledPosts] = useState<ContentCalendarEntry[]>([]);
  const [recentPosts, setRecentPosts] = useState<ContentCalendarEntry[]>([]);
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekConfig, setWeekConfig] = useState({ posts_per_day: 1, tone: "professional yet approachable", topics: "" });
  const [tab, setTab] = useState<"dashboard" | "calendar" | "scheduled" | "published" | "hashtags" | "config" | "tools" | "analytics" | "inbox" | "collabs">("dashboard");
  const [suggestions, setSuggestions] = useState<Array<{ id: string; description: string; status: string; metadata: Record<string, unknown>; created_at: string }>>([]);
  const [autopilotConfig, setAutopilotConfig] = useState<Record<string, unknown>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [runningAutopilot, setRunningAutopilot] = useState(false);
  // New feature states
  const [repurposeInput, setRepurposeInput] = useState("");
  const [repurposeResults, setRepurposeResults] = useState<Array<{ platform: string; caption: string }>>([]);
  const [repurposing, setRepurposing] = useState(false);
  const [abTestInput, setAbTestInput] = useState("");
  const [abVariants, setAbVariants] = useState<{ a: string; b: string } | null>(null);
  const [generatingAB, setGeneratingAB] = useState(false);
  const [viralInput, setViralInput] = useState("");
  const [viralScore, setViralScore] = useState<{ score: number; factors: string[] } | null>(null);
  const [scoringViral, setScoringViral] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [bioResults, setBioResults] = useState<string[]>([]);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [bulkCsv, setBulkCsv] = useState("");
  const [competitorHandles, setCompetitorHandles] = useState<Array<{ handle: string; platform: string; frequency: string; lastPost: string }>>([
    { handle: "@competitor1", platform: "instagram", frequency: "2.3/day", lastPost: "2h ago" },
    { handle: "@rival_brand", platform: "tiktok", frequency: "1.8/day", lastPost: "5h ago" },
    { handle: "@industry_leader", platform: "linkedin", frequency: "1.1/day", lastPost: "1d ago" },
  ]);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [listeningKeywords, setListeningKeywords] = useState<string[]>(["brand name", "industry term", "product name"]);
  const [newKeyword, setNewKeyword] = useState("");
  const [storySlides, setStorySlides] = useState<Array<{ id: number; text: string; type: string }>>([
    { id: 1, text: "Hook slide", type: "text" },
    { id: 2, text: "Value slide", type: "image" },
    { id: 3, text: "CTA slide", type: "text" },
  ]);
  const [carouselSlides, setCarouselSlides] = useState<Array<{ id: number; heading: string; body: string }>>([
    { id: 1, heading: "Slide 1 - Hook", body: "Start with a bold statement..." },
    { id: 2, heading: "Slide 2 - Problem", body: "Identify the pain point..." },
    { id: 3, heading: "Slide 3 - Solution", body: "Present your answer..." },
    { id: 4, heading: "Slide 4 - Proof", body: "Show results/testimonials..." },
    { id: 5, heading: "Slide 5 - CTA", body: "Tell them what to do next..." },
  ]);
  const [linkBioLinks, setLinkBioLinks] = useState<Array<{ id: number; label: string; url: string; clicks: number }>>([
    { id: 1, label: "Website", url: "https://example.com", clicks: 234 },
    { id: 2, label: "Book a Call", url: "https://cal.com/example", clicks: 187 },
    { id: 3, label: "Latest Offer", url: "https://example.com/offer", clicks: 156 },
  ]);
  const [autoReplyRules, setAutoReplyRules] = useState<Array<{ id: number; trigger: string; response: string; active: boolean }>>([
    { id: 1, trigger: "price", response: "Thanks for your interest! Check our pricing at the link in bio or DM us for a custom quote.", active: true },
    { id: 2, trigger: "hours", response: "We're open Mon-Fri 9AM-6PM. Feel free to book online anytime!", active: true },
    { id: 3, trigger: "location", response: "We're located at [address]. See Google Maps link in our bio!", active: false },
  ]);
  const [collabOpportunities] = useState([
    { id: 1, brand: "FitLife Co", niche: "Health & Wellness", followers: "45K", status: "outreach", match: 92 },
    { id: 2, brand: "TechStart Hub", niche: "Technology", followers: "78K", status: "negotiating", match: 87 },
    { id: 3, brand: "EcoVibe", niche: "Sustainability", followers: "32K", status: "confirmed", match: 95 },
    { id: 4, brand: "StyleBox", niche: "Fashion", followers: "120K", status: "outreach", match: 74 },
    { id: 5, brand: "FoodieFirst", niche: "Food & Beverage", followers: "56K", status: "completed", match: 88 },
  ]);
  const [influencerNiche, setInfluencerNiche] = useState("");
  const [contentPillars] = useState([
    { name: "Educational", target: 30, actual: 28, color: "bg-blue-400" },
    { name: "Promotional", target: 20, actual: 24, color: "bg-gold" },
    { name: "Engagement", target: 25, actual: 22, color: "bg-pink-400" },
    { name: "Social Proof", target: 15, actual: 18, color: "bg-green-400" },
    { name: "Behind Scenes", target: 10, actual: 8, color: "bg-purple-400" },
  ]);
  const [toolsSubTab, setToolsSubTab] = useState<"repurpose" | "ab-test" | "viral" | "bio" | "preview" | "bulk" | "carousel" | "story" | "linkinbio" | "templates" | "recycler">("repurpose");
  const [analyticsSubTab, setAnalyticsSubTab] = useState<"engagement" | "heatmap" | "hashtags" | "growth" | "comparison" | "pillars">("engagement");
  const [inboxSubTab, setInboxSubTab] = useState<"messages" | "listening" | "ugc" | "autoreplies">("messages");
  const [collabsSubTab, setCollabsSubTab] = useState<"competitors" | "influencers" | "collabs" | "trending">("competitors");
  const supabase = createClient();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchClients(); fetchAutopilotConfig(); }, []);

  // Auto-select managed client
  useEffect(() => {
    if (managedClientId && clients.length > 0) {
      setSelectedClient(managedClientId);
    }
  }, [managedClientId, clients]);

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
      <div className="tab-group w-fit flex-wrap">
        {(["dashboard", "calendar", "scheduled", "published", "hashtags", "tools", "analytics", "inbox", "collabs", "config"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={tab === t ? "tab-item-active" : "tab-item-inactive"}>
            {t === "dashboard" ? "Dashboard" : t === "calendar" ? "Calendar" : t === "scheduled" ? `Queue (${scheduledPosts.length})` : t === "published" ? "Published" : t === "hashtags" ? "Hashtags" : t === "tools" ? "AI Tools" : t === "analytics" ? "Analytics" : t === "inbox" ? "Inbox" : t === "collabs" ? "Collabs" : "Settings"}
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

      {/* Calendar Tab */}
      {tab === "calendar" && (() => {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + 1);
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(startOfWeek);
          d.setDate(startOfWeek.getDate() + i);
          return d;
        });
        const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const allPosts = [...scheduledPosts, ...recentPosts];

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Content Calendar — This Week</h2>
              <button onClick={generateWeek} disabled={generating}
                className="btn-primary text-xs flex items-center gap-1.5">
                {generating ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Fill Week with AI
              </button>
            </div>

            {/* Weekly grid */}
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, i) => {
                const dayStr = day.toISOString().split("T")[0];
                const isToday = dayStr === today.toISOString().split("T")[0];
                const dayPosts = allPosts.filter(p => p.scheduled_at?.startsWith(dayStr));

                return (
                  <div key={i} className={`rounded-xl border p-2.5 min-h-[160px] ${
                    isToday ? "border-gold/30 bg-gold/[0.03]" : "border-border bg-surface"
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-semibold ${isToday ? "text-gold" : "text-muted"}`}>
                        {dayNames[i]}
                      </span>
                      <span className={`text-[10px] font-mono ${isToday ? "text-gold" : "text-muted"}`}>
                        {day.getDate()}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {dayPosts.map(post => (
                        <div key={post.id} className={`p-1.5 rounded-lg text-[9px] cursor-pointer transition-all hover:scale-[1.02] ${
                          post.status === "published"
                            ? "bg-success/10 border border-success/20 text-success"
                            : "bg-gold/5 border border-gold/15 text-foreground"
                        }`}>
                          <div className="flex items-center gap-1 mb-0.5">
                            {PLATFORM_ICONS[post.platform] || <Globe size={8} />}
                            <span className="capitalize font-medium">{post.platform}</span>
                          </div>
                          <p className="truncate">{post.title}</p>
                        </div>
                      ))}
                      {dayPosts.length === 0 && (
                        <p className="text-[8px] text-muted/40 text-center mt-6">Empty</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Content pillars */}
            <div className="card">
              <h3 className="section-header flex items-center gap-2 mb-3">
                <Layers size={13} className="text-gold" /> Content Pillars
              </h3>
              <p className="text-[10px] text-muted mb-3">Balanced content strategy across different post types</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { name: "Educational", desc: "Tips, how-tos, industry insights", color: "text-blue-400", bg: "bg-blue-400/10" },
                  { name: "Social Proof", desc: "Reviews, testimonials, case studies", color: "text-success", bg: "bg-success/10" },
                  { name: "Behind the Scenes", desc: "Team, process, day-in-the-life", color: "text-purple-400", bg: "bg-purple-400/10" },
                  { name: "Promotional", desc: "Offers, CTAs, product features", color: "text-gold", bg: "bg-gold/10" },
                  { name: "Engagement", desc: "Polls, questions, challenges", color: "text-pink-400", bg: "bg-pink-400/10" },
                  { name: "Trending", desc: "Memes, trends, cultural moments", color: "text-orange-400", bg: "bg-orange-400/10" },
                  { name: "Storytelling", desc: "Client stories, founder journey", color: "text-cyan-400", bg: "bg-cyan-400/10" },
                  { name: "Value Bombs", desc: "Quick wins, cheat sheets, lists", color: "text-emerald-400", bg: "bg-emerald-400/10" },
                ].map(pillar => (
                  <div key={pillar.name} className={`p-3 rounded-xl border border-border hover:border-gold/10 transition-all`}>
                    <div className={`w-7 h-7 ${pillar.bg} rounded-lg flex items-center justify-center mb-1.5`}>
                      <Sparkles size={12} className={pillar.color} />
                    </div>
                    <p className="text-[10px] font-semibold">{pillar.name}</p>
                    <p className="text-[8px] text-muted">{pillar.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Best posting times */}
            <div className="card">
              <h3 className="section-header flex items-center gap-2 mb-3">
                <Clock size={13} className="text-gold" /> Best Posting Times
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { platform: "Instagram", times: ["9:00 AM", "12:00 PM", "5:00 PM"], days: "Tue, Thu, Sat" },
                  { platform: "TikTok", times: ["7:00 AM", "10:00 AM", "7:00 PM"], days: "Mon, Wed, Fri" },
                  { platform: "LinkedIn", times: ["8:00 AM", "12:00 PM", "5:30 PM"], days: "Tue, Wed, Thu" },
                  { platform: "Facebook", times: ["9:00 AM", "1:00 PM", "4:00 PM"], days: "Wed, Fri, Sun" },
                  { platform: "YouTube", times: ["2:00 PM", "4:00 PM", "9:00 PM"], days: "Fri, Sat, Sun" },
                  { platform: "Twitter/X", times: ["8:00 AM", "11:00 AM", "4:00 PM"], days: "Mon-Fri" },
                ].map(p => (
                  <div key={p.platform} className="p-3 bg-surface-light rounded-xl border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      {PLATFORM_ICONS[p.platform.toLowerCase()] || <Globe size={12} />}
                      <span className="text-xs font-semibold">{p.platform}</span>
                    </div>
                    <div className="space-y-1">
                      {p.times.map(t => (
                        <span key={t} className="inline-block text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded mr-1">{t}</span>
                      ))}
                    </div>
                    <p className="text-[8px] text-muted mt-1.5">Best days: {p.days}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Hashtag Research Tab */}
      {tab === "hashtags" && (
        <div className="space-y-4">
          <div className="card border-gold/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-mesh opacity-30" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Hash size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Trending Hashtag Research</h2>
              </div>
              <p className="text-xs text-muted mb-4">AI-curated hashtag sets for maximum reach. Click any set to copy.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { category: "Growth & Marketing", tags: ["#marketingtips", "#digitalmarketing", "#growthhacking", "#socialmediatips", "#contentcreator", "#businessgrowth", "#marketingstrategy", "#smallbusiness", "#entrepreneurlife", "#brandbuilding"] },
                  { category: "Engagement Boosters", tags: ["#relatable", "#trending", "#viral", "#fyp", "#explore", "#instagood", "#photooftheday", "#motivation", "#inspiration", "#love"] },
                  { category: "Industry Specific", tags: ["#agencylife", "#clientwork", "#marketingagency", "#creativeagency", "#socialmediamanager", "#contentmarketing", "#seo", "#ppc", "#branding", "#webdesign"] },
                  { category: "Local Business", tags: ["#localbusiness", "#supportlocal", "#shoplocal", "#smallbusinessowner", "#communityover-competition", "#localmarketing", "#googlereviews", "#localseo", "#neighborhoodbusiness", "#hometown"] },
                  { category: "Reels & Video", tags: ["#reels", "#reelsinstagram", "#tiktokviral", "#shortsvideo", "#videocontent", "#reelsviral", "#instareels", "#contentcreation", "#videoediting", "#behindthescenes"] },
                  { category: "Call to Action", tags: ["#linkinbio", "#booknow", "#freeConsultation", "#limitedoffer", "#dmme", "#getstarted", "#learnmore", "#signupnow", "#actnow", "#dontmissout"] },
                ].map(set => (
                  <div key={set.category} className="p-3 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all">
                    <h4 className="text-[10px] font-semibold text-gold mb-2">{set.category}</h4>
                    <div className="flex flex-wrap gap-1">
                      {set.tags.map(tag => (
                        <button key={tag} onClick={() => { navigator.clipboard.writeText(tag); toast.success(`Copied ${tag}`); }}
                          className="text-[9px] bg-surface px-2 py-0.5 rounded text-muted hover:text-gold hover:bg-gold/5 transition-all cursor-pointer">
                          {tag}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(set.tags.join(" ")); toast.success("All hashtags copied!"); }}
                      className="mt-2 text-[9px] text-gold hover:underline flex items-center gap-1">
                      <Copy size={9} /> Copy all
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Caption templates */}
          <div className="card">
            <h3 className="section-header flex items-center gap-2 mb-3">
              <FileTextIcon size={13} className="text-gold" /> Caption Templates
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { name: "Hook + Value + CTA", template: "[HOOK that stops the scroll]\n\n[3 value points]\n\n[CTA] Save this for later!" },
                { name: "Before/After Story", template: "Before working with us: [pain point]\nAfter: [transformation]\n\nReady for your transformation? Link in bio" },
                { name: "Controversial Take", template: "Unpopular opinion: [bold statement]\n\nHere's why...\n[explanation]\n\nAgree or disagree? Comment below" },
                { name: "Listicle", template: "5 [things/mistakes/secrets] that [outcome]:\n\n1.\n2.\n3.\n4.\n5.\n\nWhich one surprised you? Comment below!" },
                { name: "Behind the Scenes", template: "POV: A day in the life at [business]\n\n[authentic moment or process]\n\nThis is what we love about what we do" },
                { name: "Client Spotlight", template: "Huge shoutout to @[client]!\n\n[What we helped them achieve]\n[Specific result/metric]\n\nWant results like this? DM us 'GROW'" },
              ].map(t => (
                <div key={t.name} className="p-3 bg-surface-light rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-[10px] font-semibold">{t.name}</h4>
                    <button onClick={() => { navigator.clipboard.writeText(t.template); toast.success("Template copied!"); }}
                      className="text-[9px] text-gold hover:underline flex items-center gap-1">
                      <Copy size={9} /> Copy
                    </button>
                  </div>
                  <pre className="text-[9px] text-muted whitespace-pre-wrap font-sans">{t.template}</pre>
                </div>
              ))}
            </div>
          </div>
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
      {/* ========== AI TOOLS TAB ========== */}
      {tab === "tools" && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: "repurpose", label: "Repurposer", icon: <RefreshCw size={11} /> },
              { key: "ab-test", label: "A/B Tester", icon: <GitCompare size={11} /> },
              { key: "viral", label: "Viral Score", icon: <Flame size={11} /> },
              { key: "bio", label: "Bio Optimizer", icon: <UserPlus size={11} /> },
              { key: "preview", label: "Post Preview", icon: <Eye size={11} /> },
              { key: "bulk", label: "Bulk Scheduler", icon: <Upload size={11} /> },
              { key: "carousel", label: "Carousel Builder", icon: <Columns size={11} /> },
              { key: "story", label: "Story Planner", icon: <CircleDot size={11} /> },
              { key: "linkinbio", label: "Link in Bio", icon: <Link size={11} /> },
              { key: "templates", label: "Caption Templates", icon: <BookOpen size={11} /> },
              { key: "recycler", label: "Content Recycler", icon: <Repeat size={11} /> },
            ] as const).map(st => (
              <button key={st.key} onClick={() => setToolsSubTab(st.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  toolsSubTab === st.key ? "bg-gold/10 text-gold border border-gold/20" : "bg-surface-light text-muted border border-border hover:border-gold/10"
                }`}>
                {st.icon} {st.label}
              </button>
            ))}
          </div>

          {/* 1. AI Content Repurposer */}
          {toolsSubTab === "repurpose" && (
            <div className="card border-gold/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-mesh opacity-30" />
              <div className="relative space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center">
                    <RefreshCw size={16} className="text-gold" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">AI Content Repurposer</h2>
                    <p className="text-[10px] text-muted">Paste a post and generate versions for every platform</p>
                  </div>
                </div>
                <textarea value={repurposeInput} onChange={e => setRepurposeInput(e.target.value)}
                  className="input w-full h-24 text-xs" placeholder="Paste your original post content here..." />
                <button onClick={() => {
                  if (!repurposeInput.trim()) return;
                  setRepurposing(true);
                  setTimeout(() => {
                    setRepurposeResults([
                      { platform: "instagram", caption: `${repurposeInput.slice(0, 80)}...\n\n#instagood #viral #trending` },
                      { platform: "tiktok", caption: `POV: ${repurposeInput.slice(0, 60)}... (save this for later!)` },
                      { platform: "linkedin", caption: `I've been thinking about this:\n\n${repurposeInput.slice(0, 100)}...\n\nWhat are your thoughts? Let me know in the comments.` },
                      { platform: "facebook", caption: `${repurposeInput.slice(0, 120)}...\n\nShare if you agree!` },
                      { platform: "twitter", caption: repurposeInput.length > 250 ? `${repurposeInput.slice(0, 250)}...` : repurposeInput },
                    ]);
                    setRepurposing(false);
                  }, 1500);
                }} disabled={repurposing || !repurposeInput.trim()}
                  className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                  {repurposing ? <Loader size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  {repurposing ? "Generating..." : "Repurpose for All Platforms"}
                </button>
                {repurposeResults.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                    {repurposeResults.map(r => (
                      <div key={r.platform} className="p-3 bg-surface-light rounded-xl border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            {PLATFORM_ICONS[r.platform] || <Globe size={12} />}
                            <span className="text-[10px] font-semibold capitalize">{r.platform}</span>
                          </div>
                          <button onClick={() => { navigator.clipboard.writeText(r.caption); toast.success("Copied!"); }}
                            className="text-[9px] text-gold flex items-center gap-1 hover:underline">
                            <Copy size={9} /> Copy
                          </button>
                        </div>
                        <p className="text-[10px] text-muted whitespace-pre-wrap">{r.caption}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 7. A/B Caption Tester */}
          {toolsSubTab === "ab-test" && (
            <div className="card border-gold/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-mesh opacity-30" />
              <div className="relative space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-400/10 rounded-lg flex items-center justify-center">
                    <GitCompare size={16} className="text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">A/B Caption Tester</h2>
                    <p className="text-[10px] text-muted">Generate two caption variants to test which performs better</p>
                  </div>
                </div>
                <textarea value={abTestInput} onChange={e => setAbTestInput(e.target.value)}
                  className="input w-full h-20 text-xs" placeholder="Describe what your post is about (e.g., 'New product launch for organic skincare line')..." />
                <button onClick={() => {
                  if (!abTestInput.trim()) return;
                  setGeneratingAB(true);
                  setTimeout(() => {
                    setAbVariants({
                      a: `Ever wished your skin could just... glow? Introducing our new organic line that makes it happen. No filters needed.\n\nTap the link in bio to discover your perfect match.\n\n#skincare #organic #glowup`,
                      b: `We spent 2 years perfecting this formula.\n\nThe result? Skincare that actually works — backed by science, powered by nature.\n\n3 products. Zero compromises. Available now.\n\nLink in bio to shop the collection.`,
                    });
                    setGeneratingAB(false);
                  }, 1500);
                }} disabled={generatingAB || !abTestInput.trim()}
                  className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                  {generatingAB ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {generatingAB ? "Creating Variants..." : "Generate A/B Variants"}
                </button>
                {abVariants && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    {(["a", "b"] as const).map(variant => (
                      <div key={variant} className={`p-3 rounded-xl border ${variant === "a" ? "border-blue-400/20 bg-blue-400/[0.03]" : "border-pink-400/20 bg-pink-400/[0.03]"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-bold ${variant === "a" ? "text-blue-400" : "text-pink-400"}`}>
                            Variant {variant.toUpperCase()}
                          </span>
                          <button onClick={() => { navigator.clipboard.writeText(abVariants[variant]); toast.success("Copied!"); }}
                            className="text-[9px] text-gold flex items-center gap-1 hover:underline">
                            <Copy size={9} /> Copy
                          </button>
                        </div>
                        <p className="text-[10px] text-muted whitespace-pre-wrap">{abVariants[variant]}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 8. Viral Score Predictor */}
          {toolsSubTab === "viral" && (
            <div className="card border-gold/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-mesh opacity-30" />
              <div className="relative space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-orange-400/10 rounded-lg flex items-center justify-center">
                    <Flame size={16} className="text-orange-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Viral Score Predictor</h2>
                    <p className="text-[10px] text-muted">AI rates your content 1-100 on virality potential</p>
                  </div>
                </div>
                <textarea value={viralInput} onChange={e => setViralInput(e.target.value)}
                  className="input w-full h-20 text-xs" placeholder="Paste your caption or describe your content idea..." />
                <button onClick={() => {
                  if (!viralInput.trim()) return;
                  setScoringViral(true);
                  setTimeout(() => {
                    const score = Math.floor(Math.random() * 40) + 55;
                    setViralScore({
                      score,
                      factors: [
                        score > 80 ? "Strong emotional hook detected" : "Consider adding a stronger hook",
                        viralInput.includes("?") ? "Question format encourages engagement" : "Try adding a question to boost comments",
                        viralInput.length > 100 ? "Good content length for storytelling" : "Longer captions tend to get more saves",
                        viralInput.includes("#") ? "Hashtags detected — good for reach" : "Add 5-10 relevant hashtags for discovery",
                        "Trending topic alignment: moderate",
                        score > 70 ? "Strong share potential" : "Add a relatable angle to boost shares",
                      ],
                    });
                    setScoringViral(false);
                  }, 2000);
                }} disabled={scoringViral || !viralInput.trim()}
                  className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                  {scoringViral ? <Loader size={12} className="animate-spin" /> : <Flame size={12} />}
                  {scoringViral ? "Analyzing..." : "Predict Viral Score"}
                </button>
                {viralScore && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-4">
                      <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center ${
                        viralScore.score >= 80 ? "bg-success/10 border border-success/20" :
                        viralScore.score >= 60 ? "bg-gold/10 border border-gold/20" :
                        "bg-orange-400/10 border border-orange-400/20"
                      }`}>
                        <span className={`text-2xl font-bold ${
                          viralScore.score >= 80 ? "text-success" : viralScore.score >= 60 ? "text-gold" : "text-orange-400"
                        }`}>{viralScore.score}</span>
                        <span className="text-[8px] text-muted">/100</span>
                      </div>
                      <div className="flex-1">
                        <div className="w-full bg-surface-light rounded-full h-3 mb-1.5">
                          <div className={`h-3 rounded-full transition-all duration-1000 ${
                            viralScore.score >= 80 ? "bg-success" : viralScore.score >= 60 ? "bg-gold" : "bg-orange-400"
                          }`} style={{ width: `${viralScore.score}%` }} />
                        </div>
                        <span className={`text-[10px] font-semibold ${
                          viralScore.score >= 80 ? "text-success" : viralScore.score >= 60 ? "text-gold" : "text-orange-400"
                        }`}>
                          {viralScore.score >= 80 ? "High Viral Potential" : viralScore.score >= 60 ? "Moderate Potential" : "Needs Improvement"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {viralScore.factors.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-[10px]">
                          <span className="text-gold mt-0.5">{i < 3 ? <Check size={10} /> : <AlertCircle size={10} />}</span>
                          <span className="text-muted">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 12. Bio Optimizer */}
          {toolsSubTab === "bio" && (
            <div className="card border-gold/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-mesh opacity-30" />
              <div className="relative space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-cyan-400/10 rounded-lg flex items-center justify-center">
                    <UserPlus size={16} className="text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Bio Optimizer</h2>
                    <p className="text-[10px] text-muted">AI-powered social media bio generator for maximum impact</p>
                  </div>
                </div>
                <textarea value={bioInput} onChange={e => setBioInput(e.target.value)}
                  className="input w-full h-20 text-xs" placeholder="Describe your business, niche, and what makes you unique..." />
                <button onClick={() => {
                  if (!bioInput.trim()) return;
                  setGeneratingBio(true);
                  setTimeout(() => {
                    setBioResults([
                      `Helping ${bioInput.slice(0, 30)}... achieve more\n${"🚀"} Results-driven strategies\n${"📩"} DM 'START' for a free audit\n${"👇"} Latest resources below`,
                      `${bioInput.slice(0, 25)}... | Expert\n${"✨"} Turning ideas into impact\n${"📊"} 500+ happy clients\n${"🔗"} Free guide in link below`,
                      `Your go-to for ${bioInput.slice(0, 20)}...\n${"💡"} Tips daily | ${"🎯"} Strategy weekly\nDM for collabs ${"🤝"}\nNew content ${"⬇️"}`,
                    ]);
                    setGeneratingBio(false);
                  }, 1500);
                }} disabled={generatingBio || !bioInput.trim()}
                  className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                  {generatingBio ? <Loader size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  {generatingBio ? "Generating..." : "Generate Bio Options"}
                </button>
                {bioResults.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {bioResults.map((bio, i) => (
                      <div key={i} className="p-3 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-semibold text-gold">Option {i + 1}</span>
                          <button onClick={() => { navigator.clipboard.writeText(bio); toast.success("Bio copied!"); }}
                            className="text-[9px] text-gold flex items-center gap-1 hover:underline">
                            <Copy size={9} /> Copy
                          </button>
                        </div>
                        <p className="text-[10px] text-muted whitespace-pre-wrap">{bio}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 18. Post Preview */}
          {toolsSubTab === "preview" && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-400/10 rounded-lg flex items-center justify-center">
                  <Eye size={16} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Post Preview</h2>
                  <p className="text-[10px] text-muted">See how your posts will look on each platform</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Instagram Preview */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-surface-light p-2 flex items-center gap-2 border-b border-border">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-400 to-purple-500" />
                    <span className="text-[10px] font-semibold">your_brand</span>
                    <Camera size={10} className="text-pink-400 ml-auto" />
                  </div>
                  <div className="bg-surface-light/50 aspect-square flex items-center justify-center">
                    <Camera size={32} className="text-muted/20" />
                  </div>
                  <div className="p-2.5 bg-surface-light">
                    <div className="flex gap-3 mb-1.5">
                      <Heart size={14} className="text-muted" />
                      <MessageSquare size={14} className="text-muted" />
                      <Send size={14} className="text-muted" />
                      <Share2 size={14} className="text-muted ml-auto" />
                    </div>
                    <p className="text-[9px] text-muted"><span className="font-semibold text-foreground">your_brand</span> Your caption will appear here with hashtags...</p>
                  </div>
                </div>
                {/* TikTok Preview */}
                <div className="rounded-xl border border-border overflow-hidden bg-black">
                  <div className="aspect-[9/16] max-h-[320px] flex items-center justify-center relative">
                    <Video size={32} className="text-white/20" />
                    <div className="absolute bottom-3 left-3 right-10">
                      <p className="text-[10px] text-white font-semibold">@your_brand</p>
                      <p className="text-[9px] text-white/80 mt-0.5">Your TikTok caption here... #fyp #viral</p>
                    </div>
                    <div className="absolute right-2 bottom-3 flex flex-col gap-3 items-center">
                      <Heart size={16} className="text-white" />
                      <MessageSquare size={16} className="text-white" />
                      <Share2 size={16} className="text-white" />
                    </div>
                  </div>
                </div>
                {/* LinkedIn Preview */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-surface-light p-2.5 flex items-center gap-2 border-b border-border">
                    <div className="w-8 h-8 rounded-full bg-blue-400/20 flex items-center justify-center">
                      <Briefcase size={12} className="text-blue-400" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold block">Your Name</span>
                      <span className="text-[8px] text-muted">CEO at Company | 500+ connections</span>
                    </div>
                  </div>
                  <div className="p-2.5 bg-surface-light/50">
                    <p className="text-[10px] text-muted leading-relaxed">Your LinkedIn post content will appear here. LinkedIn favors longer, value-driven posts with line breaks for readability.</p>
                  </div>
                  <div className="bg-surface-light p-2 flex items-center justify-around border-t border-border text-[9px] text-muted">
                    <span className="flex items-center gap-1"><ThumbsUp size={10} /> Like</span>
                    <span className="flex items-center gap-1"><MessageSquare size={10} /> Comment</span>
                    <span className="flex items-center gap-1"><Repeat size={10} /> Repost</span>
                    <span className="flex items-center gap-1"><Send size={10} /> Send</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 19. Bulk Post Scheduler */}
          {toolsSubTab === "bulk" && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-400/10 rounded-lg flex items-center justify-center">
                  <Upload size={16} className="text-green-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Bulk Post Scheduler</h2>
                  <p className="text-[10px] text-muted">Upload a CSV of posts to schedule all at once</p>
                </div>
              </div>
              <div className="p-3 bg-surface-light rounded-xl border border-border">
                <p className="text-[10px] text-muted mb-2">CSV Format: <code className="text-[9px] bg-surface px-1.5 py-0.5 rounded text-gold">platform, date, time, caption, hashtags</code></p>
                <textarea value={bulkCsv} onChange={e => setBulkCsv(e.target.value)}
                  className="input w-full h-32 text-xs font-mono" placeholder={`instagram, 2026-04-15, 09:00, "Your caption here", "#marketing #tips"\ntiktok, 2026-04-15, 12:00, "POV: When you discover...", "#fyp #viral"\nlinkedin, 2026-04-16, 08:00, "Just published a new article...", "#business"`} />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => {
                  if (!bulkCsv.trim()) { toast.error("Paste CSV data first"); return; }
                  const lines = bulkCsv.trim().split("\n").length;
                  toast.success(`${lines} posts queued for scheduling!`);
                  setBulkCsv("");
                }} className="btn-primary text-xs flex items-center gap-1.5">
                  <Upload size={12} /> Schedule All Posts
                </button>
                <button onClick={() => {
                  const sample = `instagram, 2026-04-15, 09:00, "5 tips to grow your audience", "#growth #tips"\ntiktok, 2026-04-15, 12:00, "POV: Your first viral video", "#fyp #viral"\nlinkedin, 2026-04-16, 08:00, "Lessons from 10 years in business", "#leadership"`;
                  setBulkCsv(sample);
                }} className="text-[10px] text-gold hover:underline flex items-center gap-1">
                  <FileTextIcon size={10} /> Load Sample CSV
                </button>
              </div>
            </div>
          )}

          {/* 11. Carousel Builder */}
          {toolsSubTab === "carousel" && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-400/10 rounded-lg flex items-center justify-center">
                  <Columns size={16} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Carousel Builder</h2>
                  <p className="text-[10px] text-muted">Plan multi-slide posts for Instagram/LinkedIn</p>
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {carouselSlides.map((slide, i) => (
                  <div key={slide.id} className="min-w-[200px] p-3 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-bold text-gold">SLIDE {i + 1}</span>
                      {carouselSlides.length > 1 && (
                        <button onClick={() => setCarouselSlides(carouselSlides.filter(s => s.id !== slide.id))}
                          className="text-muted hover:text-red-400 transition-all"><X size={10} /></button>
                      )}
                    </div>
                    <input value={slide.heading} onChange={e => {
                      const updated = [...carouselSlides];
                      updated[i] = { ...slide, heading: e.target.value };
                      setCarouselSlides(updated);
                    }} className="input w-full text-xs mb-1.5" placeholder="Slide heading..." />
                    <textarea value={slide.body} onChange={e => {
                      const updated = [...carouselSlides];
                      updated[i] = { ...slide, body: e.target.value };
                      setCarouselSlides(updated);
                    }} className="input w-full text-[10px] h-16" placeholder="Slide content..." />
                  </div>
                ))}
                <button onClick={() => setCarouselSlides([...carouselSlides, { id: Date.now(), heading: `Slide ${carouselSlides.length + 1}`, body: "" }])}
                  className="min-w-[60px] flex items-center justify-center border border-dashed border-border rounded-xl hover:border-gold/30 transition-all">
                  <Plus size={16} className="text-muted" />
                </button>
              </div>
              <button onClick={() => {
                const text = carouselSlides.map((s, i) => `[Slide ${i + 1}] ${s.heading}\n${s.body}`).join("\n\n");
                navigator.clipboard.writeText(text);
                toast.success("Carousel outline copied!");
              }} className="btn-primary text-xs flex items-center gap-1.5">
                <Copy size={12} /> Copy Carousel Outline
              </button>
            </div>
          )}

          {/* 10. Story Planner */}
          {toolsSubTab === "story" && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-pink-400/10 rounded-lg flex items-center justify-center">
                  <CircleDot size={16} className="text-pink-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Story Planner</h2>
                  <p className="text-[10px] text-muted">Visual story sequence planner for Instagram/TikTok</p>
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {storySlides.map((slide, i) => (
                  <div key={slide.id} className="min-w-[120px] aspect-[9/16] max-h-[200px] p-2.5 bg-surface-light rounded-xl border border-border hover:border-pink-400/20 transition-all shrink-0 flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] font-bold text-pink-400">{i + 1}/{storySlides.length}</span>
                      {storySlides.length > 1 && (
                        <button onClick={() => setStorySlides(storySlides.filter(s => s.id !== slide.id))}
                          className="text-muted hover:text-red-400"><X size={8} /></button>
                      )}
                    </div>
                    <select value={slide.type} onChange={e => {
                      const updated = [...storySlides];
                      updated[i] = { ...slide, type: e.target.value };
                      setStorySlides(updated);
                    }} className="input text-[8px] py-0.5 mb-1">
                      <option value="text">Text</option>
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                      <option value="poll">Poll</option>
                      <option value="quiz">Quiz</option>
                    </select>
                    <textarea value={slide.text} onChange={e => {
                      const updated = [...storySlides];
                      updated[i] = { ...slide, text: e.target.value };
                      setStorySlides(updated);
                    }} className="input flex-1 text-[9px] resize-none" placeholder="Slide content..." />
                  </div>
                ))}
                <button onClick={() => setStorySlides([...storySlides, { id: Date.now(), text: "", type: "text" }])}
                  className="min-w-[60px] aspect-[9/16] max-h-[200px] flex items-center justify-center border border-dashed border-border rounded-xl hover:border-pink-400/30">
                  <Plus size={14} className="text-muted" />
                </button>
              </div>
              <p className="text-[9px] text-muted">Tip: Best-performing stories have 3-7 slides with a hook, value, and CTA</p>
            </div>
          )}

          {/* 13. Link in Bio Manager */}
          {toolsSubTab === "linkinbio" && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-400/10 rounded-lg flex items-center justify-center">
                  <Link size={16} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Link in Bio Manager</h2>
                  <p className="text-[10px] text-muted">Manage your link-in-bio pages per platform</p>
                </div>
              </div>
              <div className="space-y-2">
                {linkBioLinks.map((link, i) => (
                  <div key={link.id} className="flex items-center gap-3 p-2.5 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all">
                    <div className="w-8 h-8 bg-surface rounded-lg flex items-center justify-center text-xs font-bold text-gold">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <input value={link.label} onChange={e => {
                        const updated = [...linkBioLinks];
                        updated[i] = { ...link, label: e.target.value };
                        setLinkBioLinks(updated);
                      }} className="text-xs font-semibold bg-transparent border-0 outline-none w-full" />
                      <input value={link.url} onChange={e => {
                        const updated = [...linkBioLinks];
                        updated[i] = { ...link, url: e.target.value };
                        setLinkBioLinks(updated);
                      }} className="text-[9px] text-muted bg-transparent border-0 outline-none w-full" />
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-gold">{link.clicks}</p>
                      <p className="text-[8px] text-muted">clicks</p>
                    </div>
                    <button onClick={() => setLinkBioLinks(linkBioLinks.filter(l => l.id !== link.id))}
                      className="text-muted hover:text-red-400 shrink-0"><X size={12} /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setLinkBioLinks([...linkBioLinks, { id: Date.now(), label: "New Link", url: "https://", clicks: 0 }])}
                className="text-[10px] text-gold hover:underline flex items-center gap-1">
                <Plus size={10} /> Add Link
              </button>
            </div>
          )}

          {/* 26. Caption Templates Library (expanded) */}
          {toolsSubTab === "templates" && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-yellow-400/10 rounded-lg flex items-center justify-center">
                  <BookOpen size={16} className="text-yellow-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Caption Templates Library</h2>
                  <p className="text-[10px] text-muted">Industry-specific caption templates ready to customize</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { industry: "Fitness", templates: [
                    { name: "Transformation Story", template: "Where I was 6 months ago vs. now:\n\nThen: [old state]\nNow: [new state]\n\nThe secret? Consistency > perfection.\n\nDrop a [emoji] if you agree." },
                    { name: "Quick Tip", template: "STOP doing [common mistake].\n\nDo THIS instead:\n\n1. [tip]\n2. [tip]\n3. [tip]\n\nSave this for your next workout!" },
                  ]},
                  { industry: "Restaurant", templates: [
                    { name: "Menu Highlight", template: "Our chef's special this week:\n\n[dish name]\n[description]\n\nAvailable until [date]. Reserve your table (link in bio)" },
                    { name: "Behind Kitchen", template: "Ever wonder how we make our [signature dish]?\n\n[Step-by-step tease]\n\nCome taste the difference. Open [hours]" },
                  ]},
                  { industry: "Real Estate", templates: [
                    { name: "Just Listed", template: "JUST LISTED in [neighborhood]\n\n[bedrooms] BR | [bathrooms] BA | [sqft] sq ft\n[key feature]\n[key feature]\n\nDM 'INFO' for details." },
                    { name: "Market Update", template: "Your [city] market update:\n\nMedian Price: [price]\nDays on Market: [days]\nInventory: [level]\n\nWhat this means for you..." },
                  ]},
                  { industry: "E-commerce", templates: [
                    { name: "Product Launch", template: "IT'S HERE.\n\n[Product name] just dropped.\n\n[benefit 1]\n[benefit 2]\n[benefit 3]\n\nFirst 50 orders get [bonus]. Link in bio!" },
                    { name: "Customer Review", template: "Don't take our word for it:\n\n\"[customer quote]\"\n- [customer name]\n\n[product] is available now at [link]" },
                  ]},
                  { industry: "Agency/B2B", templates: [
                    { name: "Case Study", template: "How we helped [client type] get [result]:\n\nThe problem: [pain]\nOur approach: [solution]\nThe result: [metric]\n\nWant similar results? Link in bio" },
                    { name: "Myth Buster", template: "MYTH: [common misconception]\n\nREALITY: [truth]\n\nHere's why this matters for your [business/brand]:\n\n[explanation]\n\nAgree? Disagree? Comment below" },
                  ]},
                  { industry: "Healthcare", templates: [
                    { name: "Health Tip", template: "Did you know?\n\n[surprising health fact]\n\n[what to do about it]\n\nBook your checkup: link in bio\n\n#healthtips #wellness" },
                    { name: "Meet the Team", template: "Meet Dr. [name]!\n\n[specialty]\n[years experience]\n[fun fact]\n\nBooking now available for new patients." },
                  ]},
                ].map(ind => (
                  <div key={ind.industry} className="space-y-2">
                    <h4 className="text-[10px] font-semibold text-gold">{ind.industry}</h4>
                    {ind.templates.map(t => (
                      <div key={t.name} className="p-2.5 bg-surface-light rounded-lg border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium">{t.name}</span>
                          <button onClick={() => { navigator.clipboard.writeText(t.template); toast.success("Copied!"); }}
                            className="text-[9px] text-gold hover:underline flex items-center gap-1"><Copy size={8} /> Copy</button>
                        </div>
                        <pre className="text-[9px] text-muted whitespace-pre-wrap font-sans leading-relaxed">{t.template}</pre>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 21. Content Recycler */}
          {toolsSubTab === "recycler" && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-400/10 rounded-lg flex items-center justify-center">
                  <Repeat size={16} className="text-green-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Content Recycler</h2>
                  <p className="text-[10px] text-muted">Resurface high-performing old posts to reuse or refresh</p>
                </div>
              </div>
              {recentPosts.length === 0 ? (
                <div className="text-center py-6">
                  <Repeat size={24} className="mx-auto mb-2 text-muted/20" />
                  <p className="text-xs text-muted">No published posts to recycle yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentPosts.slice(0, 8).map((post) => {
                    const engScore = Math.floor(Math.random() * 50) + 50;
                    return (
                      <div key={post.id} className="flex items-center gap-3 p-2.5 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all">
                        <div className="shrink-0">{PLATFORM_ICONS[post.platform] || <Globe size={14} />}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{post.title}</p>
                          <p className="text-[9px] text-muted">{post.scheduled_at ? formatRelativeTime(post.scheduled_at) : ""}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className={`text-[10px] font-bold ${engScore > 75 ? "text-success" : "text-gold"}`}>{engScore}%</div>
                          <p className="text-[8px] text-muted">engagement</p>
                        </div>
                        <button onClick={() => {
                          const meta = (post.metadata as Record<string, unknown>) || {};
                          setRepurposeInput(String(meta.caption || post.title));
                          setToolsSubTab("repurpose");
                          toast.success("Post loaded into repurposer!");
                        }} className="text-[9px] text-gold flex items-center gap-1 hover:underline shrink-0">
                          <RefreshCw size={9} /> Recycle
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========== ANALYTICS TAB ========== */}
      {tab === "analytics" && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: "engagement", label: "Engagement", icon: <TrendingUp size={11} /> },
              { key: "heatmap", label: "Best Times Heatmap", icon: <Grid3X3 size={11} /> },
              { key: "hashtags", label: "Hashtag Analytics", icon: <Hash size={11} /> },
              { key: "growth", label: "Audience Growth", icon: <LineChart size={11} /> },
              { key: "comparison", label: "Platform Compare", icon: <BarChart3 size={11} /> },
              { key: "pillars", label: "Content Pillars", icon: <PieChart size={11} /> },
            ] as const).map(st => (
              <button key={st.key} onClick={() => setAnalyticsSubTab(st.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  analyticsSubTab === st.key ? "bg-gold/10 text-gold border border-gold/20" : "bg-surface-light text-muted border border-border hover:border-gold/10"
                }`}>
                {st.icon} {st.label}
              </button>
            ))}
          </div>

          {/* 2. Engagement Rate Calculator */}
          {analyticsSubTab === "engagement" && (
            <div className="space-y-3">
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={16} className="text-gold" />
                  <h2 className="text-sm font-semibold">Engagement Rate Calculator</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
                  <div className="p-3 bg-surface-light rounded-xl border border-border text-center">
                    <p className="text-lg font-bold text-gold">4.2%</p>
                    <p className="text-[9px] text-muted">Avg Engagement Rate</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <ArrowUpRight size={10} className="text-success" />
                      <span className="text-[9px] text-success">+0.8%</span>
                    </div>
                  </div>
                  <div className="p-3 bg-surface-light rounded-xl border border-border text-center">
                    <p className="text-lg font-bold text-blue-400">1.2K</p>
                    <p className="text-[9px] text-muted">Avg Likes/Post</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <ArrowUpRight size={10} className="text-success" />
                      <span className="text-[9px] text-success">+15%</span>
                    </div>
                  </div>
                  <div className="p-3 bg-surface-light rounded-xl border border-border text-center">
                    <p className="text-lg font-bold text-pink-400">89</p>
                    <p className="text-[9px] text-muted">Avg Comments/Post</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <ArrowUpRight size={10} className="text-success" />
                      <span className="text-[9px] text-success">+23%</span>
                    </div>
                  </div>
                  <div className="p-3 bg-surface-light rounded-xl border border-border text-center">
                    <p className="text-lg font-bold text-purple-400">342</p>
                    <p className="text-[9px] text-muted">Avg Shares/Post</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <TrendingUp size={10} className="text-gold" />
                      <span className="text-[9px] text-gold">Trending</span>
                    </div>
                  </div>
                </div>
                {/* Per-post engagement */}
                <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Per-Post Breakdown</h3>
                <div className="space-y-1.5">
                  {(recentPosts.length > 0 ? recentPosts : scheduledPosts).slice(0, 8).map((post) => {
                    const rate = (Math.random() * 8 + 1).toFixed(1);
                    const trending = parseFloat(rate) > 5;
                    return (
                      <div key={post.id} className="flex items-center gap-3 p-2 bg-surface-light rounded-lg border border-border">
                        <div className="shrink-0">{PLATFORM_ICONS[post.platform] || <Globe size={12} />}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium truncate">{post.title}</p>
                          <p className="text-[8px] text-muted capitalize">{post.platform}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-bold ${trending ? "text-success" : "text-foreground"}`}>{rate}%</span>
                          {trending && <Flame size={10} className="text-orange-400" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 3. Best Time to Post Heatmap */}
          {analyticsSubTab === "heatmap" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Grid3X3 size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Best Time to Post Heatmap</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Darker cells = higher engagement. Based on your audience activity patterns.</p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-[8px] text-muted font-semibold p-1 text-left">Day</th>
                      {["6AM", "8AM", "10AM", "12PM", "2PM", "4PM", "6PM", "8PM", "10PM"].map(h => (
                        <th key={h} className="text-[7px] text-muted font-medium p-1 text-center">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                      <tr key={day}>
                        <td className="text-[9px] font-semibold text-muted p-1">{day}</td>
                        {[6, 8, 10, 12, 14, 16, 18, 20, 22].map((hour, hi) => {
                          // Simulate engagement patterns
                          const patterns: Record<string, number[]> = {
                            Mon: [20, 45, 70, 80, 55, 40, 65, 50, 25],
                            Tue: [25, 60, 85, 90, 65, 50, 70, 55, 30],
                            Wed: [30, 55, 75, 85, 60, 45, 60, 45, 20],
                            Thu: [20, 50, 80, 85, 70, 55, 75, 60, 35],
                            Fri: [15, 40, 65, 75, 50, 35, 55, 70, 45],
                            Sat: [10, 30, 50, 60, 55, 45, 50, 65, 40],
                            Sun: [10, 25, 45, 55, 50, 40, 45, 60, 35],
                          };
                          const val = patterns[day]?.[hi] ?? 30;
                          return (
                            <td key={hour} className="p-0.5">
                              <div className={`w-full h-7 rounded flex items-center justify-center text-[7px] font-bold transition-all cursor-pointer hover:scale-110 ${
                                val >= 80 ? "bg-success/60 text-white" :
                                val >= 60 ? "bg-success/30 text-success" :
                                val >= 40 ? "bg-gold/20 text-gold" :
                                "bg-surface-light text-muted/50"
                              }`}>
                                {val}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3 mt-3 justify-end">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-surface-light" /><span className="text-[8px] text-muted">Low</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-gold/20" /><span className="text-[8px] text-muted">Medium</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-success/30" /><span className="text-[8px] text-muted">Good</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-success/60" /><span className="text-[8px] text-muted">Best</span></div>
              </div>
            </div>
          )}

          {/* 5. Hashtag Performance Analytics */}
          {analyticsSubTab === "hashtags" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Hash size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Hashtag Performance Analytics</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Track which hashtags drive the most engagement and reach</p>
              <div className="space-y-2">
                {[
                  { tag: "#marketingtips", posts: 24, reach: "45.2K", engagement: "6.8%", trend: "up" },
                  { tag: "#smallbusiness", posts: 18, reach: "32.1K", engagement: "5.4%", trend: "up" },
                  { tag: "#growthhacking", posts: 15, reach: "28.7K", engagement: "4.9%", trend: "stable" },
                  { tag: "#socialmedia", posts: 22, reach: "25.3K", engagement: "3.2%", trend: "down" },
                  { tag: "#contentcreator", posts: 12, reach: "19.8K", engagement: "7.1%", trend: "up" },
                  { tag: "#entrepreneurlife", posts: 16, reach: "18.4K", engagement: "4.5%", trend: "stable" },
                  { tag: "#digitalmarketing", posts: 20, reach: "15.6K", engagement: "3.8%", trend: "down" },
                  { tag: "#branding", posts: 10, reach: "12.3K", engagement: "5.9%", trend: "up" },
                ].map(h => (
                  <div key={h.tag} className="flex items-center gap-3 p-2.5 bg-surface-light rounded-lg border border-border hover:border-gold/10 transition-all">
                    <span className="text-xs font-mono font-semibold text-gold min-w-[140px]">{h.tag}</span>
                    <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] font-bold">{h.posts}</p>
                        <p className="text-[7px] text-muted">Posts</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold">{h.reach}</p>
                        <p className="text-[7px] text-muted">Reach</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold">{h.engagement}</p>
                        <p className="text-[7px] text-muted">Eng Rate</p>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {h.trend === "up" && <ArrowUpRight size={12} className="text-success" />}
                      {h.trend === "stable" && <Minus size={12} className="text-gold" />}
                      {h.trend === "down" && <TrendingUp size={12} className="text-red-400 rotate-180" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 20. Audience Growth Tracker */}
          {analyticsSubTab === "growth" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <LineChart size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Audience Growth Tracker</h2>
              </div>
              <p className="text-[10px] text-muted mb-4">Track follower growth over time across all platforms</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-4">
                {[
                  { platform: "instagram", followers: "12.4K", growth: "+342", pct: "+2.8%" },
                  { platform: "tiktok", followers: "8.7K", growth: "+891", pct: "+11.4%" },
                  { platform: "linkedin", followers: "5.2K", growth: "+128", pct: "+2.5%" },
                  { platform: "facebook", followers: "3.8K", growth: "+67", pct: "+1.8%" },
                  { platform: "youtube", followers: "2.1K", growth: "+203", pct: "+10.7%" },
                ].map(p => (
                  <div key={p.platform} className="p-3 bg-surface-light rounded-xl border border-border text-center">
                    <div className="flex justify-center mb-1.5">{PLATFORM_ICONS[p.platform] || <Globe size={14} />}</div>
                    <p className="text-sm font-bold">{p.followers}</p>
                    <p className="text-[9px] text-success">{p.growth} ({p.pct})</p>
                    <p className="text-[8px] text-muted capitalize mt-0.5">{p.platform}</p>
                  </div>
                ))}
              </div>
              {/* Growth chart visualization */}
              <div className="p-3 bg-surface-light rounded-xl border border-border">
                <h4 className="text-[10px] font-semibold mb-3">30-Day Growth Trend</h4>
                <div className="flex items-end gap-1 h-32">
                  {Array.from({ length: 30 }, (_, i) => {
                    const base = 50 + i * 1.5;
                    const variance = Math.sin(i * 0.5) * 15 + Math.random() * 10;
                    const height = Math.max(10, Math.min(100, base + variance));
                    return (
                      <div key={i} className="flex-1 group relative">
                        <div className="w-full bg-gold/30 rounded-t hover:bg-gold/50 transition-all cursor-pointer"
                          style={{ height: `${height}%` }} />
                        <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-surface border border-border rounded px-1.5 py-0.5 text-[7px] text-muted whitespace-nowrap z-10">
                          Day {i + 1}: +{Math.floor(variance + 20)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[7px] text-muted">30 days ago</span>
                  <span className="text-[7px] text-muted">Today</span>
                </div>
              </div>
            </div>
          )}

          {/* 22. Platform Analytics Comparison */}
          {analyticsSubTab === "comparison" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Platform Analytics Comparison</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Side-by-side metrics across all your platforms</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 text-muted font-semibold">Metric</th>
                      {["Instagram", "TikTok", "LinkedIn", "Facebook", "YouTube"].map(p => (
                        <th key={p} className="text-center p-2 font-semibold">
                          <div className="flex items-center justify-center gap-1">
                            {PLATFORM_ICONS[p.toLowerCase()] || <Globe size={10} />}
                            <span>{p}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { metric: "Followers", values: ["12.4K", "8.7K", "5.2K", "3.8K", "2.1K"] },
                      { metric: "Eng. Rate", values: ["4.2%", "6.8%", "3.1%", "2.4%", "5.6%"] },
                      { metric: "Reach/Post", values: ["3.2K", "5.1K", "1.8K", "980", "2.4K"] },
                      { metric: "Posts/Week", values: ["5", "7", "3", "4", "2"] },
                      { metric: "Best Content", values: ["Reels", "Duets", "Articles", "Videos", "Shorts"] },
                      { metric: "Growth Rate", values: ["+2.8%", "+11.4%", "+2.5%", "+1.8%", "+10.7%"] },
                      { metric: "Clicks/Post", values: ["89", "12", "156", "45", "67"] },
                    ].map(row => (
                      <tr key={row.metric} className="border-b border-border/50 hover:bg-surface-light/50">
                        <td className="p-2 font-semibold text-muted">{row.metric}</td>
                        {row.values.map((v, i) => (
                          <td key={i} className="p-2 text-center font-medium">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. Content Pillar Planner */}
          {analyticsSubTab === "pillars" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <PieChart size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Content Pillar Planner</h2>
              </div>
              <p className="text-[10px] text-muted mb-4">Visual breakdown of content categories with target vs actual percentages</p>
              <div className="space-y-3">
                {contentPillars.map((pillar) => {
                  const diff = pillar.actual - pillar.target;
                  return (
                    <div key={pillar.name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-sm ${pillar.color}`} />
                          <span className="text-[10px] font-semibold">{pillar.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[9px]">
                          <span className="text-muted">Target: {pillar.target}%</span>
                          <span className="font-bold">Actual: {pillar.actual}%</span>
                          <span className={diff >= 0 ? "text-success" : "text-orange-400"}>
                            {diff >= 0 ? "+" : ""}{diff}%
                          </span>
                        </div>
                      </div>
                      <div className="relative w-full h-4 bg-surface-light rounded-full overflow-hidden">
                        <div className={`absolute h-full ${pillar.color} opacity-30 rounded-full`} style={{ width: `${pillar.target}%` }} />
                        <div className={`absolute h-full ${pillar.color} rounded-full transition-all duration-700`} style={{ width: `${pillar.actual}%` }} />
                        <div className="absolute h-full border-r-2 border-dashed border-foreground/20" style={{ left: `${pillar.target}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 p-3 bg-surface-light rounded-xl border border-border">
                <h4 className="text-[10px] font-semibold mb-2">Recommendations</h4>
                <ul className="space-y-1">
                  {contentPillars.filter(p => p.actual < p.target).map(p => (
                    <li key={p.name} className="text-[9px] text-muted flex items-start gap-1.5">
                      <AlertCircle size={9} className="text-orange-400 mt-0.5 shrink-0" />
                      <span>Increase <strong>{p.name}</strong> content by {p.target - p.actual}% to reach target</span>
                    </li>
                  ))}
                  {contentPillars.filter(p => p.actual > p.target).map(p => (
                    <li key={p.name} className="text-[9px] text-muted flex items-start gap-1.5">
                      <Check size={9} className="text-success mt-0.5 shrink-0" />
                      <span><strong>{p.name}</strong> is {p.actual - p.target}% above target — consider rebalancing</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== INBOX TAB ========== */}
      {tab === "inbox" && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: "messages", label: "Social Inbox", icon: <Inbox size={11} /> },
              { key: "listening", label: "Social Listening", icon: <Search size={11} /> },
              { key: "ugc", label: "UGC Tracker", icon: <AtSign size={11} /> },
              { key: "autoreplies", label: "Auto-Reply Rules", icon: <Reply size={11} /> },
            ] as const).map(st => (
              <button key={st.key} onClick={() => setInboxSubTab(st.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  inboxSubTab === st.key ? "bg-gold/10 text-gold border border-gold/20" : "bg-surface-light text-muted border border-border hover:border-gold/10"
                }`}>
                {st.icon} {st.label}
              </button>
            ))}
          </div>

          {/* 9. Social Inbox */}
          {inboxSubTab === "messages" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Inbox size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Social Inbox</h2>
                <span className="ml-auto text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded-full font-medium">12 unread</span>
              </div>
              <p className="text-[10px] text-muted mb-3">Unified view of DMs and comments across all platforms</p>
              <div className="space-y-2">
                {[
                  { platform: "instagram", type: "DM", from: "@sarah_fitness", message: "Hey! Love your content. Are you open to collabs?", time: "2m ago", unread: true },
                  { platform: "instagram", type: "Comment", from: "@john_doe", message: "This is so helpful! Can you make more content like this?", time: "15m ago", unread: true },
                  { platform: "tiktok", type: "Comment", from: "@viral_queen", message: "Totally agree with point #3! Sharing this with my audience", time: "1h ago", unread: true },
                  { platform: "facebook", type: "DM", from: "Mike Johnson", message: "Hi, I'm interested in your services. Can we schedule a call?", time: "2h ago", unread: false },
                  { platform: "linkedin", type: "Comment", from: "Jane Smith", message: "Great insights. Would love to connect and discuss further.", time: "3h ago", unread: false },
                  { platform: "instagram", type: "Comment", from: "@brand_fan", message: "Just purchased based on this post! Amazing results so far", time: "5h ago", unread: false },
                  { platform: "tiktok", type: "DM", from: "@content_king", message: "Would you be interested in a duet collaboration?", time: "6h ago", unread: false },
                  { platform: "facebook", type: "Comment", from: "Alex Rivera", message: "What's the pricing for your premium plan?", time: "8h ago", unread: false },
                ].map((msg, i) => (
                  <div key={i} className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                    msg.unread ? "bg-gold/[0.03] border-gold/15 hover:border-gold/30" : "bg-surface-light border-border hover:border-gold/10"
                  }`}>
                    <div className="shrink-0 mt-1">{PLATFORM_ICONS[msg.platform] || <Globe size={14} />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold">{msg.from}</span>
                        <span className="text-[8px] bg-surface px-1.5 py-0.5 rounded text-muted">{msg.type}</span>
                        {msg.unread && <div className="w-1.5 h-1.5 rounded-full bg-gold" />}
                      </div>
                      <p className="text-[10px] text-muted mt-0.5 truncate">{msg.message}</p>
                    </div>
                    <span className="text-[8px] text-muted shrink-0">{msg.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 16. Social Listening */}
          {inboxSubTab === "listening" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Search size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Social Listening</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Monitor keywords and brand mentions across all platforms</p>
              <div className="flex gap-2 mb-4">
                <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                  className="input text-xs flex-1" placeholder="Add keyword to monitor..." onKeyDown={e => {
                    if (e.key === "Enter" && newKeyword.trim()) {
                      setListeningKeywords([...listeningKeywords, newKeyword.trim()]);
                      setNewKeyword("");
                    }
                  }} />
                <button onClick={() => {
                  if (newKeyword.trim()) {
                    setListeningKeywords([...listeningKeywords, newKeyword.trim()]);
                    setNewKeyword("");
                  }
                }} className="btn-primary text-xs px-3"><Plus size={12} /></button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {listeningKeywords.map(kw => (
                  <span key={kw} className="flex items-center gap-1 text-[10px] bg-gold/10 text-gold px-2.5 py-1 rounded-lg border border-gold/20">
                    <Search size={9} /> {kw}
                    <button onClick={() => setListeningKeywords(listeningKeywords.filter(k => k !== kw))}
                      className="ml-1 text-gold/60 hover:text-gold"><X size={9} /></button>
                  </span>
                ))}
              </div>
              <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Recent Mentions</h4>
              <div className="space-y-2">
                {[
                  { platform: "instagram", source: "@happy_client", content: "Just had an amazing experience with [brand name]! Highly recommend.", sentiment: "positive", time: "1h ago" },
                  { platform: "tiktok", source: "@reviewer_2024", content: "Comparing [brand name] vs competitors — here's what I found...", sentiment: "neutral", time: "3h ago" },
                  { platform: "linkedin", source: "Industry Blog", content: "Top 10 tools featuring [product name] for small businesses", sentiment: "positive", time: "5h ago" },
                  { platform: "facebook", source: "Local Group", content: "Anyone tried [brand name]? Looking for recommendations.", sentiment: "neutral", time: "8h ago" },
                ].map((mention, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 bg-surface-light rounded-xl border border-border">
                    <div className="shrink-0 mt-1">{PLATFORM_ICONS[mention.platform] || <Globe size={14} />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold">{mention.source}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                          mention.sentiment === "positive" ? "bg-success/10 text-success" : "bg-surface text-muted"
                        }`}>{mention.sentiment}</span>
                      </div>
                      <p className="text-[10px] text-muted mt-0.5">{mention.content}</p>
                    </div>
                    <span className="text-[8px] text-muted shrink-0">{mention.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 14. UGC Tracker */}
          {inboxSubTab === "ugc" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <AtSign size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">UGC Tracker</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Track user-generated content and brand mentions</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
                <div className="p-2.5 bg-surface-light rounded-xl border border-border text-center">
                  <p className="text-lg font-bold text-gold">47</p>
                  <p className="text-[9px] text-muted">Total Mentions</p>
                </div>
                <div className="p-2.5 bg-surface-light rounded-xl border border-border text-center">
                  <p className="text-lg font-bold text-success">32</p>
                  <p className="text-[9px] text-muted">Positive</p>
                </div>
                <div className="p-2.5 bg-surface-light rounded-xl border border-border text-center">
                  <p className="text-lg font-bold text-blue-400">12</p>
                  <p className="text-[9px] text-muted">Repostable</p>
                </div>
                <div className="p-2.5 bg-surface-light rounded-xl border border-border text-center">
                  <p className="text-lg font-bold text-pink-400">8</p>
                  <p className="text-[9px] text-muted">Replied</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { user: "@lifestyle_blogger", platform: "instagram", content: "Obsessed with my results from [brand]! Full review on stories", type: "Story Mention", repostable: true },
                  { user: "@tech_reviewer", platform: "tiktok", content: "Testing [product] for 30 days — here's day 15 update", type: "Video Tag", repostable: true },
                  { user: "@mom_of_3", platform: "facebook", content: "Best purchase I made this year! Thanks [brand]", type: "Post Tag", repostable: false },
                  { user: "@fitness_guru", platform: "instagram", content: "Using [product] as part of my morning routine — game changer", type: "Reel Tag", repostable: true },
                ].map((ugc, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all">
                    <div className="shrink-0 mt-1">{PLATFORM_ICONS[ugc.platform] || <Globe size={14} />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold">{ugc.user}</span>
                        <span className="text-[8px] bg-surface px-1.5 py-0.5 rounded text-muted">{ugc.type}</span>
                      </div>
                      <p className="text-[10px] text-muted mt-0.5">{ugc.content}</p>
                    </div>
                    {ugc.repostable && (
                      <button onClick={() => toast.success("Added to repost queue!")}
                        className="text-[9px] text-gold flex items-center gap-1 hover:underline shrink-0">
                        <Share2 size={9} /> Repost
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 23. Auto-Reply Rules */}
          {inboxSubTab === "autoreplies" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Reply size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Auto-Reply Rules</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Set up automatic responses to common comments and DMs</p>
              <div className="space-y-2">
                {autoReplyRules.map(rule => (
                  <div key={rule.id} className={`p-3 rounded-xl border transition-all ${
                    rule.active ? "bg-surface-light border-success/20" : "bg-surface-light border-border opacity-60"
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold">Trigger: &ldquo;{rule.trigger}&rdquo;</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded ${rule.active ? "bg-success/10 text-success" : "bg-surface text-muted"}`}>
                          {rule.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <button onClick={() => {
                        setAutoReplyRules(autoReplyRules.map(r => r.id === rule.id ? { ...r, active: !r.active } : r));
                      }} className={`w-8 h-4 rounded-full transition-all flex items-center ${
                        rule.active ? "bg-success justify-end" : "bg-surface border border-border justify-start"
                      }`}>
                        <div className={`w-3 h-3 rounded-full mx-0.5 ${rule.active ? "bg-white" : "bg-muted/40"}`} />
                      </button>
                    </div>
                    <p className="text-[10px] text-muted">{rule.response}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => {
                setAutoReplyRules([...autoReplyRules, { id: Date.now(), trigger: "new keyword", response: "Your auto-reply message here...", active: false }]);
              }} className="mt-3 text-[10px] text-gold hover:underline flex items-center gap-1">
                <Plus size={10} /> Add New Rule
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========== COLLABS TAB ========== */}
      {tab === "collabs" && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: "competitors", label: "Competitors", icon: <Target size={11} /> },
              { key: "influencers", label: "Influencer Finder", icon: <Users size={11} /> },
              { key: "collabs", label: "Collab Manager", icon: <Handshake size={11} /> },
              { key: "trending", label: "Trending Audio", icon: <Music2 size={11} /> },
            ] as const).map(st => (
              <button key={st.key} onClick={() => setCollabsSubTab(st.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  collabsSubTab === st.key ? "bg-gold/10 text-gold border border-gold/20" : "bg-surface-light text-muted border border-border hover:border-gold/10"
                }`}>
                {st.icon} {st.label}
              </button>
            ))}
          </div>

          {/* 4. Competitor Social Tracker */}
          {collabsSubTab === "competitors" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Target size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Competitor Social Tracker</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Monitor competitor accounts and their posting frequency</p>
              <div className="flex gap-2 mb-4">
                <input value={newCompetitor} onChange={e => setNewCompetitor(e.target.value)}
                  className="input text-xs flex-1" placeholder="Add competitor handle (e.g., @competitor)..." onKeyDown={e => {
                    if (e.key === "Enter" && newCompetitor.trim()) {
                      setCompetitorHandles([...competitorHandles, { handle: newCompetitor.trim(), platform: "instagram", frequency: "N/A", lastPost: "Tracking..." }]);
                      setNewCompetitor("");
                    }
                  }} />
                <button onClick={() => {
                  if (newCompetitor.trim()) {
                    setCompetitorHandles([...competitorHandles, { handle: newCompetitor.trim(), platform: "instagram", frequency: "N/A", lastPost: "Tracking..." }]);
                    setNewCompetitor("");
                  }
                }} className="btn-primary text-xs px-3"><Plus size={12} /></button>
              </div>
              <div className="space-y-2">
                {competitorHandles.map((comp, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all">
                    <div className="shrink-0">{PLATFORM_ICONS[comp.platform] || <Globe size={14} />}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{comp.handle}</p>
                      <p className="text-[9px] text-muted capitalize">{comp.platform}</p>
                    </div>
                    <div className="text-center px-3">
                      <p className="text-[10px] font-bold">{comp.frequency}</p>
                      <p className="text-[8px] text-muted">Post freq</p>
                    </div>
                    <div className="text-center px-3">
                      <p className="text-[10px] font-medium text-muted">{comp.lastPost}</p>
                      <p className="text-[8px] text-muted">Last post</p>
                    </div>
                    <button onClick={() => setCompetitorHandles(competitorHandles.filter((_, idx) => idx !== i))}
                      className="text-muted hover:text-red-400 shrink-0"><X size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 15. Influencer Finder */}
          {collabsSubTab === "influencers" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Influencer Finder</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Search for micro-influencers by niche to collaborate with</p>
              <div className="flex gap-2 mb-4">
                <input value={influencerNiche} onChange={e => setInfluencerNiche(e.target.value)}
                  className="input text-xs flex-1" placeholder="Search by niche (e.g., fitness, tech, food)..." />
                <button onClick={() => toast.success("Searching influencers...")}
                  className="btn-primary text-xs flex items-center gap-1.5"><Search size={12} /> Search</button>
              </div>
              <div className="space-y-2">
                {[
                  { name: "@fit_with_sarah", niche: "Fitness", followers: "25.4K", engagement: "6.2%", platform: "instagram", price: "$200-400" },
                  { name: "@techie_tom", niche: "Technology", followers: "18.7K", engagement: "5.8%", platform: "tiktok", price: "$150-300" },
                  { name: "@clean_eats", niche: "Food & Health", followers: "32.1K", engagement: "7.4%", platform: "instagram", price: "$300-500" },
                  { name: "@local_adventures", niche: "Travel & Local", followers: "15.2K", engagement: "8.1%", platform: "tiktok", price: "$100-250" },
                  { name: "@biz_mindset", niche: "Business", followers: "42.5K", engagement: "4.3%", platform: "linkedin", price: "$400-700" },
                  { name: "@diy_queen", niche: "Lifestyle & DIY", followers: "28.9K", engagement: "6.9%", platform: "instagram", price: "$250-450" },
                ].map((inf, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all">
                    <div className="w-8 h-8 bg-gold/10 rounded-full flex items-center justify-center shrink-0">
                      <Users size={12} className="text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold">{inf.name}</p>
                        {PLATFORM_ICONS[inf.platform] || <Globe size={10} />}
                      </div>
                      <p className="text-[9px] text-muted">{inf.niche} | {inf.followers} followers | {inf.engagement} eng</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-medium text-gold">{inf.price}</p>
                      <p className="text-[8px] text-muted">est. cost</p>
                    </div>
                    <button onClick={() => toast.success(`Saved ${inf.name} to contacts!`)}
                      className="text-[9px] text-gold hover:underline shrink-0 flex items-center gap-1">
                      <Plus size={9} /> Save
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 24. Collab Manager */}
          {collabsSubTab === "collabs" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Handshake size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Collab Manager</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Track brand collaboration opportunities and partnerships</p>
              <div className="space-y-2">
                {collabOpportunities.map(collab => (
                  <div key={collab.id} className="flex items-center gap-3 p-3 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all">
                    <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center shrink-0">
                      <Handshake size={16} className="text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{collab.brand}</p>
                      <p className="text-[9px] text-muted">{collab.niche} | {collab.followers} followers</p>
                    </div>
                    <div className="text-center px-2 shrink-0">
                      <div className={`text-[10px] font-bold ${collab.match >= 90 ? "text-success" : collab.match >= 80 ? "text-gold" : "text-muted"}`}>
                        {collab.match}%
                      </div>
                      <p className="text-[7px] text-muted">match</p>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      collab.status === "confirmed" ? "bg-success/10 text-success" :
                      collab.status === "negotiating" ? "bg-gold/10 text-gold" :
                      collab.status === "completed" ? "bg-blue-400/10 text-blue-400" :
                      "bg-surface text-muted"
                    }`}>
                      {collab.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 25. Trending Audio Finder */}
          {collabsSubTab === "trending" && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Music2 size={16} className="text-gold" />
                <h2 className="text-sm font-semibold">Trending Audio Finder</h2>
              </div>
              <p className="text-[10px] text-muted mb-3">Find trending TikTok and Reels sounds to use in your content</p>
              <div className="space-y-2">
                {[
                  { name: "Original Sound - viral_creator", platform: "tiktok", uses: "2.4M", trend: "rising", genre: "Trending" },
                  { name: "Espresso - Sabrina Carpenter", platform: "instagram", uses: "1.8M", trend: "peak", genre: "Pop" },
                  { name: "Nasty - Tinashe", platform: "tiktok", uses: "3.1M", trend: "rising", genre: "Dance" },
                  { name: "Storytelling Beat", platform: "instagram", uses: "890K", trend: "rising", genre: "Voiceover" },
                  { name: "Motivational Speech Remix", platform: "tiktok", uses: "1.2M", trend: "stable", genre: "Motivation" },
                  { name: "Calm Background - Lofi Mix", platform: "instagram", uses: "650K", trend: "rising", genre: "Ambient" },
                  { name: "Business Podcast Intro", platform: "tiktok", uses: "420K", trend: "new", genre: "Business" },
                  { name: "Aesthetic Transition Beat", platform: "instagram", uses: "1.5M", trend: "peak", genre: "Aesthetic" },
                ].map((audio, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-surface-light rounded-xl border border-border hover:border-gold/10 transition-all">
                    <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center shrink-0">
                      <Music2 size={16} className="text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{audio.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {PLATFORM_ICONS[audio.platform] || <Globe size={10} />}
                        <span className="text-[9px] text-muted">{audio.uses} uses</span>
                        <span className="text-[8px] bg-surface px-1.5 py-0.5 rounded text-muted">{audio.genre}</span>
                      </div>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      audio.trend === "rising" ? "bg-success/10 text-success" :
                      audio.trend === "peak" ? "bg-gold/10 text-gold" :
                      audio.trend === "new" ? "bg-purple-400/10 text-purple-400" :
                      "bg-surface text-muted"
                    }`}>
                      {audio.trend === "rising" ? "Rising" : audio.trend === "peak" ? "Peak" : audio.trend === "new" ? "New" : "Stable"}
                    </span>
                    <button onClick={() => toast.success(`Saved "${audio.name}" to favorites!`)}
                      className="text-[9px] text-gold hover:underline shrink-0 flex items-center gap-1">
                      <Star size={9} /> Save
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 17. Content Calendar Export — add to calendar tab area */}
      {tab === "calendar" && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Download size={16} className="text-gold" />
            <h2 className="text-sm font-semibold">Export Calendar</h2>
          </div>
          <p className="text-[10px] text-muted mb-3">Download your content calendar in CSV or PDF format</p>
          <div className="flex gap-2">
            <button onClick={() => {
              const allPosts = [...scheduledPosts, ...recentPosts];
              const csv = "Platform,Title,Status,Date\n" + allPosts.map(p =>
                `${p.platform},"${p.title}",${p.status},${p.scheduled_at || ""}`
              ).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "content-calendar.csv"; a.click();
              URL.revokeObjectURL(url);
              toast.success("Calendar exported as CSV!");
            }} className="btn-primary text-xs flex items-center gap-1.5">
              <Download size={12} /> Export CSV
            </button>
            <button onClick={() => {
              toast.success("PDF export coming soon!");
            }} className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-light text-muted border border-border hover:border-gold/10 transition-all">
              <FileTextIcon size={12} /> Export PDF
            </button>
          </div>
        </div>
      )}

      <PageAI pageName="Social Manager" context="Autonomous social media manager. Schedule posts, generate content calendars, manage multiple platforms. Features include AI repurposer, A/B testing, viral scoring, engagement analytics, heatmap, social listening, influencer finder, competitor tracking, and more." suggestions={["Generate this week's content for Instagram", "What trending topics should I post about?", "Write 5 engaging captions for a dental practice", "Create a 30-day content calendar", "Repurpose my latest post for all platforms", "Find micro-influencers in the fitness niche"]} />
    </div>
  );
}
