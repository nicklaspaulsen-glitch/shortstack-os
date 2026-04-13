"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Hash, Plus, Loader, Users, MessageSquare,
  Volume2, RefreshCw, ExternalLink, Copy, Check,
  Server, Shield, Bell, Zap, Terminal, BookOpen, Slash,
  BarChart3, HelpCircle, UserCheck, Globe, ArrowRight
} from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/modal";

interface DiscordServer {
  id: string;
  client_id: string;
  client_name: string;
  guild_id: string;
  guild_name: string;
  invite_url: string;
  channel_count: number;
  created_at: string;
}

interface HealthResult {
  bot_online: boolean;
  guild_found: boolean;
  guild_name: string;
  member_count: number;
  channels: Array<{ name: string; type: string; id: string; writable_by_everyone: boolean; bot_only: boolean }>;
  errors: string[];
}

export default function DiscordPage() {
  const [servers, setServers] = useState<DiscordServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [serverName, setServerName] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [clients, setClients] = useState<Array<{ id: string; business_name: string }>>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [commandsRegistered, setCommandsRegistered] = useState(false);
  const [healthResult, setHealthResult] = useState<HealthResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const supabase = createClient();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from("discord_servers").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, business_name").eq("is_active", true).order("business_name"),
    ]);
    setServers(s || []);
    setClients(c || []);
    setLoading(false);
  }

  async function createServer() {
    if (!serverName.trim()) { toast.error("Enter a server name"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/discord/create-server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: serverName,
          client_id: selectedClient || null,
        }),
      });
      const data = await res.json();
      if (data.guild_id) {
        // Save to DB
        const client = clients.find(c => c.id === selectedClient);
        await supabase.from("discord_servers").insert({
          client_id: selectedClient || null,
          client_name: client?.business_name || "Internal",
          guild_id: data.guild_id,
          guild_name: data.name,
          invite_url: data.invite_url,
          channel_count: data.channel_count || 7,
        });
        toast.success(`Server "${data.name}" created!`);
        setShowCreate(false);
        setServerName("");
        setSelectedClient("");
        fetchData();
      } else {
        toast.error(data.error || "Failed to create server");
      }
    } catch { toast.error("Connection error"); }
    setCreating(false);
  }

  function copyInvite(url: string, id: string) {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Invite link copied!");
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function registerCommands() {
    setRegistering(true);
    try {
      const res = await fetch("/api/discord/register-commands", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.registered} slash commands registered!`);
        setCommandsRegistered(true);
      } else {
        toast.error(data.error || "Failed to register commands");
      }
    } catch { toast.error("Connection error"); }
    setRegistering(false);
  }

  async function testHealth() {
    setHealthLoading(true);
    try {
      const res = await fetch("/api/discord/health");
      const data = await res.json();
      if (res.ok) {
        setHealthResult(data);
        if (data.errors?.length > 0) {
          toast.error(`Health check found ${data.errors.length} issue(s)`);
        } else {
          toast.success("Server health check passed!");
        }
      } else {
        toast.error(data.error || "Health check failed");
      }
    } catch { toast.error("Connection error"); }
    setHealthLoading(false);
  }

  const botCommands = [
    { name: "/status", desc: "Agent activity, leads today, active clients", icon: BarChart3, color: "text-success" },
    { name: "/leads", desc: "Last 5 scraped leads with details", icon: Users, color: "text-[#5865F2]" },
    { name: "/clients", desc: "Active clients, MRR, health scores", icon: UserCheck, color: "text-gold" },
    { name: "/report", desc: "Weekly MRR, leads, and outreach summary", icon: BookOpen, color: "text-purple-400" },
    { name: "/help", desc: "List all available bot commands", icon: HelpCircle, color: "text-muted" },
  ];

  const botConfigured = true; // Bot token exists in env

  return (
    <div className="fade-in space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#5865F2]/10 rounded-xl flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 71 55" fill="none"><path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.7 40.7 0 00-1.8 3.7 54 54 0 00-16.2 0A39.2 39.2 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9a.2.2 0 00-.1.1C1.5 18.7-.9 32.2.3 45.5v.1a58.7 58.7 0 0017.9 9.1.2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.7.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.3 36.3 0 01-5.5 2.6.2.2 0 00-.1.3 47.1 47.1 0 003.6 5.9.2.2 0 00.3.1A58.5 58.5 0 0070.3 45.6v-.1c1.4-15.1-2.4-28.2-10.1-39.8a.2.2 0 00-.1-.8zM23.7 37.3c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.3 3.1 6.3 7-2.8 7-6.3 7zm23.2 0c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.1 6.3 7-2.8 7-6.3 7z" fill="#5865F2"/></svg>
          </div>
          <div>
            <h1 className="page-header mb-0">Discord</h1>
            <p className="text-xs text-muted">Manage client servers, channels, and bot settings</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="btn-ghost text-xs flex items-center gap-1.5">
            <RefreshCw size={12} /> Refresh
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-xs flex items-center gap-1.5">
            <Plus size={12} /> New Server
          </button>
        </div>
      </div>

      {/* Bot Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-static flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
            <Zap size={16} className="text-success" />
          </div>
          <div>
            <p className="text-lg font-bold font-mono">{botConfigured ? "Online" : "Offline"}</p>
            <p className="text-[10px] text-muted">Bot Status</p>
          </div>
        </div>
        <div className="card-static flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#5865F2]/10 flex items-center justify-center">
            <Server size={16} className="text-[#5865F2]" />
          </div>
          <div>
            <p className="text-lg font-bold font-mono">{servers.length}</p>
            <p className="text-[10px] text-muted">Servers</p>
          </div>
        </div>
        <div className="card-static flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center">
            <Hash size={16} className="text-gold" />
          </div>
          <div>
            <p className="text-lg font-bold font-mono">{servers.reduce((s, sv) => s + sv.channel_count, 0)}</p>
            <p className="text-[10px] text-muted">Total Channels</p>
          </div>
        </div>
        <div className="card-static flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Users size={16} className="text-purple-400" />
          </div>
          <div>
            <p className="text-lg font-bold font-mono">{servers.filter(s => s.client_id).length}</p>
            <p className="text-[10px] text-muted">Client Servers</p>
          </div>
        </div>
      </div>

      {/* Health Check */}
      <div className="card-static">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-success" />
            <h2 className="text-sm font-semibold">Server Health Check</h2>
          </div>
          <button onClick={testHealth} disabled={healthLoading} className="btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-50">
            {healthLoading ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {healthLoading ? "Testing..." : "Run Test"}
          </button>
        </div>

        {!healthResult ? (
          <p className="text-xs text-muted">Click &ldquo;Run Test&rdquo; to check bot connectivity, channel permissions, and server status.</p>
        ) : (
          <div className="space-y-3">
            {/* Status indicators */}
            <div className="grid grid-cols-3 gap-2">
              <div className={`p-2.5 rounded-lg text-center ${healthResult.bot_online ? "bg-success/5 border border-success/10" : "bg-danger/5 border border-danger/10"}`}>
                <p className={`text-xs font-bold ${healthResult.bot_online ? "text-success" : "text-danger"}`}>{healthResult.bot_online ? "Online" : "Offline"}</p>
                <p className="text-[9px] text-muted">Bot Status</p>
              </div>
              <div className={`p-2.5 rounded-lg text-center ${healthResult.guild_found ? "bg-success/5 border border-success/10" : "bg-danger/5 border border-danger/10"}`}>
                <p className={`text-xs font-bold ${healthResult.guild_found ? "text-success" : "text-danger"}`}>{healthResult.guild_found ? "Connected" : "Not Found"}</p>
                <p className="text-[9px] text-muted">Server</p>
              </div>
              <div className="p-2.5 rounded-lg text-center bg-[#5865F2]/5 border border-[#5865F2]/10">
                <p className="text-xs font-bold text-[#5865F2]">{healthResult.member_count}</p>
                <p className="text-[9px] text-muted">Members</p>
              </div>
            </div>

            {/* Channel permissions */}
            {healthResult.channels.length > 0 && (
              <div>
                <p className="text-[10px] text-muted uppercase tracking-wider mb-2 font-semibold">Channel Permissions</p>
                <div className="space-y-1">
                  {healthResult.channels.map(ch => (
                    <div key={ch.id} className="flex items-center justify-between p-2 rounded-lg bg-surface-light border border-border text-xs">
                      <div className="flex items-center gap-2">
                        {ch.type === "text" ? <Hash size={11} className="text-muted" /> : <Volume2 size={11} className="text-muted" />}
                        <span className="font-mono">{ch.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {ch.bot_only ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">Bot Only</span>
                        ) : ch.writable_by_everyone ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/10 text-success">Everyone Can Chat</span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning/10 text-warning">Restricted</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {healthResult.errors.length > 0 && (
              <div className="p-3 rounded-lg bg-danger/5 border border-danger/10">
                <p className="text-[10px] font-semibold text-danger mb-1">Issues Found:</p>
                {healthResult.errors.map((e, i) => (
                  <p key={i} className="text-[10px] text-danger/80">{e}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Server List */}
      <div className="card-static">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Server size={15} className="text-[#5865F2]" /> Discord Servers
          </h2>
          <span className="text-[10px] text-muted">{servers.length} server{servers.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted">
            <Loader size={20} className="mx-auto mb-2 animate-spin" />
            <p className="text-xs">Loading servers...</p>
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-12">
            <Server size={28} className="mx-auto mb-3 text-muted/30" />
            <p className="text-sm font-medium text-muted">No Discord servers yet</p>
            <p className="text-xs text-muted mt-1">Create a server for a client or your team</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary text-xs mt-4">
              <Plus size={12} className="inline mr-1" /> Create First Server
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {servers.map(server => (
              <div key={server.id} className="flex items-center justify-between p-4 rounded-xl bg-surface-light border border-border hover:border-[#5865F2]/20 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#5865F2]/10 flex items-center justify-center text-[#5865F2] font-bold text-sm">
                    {server.guild_name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{server.guild_name}</p>
                    <div className="flex items-center gap-3 text-[10px] text-muted">
                      <span className="flex items-center gap-1"><Users size={10} /> {server.client_name}</span>
                      <span className="flex items-center gap-1"><Hash size={10} /> {server.channel_count} channels</span>
                      <span>{new Date(server.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => copyInvite(server.invite_url, server.id)}
                    className="p-2 rounded-lg hover:bg-surface border border-transparent hover:border-border transition-all" title="Copy invite">
                    {copiedId === server.id ? <Check size={14} className="text-success" /> : <Copy size={14} className="text-muted" />}
                  </button>
                  <a href={server.invite_url} target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-surface border border-transparent hover:border-border transition-all" title="Open invite">
                    <ExternalLink size={14} className="text-muted" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bot Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-static">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={15} className="text-gold" />
            <h3 className="text-sm font-semibold">Notifications</h3>
          </div>
          <p className="text-xs text-muted mb-3">Bot sends alerts for new leads, booked calls, system issues, and daily summaries to designated channels.</p>
          <div className="space-y-1.5">
            {["New lead alerts", "Call booked notifications", "System health warnings", "Daily performance brief"].map(f => (
              <div key={f} className="flex items-center gap-2 text-[10px]">
                <Check size={10} className="text-success" /> {f}
              </div>
            ))}
          </div>
        </div>

        <div className="card-static">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={15} className="text-[#5865F2]" />
            <h3 className="text-sm font-semibold">Client Channels</h3>
          </div>
          <p className="text-xs text-muted mb-3">Each client server gets pre-built channels for organized communication and deliverable sharing.</p>
          <div className="space-y-1.5">
            {["#welcome", "#announcements", "#content-approvals", "#deliverables", "#support", "#general"].map(ch => (
              <div key={ch} className="flex items-center gap-2 text-[10px] font-mono">
                <Hash size={10} className="text-muted" /> {ch.replace("#", "")}
              </div>
            ))}
          </div>
        </div>

        <div className="card-static">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={15} className="text-purple-400" />
            <h3 className="text-sm font-semibold">Permissions</h3>
          </div>
          <p className="text-xs text-muted mb-3">Role-based access control for team members and clients within each server.</p>
          <div className="space-y-1.5">
            {[
              { role: "Admin", desc: "Full server control" },
              { role: "Team", desc: "Manage channels, view all" },
              { role: "Client", desc: "View approved channels" },
            ].map(r => (
              <div key={r.role} className="flex items-center justify-between text-[10px] p-1.5 rounded bg-surface-light">
                <span className="font-medium">{r.role}</span>
                <span className="text-muted">{r.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bot Commands */}
      <div className="card-static">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Terminal size={15} className="text-gold" />
            <h2 className="text-sm font-semibold">Bot Commands</h2>
          </div>
          <button
            onClick={registerCommands}
            disabled={registering}
            className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {registering ? (
              <Loader size={12} className="animate-spin" />
            ) : commandsRegistered ? (
              <Check size={12} />
            ) : (
              <Slash size={12} />
            )}
            {registering ? "Registering..." : commandsRegistered ? "Registered" : "Register Commands"}
          </button>
        </div>
        <p className="text-xs text-muted mb-4">
          Slash commands let your team query ShortStack OS directly from Discord. Register them once, then use in any server the bot has joined.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {botCommands.map(cmd => (
            <div key={cmd.name} className="flex items-center gap-3 p-3 rounded-xl bg-surface-light border border-border hover:border-gold/20 transition-all">
              <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                <cmd.icon size={14} className={cmd.color} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold font-mono">{cmd.name}</p>
                <p className="text-[10px] text-muted truncate">{cmd.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Community Hub */}
      <div className="card-static">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={15} className="text-[#5865F2]" />
          <h2 className="text-sm font-semibold">Community Hub Setup</h2>
        </div>
        <p className="text-xs text-muted mb-4">
          Set up a community Discord server with the ShortStack bot to centralize agency operations, client communication, and real-time alerts.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-surface-light border border-border">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center mb-3">
              <span className="text-xs font-bold text-gold">1</span>
            </div>
            <h3 className="text-xs font-semibold mb-1">Create a Server</h3>
            <p className="text-[10px] text-muted">Use the &ldquo;New Server&rdquo; button above to create a Discord server. Channels for announcements, support, and deliverables are set up automatically.</p>
          </div>
          <div className="p-4 rounded-xl bg-surface-light border border-border">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center mb-3">
              <span className="text-xs font-bold text-gold">2</span>
            </div>
            <h3 className="text-xs font-semibold mb-1">Register Commands</h3>
            <p className="text-[10px] text-muted">Click &ldquo;Register Commands&rdquo; to enable slash commands. Your team can then query leads, clients, and reports directly from any channel.</p>
          </div>
          <div className="p-4 rounded-xl bg-surface-light border border-border">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center mb-3">
              <span className="text-xs font-bold text-gold">3</span>
            </div>
            <h3 className="text-xs font-semibold mb-1">Set Webhook URL</h3>
            <p className="text-[10px] text-muted">In Discord Developer Portal, set the Interactions Endpoint URL to your domain: <span className="font-mono text-gold">/api/discord/webhook</span></p>
          </div>
        </div>
        <div className="mt-4 p-3 rounded-lg bg-[#5865F2]/5 border border-[#5865F2]/10">
          <div className="flex items-start gap-2">
            <ArrowRight size={12} className="text-[#5865F2] mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted">
              <span className="font-semibold text-foreground">Env vars needed:</span>{" "}
              <span className="font-mono">DISCORD_BOT_TOKEN</span>,{" "}
              <span className="font-mono">DISCORD_APP_ID</span>, and{" "}
              <span className="font-mono">DISCORD_PUBLIC_KEY</span> from the{" "}
              <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-[#5865F2] underline hover:no-underline">
                Discord Developer Portal
              </a>.
            </p>
          </div>
        </div>
      </div>

      {/* Create Server Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Discord Server" size="sm">
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Server Name *</label>
            <input
              value={serverName}
              onChange={e => setServerName(e.target.value)}
              className="input w-full"
              placeholder="e.g. ShortStack - Client Name"
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Assign to Client</label>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="input w-full">
              <option value="">Internal / Team server</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.business_name}</option>
              ))}
            </select>
            <p className="text-[9px] text-muted mt-1">Optional. Link this server to a specific client.</p>
          </div>

          <div className="bg-surface-light rounded-lg p-3 border border-border">
            <p className="text-[10px] font-semibold mb-1">Channels that will be created:</p>
            <div className="grid grid-cols-2 gap-1 text-[9px] text-muted">
              {["#welcome", "#announcements", "#content-approvals", "#deliverables", "#support", "#general", "Voice Chat"].map(ch => (
                <span key={ch} className="flex items-center gap-1">
                  {ch.startsWith("#") ? <Hash size={8} /> : <Volume2 size={8} />}
                  {ch.replace("#", "")}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowCreate(false)} className="btn-secondary text-xs">Cancel</button>
            <button onClick={createServer} disabled={creating || !serverName.trim()} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
              {creating ? <Loader size={12} className="animate-spin" /> : <Plus size={12} />}
              {creating ? "Creating..." : "Create Server"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
