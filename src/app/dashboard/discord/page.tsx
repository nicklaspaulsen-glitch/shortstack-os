"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Hash, Users, MessageSquare, Volume2, Server, Shield,
  Zap, Terminal, BarChart3, UserCheck, Globe,
  Calendar, Code, Link, Megaphone, Trash2, Plus, Check,
  Copy, TrendingUp, AlertTriangle, Edit3,
  Search, Send, Smile, LogIn, Bell, Sparkles, ExternalLink, Unlink, Loader, Bot
} from "lucide-react";
import toast from "react-hot-toast";
import { PrismPanel } from "@/components/prism";
import { useAuth } from "@/lib/auth-context";
import { MotionPage } from "@/components/motion/motion-page";

interface TrinityIntegration {
  id: string;
  guild_id: string;
  guild_name: string | null;
  icon_hash: string | null;
  installed_at: string;
  notifications_enabled: boolean;
  notify_channel_id: string | null;
  notify_on: Record<string, boolean>;
}

interface GuildChannel {
  id: string;
  name: string;
  type: number;
}

const NOTIFY_CATEGORIES: { key: string; label: string; desc: string }[] = [
  { key: "new_client", label: "New client", desc: "When an onboarding form is completed" },
  { key: "new_lead", label: "New lead", desc: "When a lead is scraped, imported, or replies" },
  { key: "milestone", label: "Milestone", desc: "Revenue, follower, or MRR milestones reached" },
  { key: "workflow_complete", label: "Workflow complete", desc: "Automation pipeline finishes" },
  { key: "payment_received", label: "Payment received", desc: "Invoice is paid" },
];

const tabs = ["Install", "Servers", "Commands", "Auto-Roles", "Welcome", "Moderation", "Analytics", "Events", "Embeds", "Webhooks", "Announcements", "Insights"] as const;
type Tab = (typeof tabs)[number];


const dailyActivity = [
  { day: "Mon", messages: 0, members: 0 },
  { day: "Tue", messages: 0, members: 0 },
  { day: "Wed", messages: 0, members: 0 },
  { day: "Thu", messages: 0, members: 0 },
  { day: "Fri", messages: 0, members: 0 },
  { day: "Sat", messages: 0, members: 0 },
  { day: "Sun", messages: 0, members: 0 },
];

export default function DiscordPage() {
  const { profile } = useAuth();
  const isPlatformAdmin = profile?.role === "admin" || profile?.role === "founder";
  const [activeTab, setActiveTab] = useState<Tab>("Install");
  const [selectedServer, setSelectedServer] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [commandFilter, setCommandFilter] = useState("All");
  const [commands, setCommands] = useState<{ name: string; desc: string; category: string; enabled: boolean }[]>([]);
  const [autoRoles, setAutoRoles] = useState<{ id: string; trigger: string; role: string; color: string; enabled: boolean }[]>([]);
  const [modRules, setModRules] = useState<{ id: string; name: string; desc: string; action: string; enabled: boolean }[]>([]);
  const [welcomeMsg, setWelcomeMsg] = useState("Welcome to {server}, {user}! Check out #rules and introduce yourself in #general.");
  const [welcomeDm, setWelcomeDm] = useState(true);
  const [welcomeChannel, setWelcomeChannel] = useState(true);
  const [welcomeRole, setWelcomeRole] = useState("Member");
  const [embedTitle, setEmbedTitle] = useState("");
  const [embedDesc, setEmbedDesc] = useState("");
  const [embedColor, setEmbedColor] = useState("#5865F2");
  const [embedFooter, setEmbedFooter] = useState("");
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [searchMembers, setSearchMembers] = useState("");

  // --- Public bot install state ---
  const [integrations, setIntegrations] = useState<TrinityIntegration[]>([]);
  const [installing, setInstalling] = useState(false);
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  const [channelsByIntegration, setChannelsByIntegration] = useState<Record<string, GuildChannel[]>>({});

  useEffect(() => {
    loadIntegrations();
  }, []);

  async function loadIntegrations() {
    setLoadingIntegrations(true);
    try {
      const res = await fetch("/api/integrations/discord/settings");
      if (!res.ok) return;
      const data = await res.json();
      const list: TrinityIntegration[] = data.integrations || [];
      setIntegrations(list);
      // Prefetch channels for each integration
      list.forEach(async (i) => {
        try {
          const r = await fetch(`/api/integrations/discord/channels?integration_id=${i.id}`);
          if (r.ok) {
            const d = await r.json();
            setChannelsByIntegration(prev => ({ ...prev, [i.id]: d.channels || [] }));
          }
        } catch { /* ignore */ }
      });
    } finally {
      setLoadingIntegrations(false);
    }
  }

  async function startInstall() {
    setInstalling(true);
    try {
      const res = await fetch("/api/integrations/discord/install-url");
      const data = await res.json();
      if (data.install_url) {
        window.location.href = data.install_url;
      } else {
        toast.error(data.error || "Discord isn't enabled on this workspace yet. Reach out to your platform admin to switch it on.");
      }
    } catch (err) {
      console.error("[discord] install-url failed:", err);
      toast.error("Failed to start install");
    } finally {
      setInstalling(false);
    }
  }

  async function updateIntegration(id: string, patch: Partial<TrinityIntegration>) {
    // Optimistic
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, ...patch } as TrinityIntegration : i));
    await fetch("/api/integrations/discord/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
  }

  async function removeIntegration(id: string) {
    if (!confirm("Remove this Discord integration? The bot will stop posting to this server.")) return;
    const prev = integrations;
    setIntegrations(prev.filter(i => i.id !== id));
    try {
      const res = await fetch("/api/integrations/discord/settings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        setIntegrations(prev);
        toast.error("Failed to remove integration");
      } else {
        toast.success("Integration removed");
      }
    } catch (err) {
      console.error("[discord] removeIntegration failed:", err);
      setIntegrations(prev);
      toast.error("Failed to remove integration");
    }
  }

  /** Banner shown on tabs whose UI exists but has no backend yet. */
  function PreviewBanner() {
    return (
      <MotionPage className="card border-warning/20 bg-warning/5"><div className="flex items-start gap-2">
                  <AlertTriangle size={12} className="text-warning shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted leading-relaxed">
                    <strong className="text-foreground">Preview only.</strong> This tab&apos;s UI is wired up for review; server-side wiring for moderation, analytics, and custom commands ships later. For now use the <span className="text-foreground">Install</span> tab to connect a server and receive real-time pings.
                  </p>
                </div></MotionPage>
    );
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function toggleCommand(name: string) {
    setCommands(prev => prev.map(c => c.name === name ? { ...c, enabled: !c.enabled } : c));
  }

  function toggleAutoRole(id: string) {
    setAutoRoles(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }

  function toggleModRule(id: string) {
    setModRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }

  const maxMessages = Math.max(...dailyActivity.map(d => d.messages));
  const currentServer = undefined as { name: string } | undefined;

  return (
    <div className="fade-in space-y-6 max-w-[1200px] mx-auto">
      {/* -- Discord command strip -- */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0">
          <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">DISCORD</p>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Discord</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted">No servers connected</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4">
        {/* Focal tile */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          className="flex items-start gap-3 bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
        >
          <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-[#2563EB] to-[#3B82F6] shrink-0" />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Bot Status</p>
            <p className="font-display text-3xl font-bold tracking-[-0.03em] text-green-500 tabular-nums">Online</p>
          </div>
        </motion.div>
        {/* Servers */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.10, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Servers</p>
          <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">0</p>
        </motion.div>
        {/* Total Members */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Total Members</p>
          <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">0</p>
        </motion.div>
        {/* Total Channels */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Total Channels</p>
          <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">0</p>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${activeTab === t ? "border-[#2563EB] text-[#2563EB]" : "border-transparent text-muted hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Install Tab � public Trinity bot */}
      {activeTab === "Install" && (
        <div className="space-y-5">
          {/* Hero / pitch */}
          <div className="rounded-xl p-6" style={{ background: "linear-gradient(135deg, rgba(88,101,242,0.08), rgba(88,101,242,0.03), transparent)", border: "1px solid rgba(0,0,0,0.08)" }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#5865F2]/20 flex items-center justify-center shrink-0">
                <Bot size={24} className="text-[#5865F2]" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold mb-1">Install Trinity in your own Discord</h2>
                <p className="text-xs text-muted leading-relaxed mb-4">
                  Trinity is a public Discord bot. Your agency, your clients, or any partner team can install
                  Trinity in their own server in one click � then get real-time pings, slash commands, and AI
                  digests right where your team already talks.
                </p>
                <button
                  onClick={startInstall}
                  disabled={installing}
                  className="inline-flex items-center gap-2 text-xs bg-[#5865F2] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#4752C4] disabled:opacity-60"
                >
                  {installing ? <Loader size={14} className="animate-spin" /> : <LogIn size={14} />}
                  Add Trinity to Discord
                </button>
              </div>
            </div>
          </div>

          {/* Why-it's-useful grid */}
          <div>
            <h3 className="section-header">Why agencies put Trinity in Discord</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { icon: Bell, color: "text-[#5865F2]", title: "Real-time agency status in your team's Discord",
                  desc: "Never miss a client signup, booked call, outreach reply, or paid invoice � it pings the channel you pick, the second it happens." },
                { icon: Terminal, color: "text-[#2563EB]", title: "Slash commands anywhere",
                  desc: "Run /trinity-status, /trinity-check <client>, /trinity-lead add <business> from any channel. No dashboard switch." },
                { icon: Sparkles, color: "text-purple-400", title: "AI-written weekly digest",
                  desc: "Every Monday at 9am, Trinity posts a plain-English summary of the past week's revenue, leads, and wins." },
                { icon: MessageSquare, color: "text-green-400", title: "Tag @Trinity to ask questions",
                  desc: "Team members can @-mention Trinity with a question � Claude answers with real data pulled from your workspace." },
                { icon: Users, color: "text-cyan-400", title: "Everyone stays aligned",
                  desc: "Account managers, cold-call team, designers, clients � one Discord, one source of truth." },
                { icon: Shield, color: "text-muted", title: "Minimal permissions",
                  desc: "Trinity asks for Send Messages, Embed Links, Read History, and Slash Commands. Nothing else." },
              ].map((f, i) => (
                <motion.div
                  key={i}
                  className="rounded-xl p-4 flex items-start gap-3" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -4, scale: 1.01 }}
                >
                  <div className="w-8 h-8 rounded-lg bg-surface-light flex items-center justify-center shrink-0">
                    <f.icon size={16} className={f.color} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1">{f.title}</p>
                    <p className="text-[11px] text-muted leading-relaxed">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Installed integrations */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="section-header mb-0">Your installed servers</h3>
              {loadingIntegrations && <Loader size={12} className="animate-spin text-muted" />}
            </div>

            {integrations.length === 0 && !loadingIntegrations && (
              <div className="card p-6 text-center">
                <Server size={20} className="mx-auto mb-2 text-muted opacity-50" />
                <p className="text-xs text-muted">No servers connected yet. Click <strong className="text-foreground">Add Trinity to Discord</strong> above to install.</p>
              </div>
            )}

            <div className="space-y-3">
              {integrations.map((int, idx) => {
                const channels = channelsByIntegration[int.id] || [];
                return (
                  <motion.div
                    key={int.id}
                    className="rounded-xl p-4" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {int.icon_hash ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`https://cdn.discordapp.com/icons/${int.guild_id}/${int.icon_hash}.png?size=64`}
                            alt={int.guild_name ?? "Guild"}
                            className="w-10 h-10 rounded-lg"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[#5865F2]/10 flex items-center justify-center text-[#5865F2] font-bold text-sm">
                            {(int.guild_name || "?").charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold">{int.guild_name || "Unknown server"}</p>
                          <p className="text-[10px] text-muted">
                            Installed {new Date(int.installed_at).toLocaleDateString()} � guild ID <code className="font-mono">{int.guild_id}</code>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-[10px] text-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={int.notifications_enabled}
                            onChange={e => updateIntegration(int.id, { notifications_enabled: e.target.checked })}
                          />
                          Notifications on
                        </label>
                        <button
                          onClick={() => removeIntegration(int.id)}
                          className="text-[10px] text-muted hover:text-danger flex items-center gap-1"
                        >
                          <Unlink size={11} /> Remove
                        </button>
                      </div>
                    </div>

                    {/* Channel selector */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-muted font-semibold uppercase">Post notifications in</label>
                        <select
                          value={int.notify_channel_id || ""}
                          onChange={e => updateIntegration(int.id, { notify_channel_id: e.target.value || null })}
                          className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface"
                        >
                          <option value="">� Pick a channel �</option>
                          {channels.map(c => (
                            <option key={c.id} value={c.id}>#{c.name}</option>
                          ))}
                        </select>
                        {channels.length === 0 && (
                          <p className="text-[9px] text-muted mt-1">
                            No channels visible � make sure Trinity has View Channel permission in your server.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-[10px] text-muted font-semibold uppercase">Event categories</label>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          {NOTIFY_CATEGORIES.map(cat => {
                            const enabled = int.notify_on?.[cat.key] !== false;
                            return (
                              <label key={cat.key}
                                className="flex items-center gap-1.5 p-1.5 rounded bg-surface-light border border-border text-[10px] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={enabled}
                                  onChange={e => updateIntegration(int.id, {
                                    notify_on: { ...int.notify_on, [cat.key]: e.target.checked } as Record<string, boolean>,
                                  })}
                                />
                                <span title={cat.desc}>{cat.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Day-to-day usage */}
          <PrismPanel padding="p-5">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Zap size={14} className="text-[#2563EB]" /> What agencies actually do with it
            </h3>
            <ol className="space-y-2 text-[11px] text-muted leading-relaxed list-decimal list-inside">
              <li><strong className="text-foreground">Morning standup at 9:30am:</strong> team opens #trinity-ops in Discord, sees the overnight AI digest (leads, replies, revenue), and plans the day.</li>
              <li><strong className="text-foreground">Account manager gets a ping</strong> the moment a client pays an invoice � acknowledges with a reaction; Trinity logs it to the CRM.</li>
              <li><strong className="text-foreground">Cold-call rep runs</strong> <code className="font-mono">/trinity-lead add business:&quot;Acme Plumbing&quot; city:Dallas</code> straight from Discord � no tab switching.</li>
              <li><strong className="text-foreground">Designer asks</strong> <code className="font-mono">@Trinity what did we post for Acme this week?</code> � gets a list back with links.</li>
              <li><strong className="text-foreground">Founder checks</strong> <code className="font-mono">/trinity-status</code> on their phone in bed on a Sunday. MRR went up. They smile.</li>
            </ol>
          </PrismPanel>

          {/* Env vars � Trinity-internal admin/founder only. Clients should not see this. */}
          {isPlatformAdmin && (
            <div className="card p-4 border-warning/30 bg-warning/5">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle size={14} className="text-warning" /> Required env vars (set in Vercel)
              </h3>
              <ul className="space-y-1 text-[11px] font-mono">
                <li><code className="text-foreground">DISCORD_CLIENT_ID</code> <span className="text-muted">� app ID from the Discord Developer Portal</span></li>
                <li><code className="text-foreground">DISCORD_CLIENT_SECRET</code> <span className="text-muted">� app secret (server-side only)</span></li>
                <li><code className="text-foreground">DISCORD_BOT_TOKEN</code> <span className="text-muted">� bot token, used for bot-level API calls</span></li>
                <li><code className="text-foreground">DISCORD_PUBLIC_KEY</code> <span className="text-muted">� for verifying interaction webhook signatures</span></li>
                <li><code className="text-foreground">NEXT_PUBLIC_APP_URL</code> <span className="text-muted">� your app&apos;s public URL, used for the OAuth redirect</span></li>
              </ul>
              <a
                href="https://discord.com/developers/applications"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-3 text-[11px] text-[#2563EB] hover:underline"
              >
                <ExternalLink size={11} /> Open Discord Developer Portal
              </a>
            </div>
          )}
        </div>
      )}

      {/* Servers Tab */}
      {activeTab === "Servers" && (
        <div className="space-y-4">
          <PreviewBanner />
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Server size={20} className="text-muted mb-2" />
            <p className="text-xs text-muted">No servers connected yet.</p>
            <p className="text-[10px] text-muted mt-1">Install the Trinity bot above and connect your Discord server.</p>
          </div>
        </div>
      )}

      {/* Commands Tab */}
      {activeTab === "Commands" && (
        <div className="space-y-4">
          <PreviewBanner />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Manage slash commands. Toggle to enable/disable per server.</p>
            <div className="flex gap-1">
              {["All", "Info", "Reports", "Tools"].map(f => (
                <button key={f} onClick={() => setCommandFilter(f)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border ${commandFilter === f ? "border-[#2563EB] text-[#2563EB] bg-[rgba(37,99,235,0.05)]" : "border-border text-muted"}`}>{f}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {commands.filter(c => commandFilter === "All" || c.category === commandFilter).length === 0 && (
              <p className="text-xs text-muted text-center py-6">No commands available. Connect a server to see slash commands.</p>
            )}
            {commands.filter(c => commandFilter === "All" || c.category === commandFilter).map(cmd => (
              <div key={cmd.name} className="card p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#5865F2]/10 flex items-center justify-center"><Terminal size={14} className="text-[#5865F2]" /></div>
                  <div>
                    <p className="text-xs font-semibold font-mono">{cmd.name}</p>
                    <p className="text-[10px] text-muted">{cmd.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-surface-light border border-border">{cmd.category}</span>
                  <div onClick={() => toggleCommand(cmd.name)}
                    className={`w-9 h-5 rounded-full cursor-pointer transition-all flex items-center ${cmd.enabled ? "bg-green-500" : "bg-gray-300"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${cmd.enabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Custom Command Builder */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Code size={14} className="text-[#2563EB]" /> Custom Command Builder</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">Command Name</label>
                <input className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface" placeholder="/my-command" />
              </div>
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">Response Type</label>
                <select className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface">
                  <option>Text Response</option>
                  <option>Embed Response</option>
                  <option>API Call</option>
                  <option>Database Query</option>
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-[10px] text-muted font-semibold uppercase">Response Template</label>
              <textarea className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface h-20 resize-none" placeholder="Enter the bot response message..." />
            </div>
            <button className="mt-3 text-xs bg-[rgba(37,99,235,0.08)] text-[#2563EB] px-4 py-2 rounded-lg font-medium hover:bg-[rgba(37,99,235,0.12)]">Register Command</button>
          </div>
        </div>
      )}

      {/* Auto-Roles Tab */}
      {activeTab === "Auto-Roles" && (
        <div className="space-y-4">
          <PreviewBanner />
          <p className="text-xs text-muted">Automatically assign roles based on join events, reactions, or commands.</p>
          <div className="space-y-2">
            {autoRoles.length === 0 && (
              <p className="text-xs text-muted text-center py-4">No auto-roles configured.</p>
            )}
            {autoRoles.map(role => (
              <div key={role.id} className="card p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }} />
                  <div>
                    <p className="text-xs font-semibold">{role.role}</p>
                    <p className="text-[10px] text-muted">Trigger: {role.trigger}</p>
                  </div>
                </div>
                <div onClick={() => toggleAutoRole(role.id)}
                  className={`w-9 h-5 rounded-full cursor-pointer transition-all flex items-center ${role.enabled ? "bg-green-500" : "bg-gray-300"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${role.enabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                </div>
              </div>
            ))}
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Add New Auto-Role</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">Trigger Type</label>
                <select className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface">
                  <option>On Join</option>
                  <option>Reaction</option>
                  <option>Command</option>
                  <option>On Boost</option>
                  <option>Level Reached</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">Role Name</label>
                <input className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface" placeholder="Role name" />
              </div>
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">Color</label>
                <input type="color" defaultValue="#5865F2" className="w-full mt-1 h-9 border border-border rounded-lg bg-surface cursor-pointer" />
              </div>
            </div>
            <button className="mt-3 text-xs bg-[rgba(37,99,235,0.08)] text-[#2563EB] px-4 py-2 rounded-lg font-medium hover:bg-[rgba(37,99,235,0.12)]">Add Rule</button>
          </div>
        </div>
      )}

      {/* Welcome Tab */}
      {activeTab === "Welcome" && (
        <div className="space-y-4">
          <PreviewBanner />
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Smile size={14} className="text-[#2563EB]" /> Welcome Message Editor</h3>
            <div className="mb-3">
              <label className="text-[10px] text-muted font-semibold uppercase">Message Template</label>
              <textarea value={welcomeMsg} onChange={e => setWelcomeMsg(e.target.value)}
                className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface h-24 resize-none" />
              <p className="text-[9px] text-muted mt-1">Variables: {"{server}"}, {"{user}"}, {"{memberCount}"}, {"{date}"}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-light border border-border">
                <span className="text-xs">Send DM</span>
                <div onClick={() => setWelcomeDm(!welcomeDm)}
                  className={`w-9 h-5 rounded-full cursor-pointer transition-all flex items-center ${welcomeDm ? "bg-green-500" : "bg-gray-300"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${welcomeDm ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                </div>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-light border border-border">
                <span className="text-xs">Channel Post</span>
                <div onClick={() => setWelcomeChannel(!welcomeChannel)}
                  className={`w-9 h-5 rounded-full cursor-pointer transition-all flex items-center ${welcomeChannel ? "bg-green-500" : "bg-gray-300"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${welcomeChannel ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">Auto-Role</label>
                <select value={welcomeRole} onChange={e => setWelcomeRole(e.target.value)} className="w-full mt-0.5 text-xs border border-border rounded-lg px-3 py-1.5 bg-surface">
                  <option>Member</option>
                  <option>Guest</option>
                  <option>Client</option>
                  <option>None</option>
                </select>
              </div>
            </div>
            {/* Preview */}
            <div className="p-3 rounded-lg bg-[#36393f] border border-[#202225]">
              <p className="text-[10px] text-[#72767d] mb-1">PREVIEW</p>
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-xs font-bold">SS</div>
                <div>
                  <p className="text-xs font-semibold text-white">ShortStack Bot <span className="text-[9px] px-1 py-0.5 rounded bg-[#5865F2] text-white font-normal ml-1">BOT</span></p>
                  <p className="text-xs text-[#dcddde] mt-0.5">{welcomeMsg.replace("{server}", currentServer?.name || "Server").replace("{user}", "@NewMember")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Moderation Tab */}
      {activeTab === "Moderation" && (
        <div className="space-y-4">
          <PreviewBanner />
          <p className="text-xs text-muted">Auto-moderation rules to keep your community safe and clean.</p>
          <div className="space-y-2">
            {modRules.length === 0 && (
              <p className="text-xs text-muted text-center py-4">No moderation rules configured.</p>
            )}
            {modRules.map(rule => (
              <div key={rule.id} className="card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield size={14} className={rule.enabled ? "text-green-400" : "text-muted"} />
                    <div>
                      <p className="text-xs font-semibold">{rule.name}</p>
                      <p className="text-[10px] text-muted">{rule.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-400/10 text-red-400">{rule.action}</span>
                    <div onClick={() => toggleModRule(rule.id)}
                      className={`w-9 h-5 rounded-full cursor-pointer transition-all flex items-center ${rule.enabled ? "bg-green-500" : "bg-gray-300"}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${rule.enabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Mod log */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={14} className="text-yellow-400" /> Recent Mod Actions</h3>
            <div className="p-6 text-center text-muted text-xs">
              <AlertTriangle size={20} className="mx-auto mb-2 opacity-40" />
              <p>No mod actions yet. Once moderation rules are enabled and the bot is posted to a server, auto-mod events will show up here.</p>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === "Analytics" && (
        <div className="space-y-4">
          <PreviewBanner />
          <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4">
            {/* Focal tile */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              className="flex items-start gap-3 bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
            >
              <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-[#2563EB] to-[#3B82F6] shrink-0" />
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Messages Today</p>
                <p className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary tabular-nums">—</p>
              </div>
            </motion.div>
            {/* Active Members */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.10, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Active Members</p>
              <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">—</p>
            </motion.div>
            {/* New Members */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">New Members (7d)</p>
              <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">—</p>
            </motion.div>
            {/* Voice Hours */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Voice Hours (7d)</p>
              <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">—</p>
            </motion.div>
          </div>
          {/* Daily Activity Chart */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 size={14} className="text-[#2563EB]" /> Daily Activity</h3>
            <div className="flex items-end gap-2 h-32">
              {dailyActivity.map(d => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-muted">{d.messages}</span>
                  <div className="w-full rounded-t" style={{ height: `${(d.messages / maxMessages) * 100}%`, backgroundColor: "#5865F2" }} />
                  <span className="text-[9px] text-muted">{d.day}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Top Channels */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Top Active Channels</h3>
            <p className="text-xs text-muted text-center py-4">No channel data available.</p>
          </div>
        </div>
      )}

      {/* Events Tab */}
      {activeTab === "Events" && (
        <div className="space-y-4">
          <PreviewBanner />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Schedule and manage Discord events.</p>
            <button onClick={() => setShowNewEvent(!showNewEvent)} className="text-xs bg-[rgba(37,99,235,0.08)] text-[#2563EB] px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5">
              <Plus size={12} /> New Event
            </button>
          </div>
          {showNewEvent && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3">Create Event</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted font-semibold uppercase">Event Title</label>
                  <input className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface" placeholder="Event name" />
                </div>
                <div>
                  <label className="text-[10px] text-muted font-semibold uppercase">Channel</label>
                  <select className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface">
                    <option value="">No channels � connect a server first</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted font-semibold uppercase">Date</label>
                  <input type="date" className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface" />
                </div>
                <div>
                  <label className="text-[10px] text-muted font-semibold uppercase">Time</label>
                  <input type="time" className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface" />
                </div>
              </div>
              <button className="mt-3 text-xs bg-[rgba(37,99,235,0.08)] text-[#2563EB] px-4 py-2 rounded-lg font-medium">Create Event</button>
            </div>
          )}
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar size={18} className="text-muted mb-2" />
            <p className="text-xs text-muted">No events scheduled yet.</p>
          </div>
        </div>
      )}

      {/* Embeds Tab */}
      {activeTab === "Embeds" && (
        <div className="space-y-4">
          <PreviewBanner />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Builder */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Code size={14} className="text-[#2563EB]" /> Embed Builder</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-muted font-semibold uppercase">Title</label>
                  <input value={embedTitle} onChange={e => setEmbedTitle(e.target.value)}
                    className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface" placeholder="Embed title" />
                </div>
                <div>
                  <label className="text-[10px] text-muted font-semibold uppercase">Description</label>
                  <textarea value={embedDesc} onChange={e => setEmbedDesc(e.target.value)}
                    className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface h-20 resize-none" placeholder="Embed description..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted font-semibold uppercase">Color</label>
                    <input type="color" value={embedColor} onChange={e => setEmbedColor(e.target.value)} className="w-full mt-1 h-9 border border-border rounded-lg bg-surface cursor-pointer" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted font-semibold uppercase">Footer</label>
                    <input value={embedFooter} onChange={e => setEmbedFooter(e.target.value)}
                      className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface" placeholder="Footer text" />
                  </div>
                </div>
                <button className="text-xs bg-[rgba(37,99,235,0.08)] text-[#2563EB] px-4 py-2 rounded-lg font-medium hover:bg-[rgba(37,99,235,0.12)] w-full">
                  <Send size={12} className="inline mr-1.5" /> Send Embed
                </button>
              </div>
            </div>
            {/* Preview */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3">Preview</h3>
              <div className="p-3 rounded-lg bg-[#36393f] border border-[#202225]">
                <div className="flex gap-2">
                  <div className="w-1 rounded-full" style={{ backgroundColor: embedColor }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{embedTitle || "Embed Title"}</p>
                    <p className="text-xs text-[#dcddde] mt-1">{embedDesc || "Embed description will appear here..."}</p>
                    {embedFooter && (
                      <div className="mt-3 pt-2 border-t border-[#4f5660]">
                        <p className="text-[10px] text-[#72767d]">{embedFooter}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Saved Templates */}
              <div className="mt-4">
                <p className="text-[10px] text-muted font-semibold uppercase mb-2">Saved Templates</p>
                <div className="space-y-1.5">
                  {[
                    { name: "Welcome Embed", color: "#57F287" },
                    { name: "Announcement", color: "#FEE75C" },
                    { name: "Alert/Warning", color: "#ED4245" },
                    { name: "Info Card", color: "#5865F2" },
                  ].map(t => (
                    <div key={t.name} className="flex items-center gap-2 p-2 rounded-lg bg-surface-light text-xs cursor-pointer hover:bg-surface-light/80">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                      <span>{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === "Webhooks" && (
        <div className="space-y-4">
          <PreviewBanner />
          <p className="text-xs text-muted">Manage webhooks for external integrations and automated notifications.</p>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Link size={18} className="text-muted mb-2" />
            <p className="text-xs text-muted">No webhooks created yet.</p>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3">Create Webhook</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">Webhook Name</label>
                <input className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface" placeholder="e.g. Lead Alert" />
              </div>
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">Target Channel</label>
                <select className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface">
                  <option value="">No channels � connect a server first</option>
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-[10px] text-muted font-semibold uppercase">Trigger Event</label>
              <select className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface">
                <option>New Lead Created</option>
                <option>Client Health Changed</option>
                <option>Task Completed</option>
                <option>Daily Report Generated</option>
                <option>Error/Alert</option>
              </select>
            </div>
            <button className="mt-3 text-xs bg-[rgba(37,99,235,0.08)] text-[#2563EB] px-4 py-2 rounded-lg font-medium hover:bg-[rgba(37,99,235,0.12)]">Create Webhook</button>
          </div>
        </div>
      )}

      {/* Announcements Tab */}
      {activeTab === "Announcements" && (
        <div className="space-y-4">
          <PreviewBanner />
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Megaphone size={14} className="text-[#2563EB]" /> Schedule Announcement</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">Title</label>
                <input className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface" placeholder="Announcement title" />
              </div>
              <div>
                <label className="text-[10px] text-muted font-semibold uppercase">Content</label>
                <textarea value={announcementDraft} onChange={e => setAnnouncementDraft(e.target.value)}
                  className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface h-20 resize-none" placeholder="Write your announcement..." />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-muted font-semibold uppercase">Date & Time</label>
                  <input type="datetime-local" className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface" />
                </div>
                <div>
                  <label className="text-[10px] text-muted font-semibold uppercase">Channels</label>
                  <select className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface">
                    <option>#announcements</option>
                    <option>#general</option>
                    <option>All Channels</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted font-semibold uppercase">Mention</label>
                  <select className="w-full mt-1 text-xs border border-border rounded-lg px-3 py-2 bg-surface">
                    <option>@everyone</option>
                    <option>@here</option>
                    <option>No mention</option>
                  </select>
                </div>
              </div>
              <button className="text-xs bg-[rgba(37,99,235,0.08)] text-[#2563EB] px-4 py-2 rounded-lg font-medium hover:bg-[rgba(37,99,235,0.12)]">Schedule</button>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Megaphone size={18} className="text-muted mb-2" />
            <p className="text-xs text-muted">No announcements scheduled yet.</p>
          </div>
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === "Insights" && (
        <div className="space-y-4">
          <PreviewBanner />
          <div className="flex items-center gap-2 mb-2">
            <Search size={14} className="text-muted" />
            <input value={searchMembers} onChange={e => setSearchMembers(e.target.value)} placeholder="Search members..."
              className="text-xs rounded-lg px-3 py-1.5 flex-1 input" />
          </div>
          {/* Member Insights */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users size={14} className="text-[#2563EB]" /> Member Insights</h3>
            <div className="p-6 text-center text-muted text-xs">
              <Users size={24} className="mx-auto mb-2 opacity-40" />
              <p>No member data yet. Connect your Discord server to track activity and contributions.</p>
            </div>
          </div>
          {/* Engagement trends */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-green-400" /> Engagement Trends</h3>
            <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4">
              {/* Focal tile */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
                className="flex items-start gap-3 bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
              >
                <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-[#2563EB] to-[#3B82F6] shrink-0" />
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Avg Messages/Day</p>
                  <p className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary tabular-nums">0</p>
                </div>
              </motion.div>
              {/* Avg Active/Day */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.10, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
                className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Avg Active/Day</p>
                <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">0</p>
              </motion.div>
              {/* Retention */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
                className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Retention (30d)</p>
                <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">--</p>
              </motion.div>
              {/* Avg Session */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
                className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Avg Session</p>
                <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">--</p>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

