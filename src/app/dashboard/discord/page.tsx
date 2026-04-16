"use client";

import { useState } from "react";
import {
  Hash, Users, MessageSquare, Volume2, Server, Shield,
  Zap, Terminal, BarChart3, UserCheck, Globe,
  Calendar, Code, Link, Megaphone, Trash2, Plus, Check,
  Copy, TrendingUp, AlertTriangle, Edit3,
  Search, Send, Smile
} from "lucide-react";

const tabs = ["Servers", "Commands", "Auto-Roles", "Welcome", "Moderation", "Analytics", "Events", "Embeds", "Webhooks", "Announcements", "Insights"] as const;
type Tab = (typeof tabs)[number];

const mockServers: { id: string; name: string; guildId: string; members: number; channels: number; online: number; status: string; client: string; invite: string }[] = [];

const mockChannels: { id: string; name: string; type: string; synced: boolean; messages: number }[] = [];

const mockCommands: { name: string; desc: string; category: string; enabled: boolean }[] = [];

const mockAutoRoles: { id: string; trigger: string; role: string; color: string; enabled: boolean }[] = [];

const mockModRules: { id: string; name: string; desc: string; action: string; enabled: boolean }[] = [];

const mockEvents: { id: string; title: string; date: string; time: string; channel: string; attendees: number; recurring: boolean }[] = [];

const mockWebhooks: { id: string; name: string; url: string; channel: string; lastFired: string; status: string }[] = [];

const mockAnnouncements: { id: string; title: string; body: string; scheduled: string; channels: string[]; status: string }[] = [];

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
  const [activeTab, setActiveTab] = useState<Tab>("Servers");
  const [selectedServer, setSelectedServer] = useState(mockServers[0]?.id ?? "");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [commandFilter, setCommandFilter] = useState("All");
  const [commands, setCommands] = useState(mockCommands);
  const [autoRoles, setAutoRoles] = useState(mockAutoRoles);
  const [modRules, setModRules] = useState(mockModRules);
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
  const currentServer = mockServers.find(s => s.id === selectedServer);

  return (
    <div className="fade-in space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#5865F2]/10 rounded-xl flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 71 55" fill="none"><path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.7 40.7 0 00-1.8 3.7 54 54 0 00-16.2 0A39.2 39.2 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9a.2.2 0 00-.1.1C1.5 18.7-.9 32.2.3 45.5v.1a58.7 58.7 0 0017.9 9.1.2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.7.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.3 36.3 0 01-5.5 2.6.2.2 0 00-.1.3 47.1 47.1 0 003.6 5.9.2.2 0 00.3.1A58.5 58.5 0 0070.3 45.6v-.1c1.4-15.1-2.4-28.2-10.1-39.8a.2.2 0 00-.1-.8zM23.7 37.3c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.3 3.1 6.3 7-2.8 7-6.3 7zm23.2 0c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.1 6.3 7-2.8 7-6.3 7z" fill="#5865F2"/></svg>
          </div>
          <div>
            <h1 className="text-lg font-bold">Discord</h1>
            <p className="text-xs text-muted">Manage servers, bot commands, moderation, and community</p>
          </div>
        </div>
        <select value={selectedServer} onChange={e => setSelectedServer(e.target.value)} className="text-xs border border-border rounded-lg px-3 py-1.5 bg-surface">
          {mockServers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-400/10 flex items-center justify-center"><Zap size={16} className="text-green-400" /></div>
          <div><p className="text-lg font-bold font-mono">Online</p><p className="text-[10px] text-muted">Bot Status</p></div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#5865F2]/10 flex items-center justify-center"><Server size={16} className="text-[#5865F2]" /></div>
          <div><p className="text-lg font-bold font-mono">{mockServers.length}</p><p className="text-[10px] text-muted">Servers</p></div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center"><Users size={16} className="text-gold" /></div>
          <div><p className="text-lg font-bold font-mono">{mockServers.reduce((s, sv) => s + sv.members, 0)}</p><p className="text-[10px] text-muted">Total Members</p></div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center"><Hash size={16} className="text-purple-400" /></div>
          <div><p className="text-lg font-bold font-mono">{mockServers.reduce((s, sv) => s + sv.channels, 0)}</p><p className="text-[10px] text-muted">Total Channels</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${activeTab === t ? "border-gold text-gold" : "border-transparent text-muted hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Servers Tab */}
      {activeTab === "Servers" && (
        <div className="space-y-4">
          <div className="space-y-2">
            {mockServers.map(server => (
              <div key={server.id} className={`card p-4 ${selectedServer === server.id ? "border-gold/30" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#5865F2]/10 flex items-center justify-center text-[#5865F2] font-bold text-sm">{server.name.charAt(0)}</div>
                    <div>
                      <p className="text-sm font-semibold">{server.name}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted">
                        <span className="flex items-center gap-1"><Users size={10} /> {server.members} members</span>
                        <span className="flex items-center gap-1"><Hash size={10} /> {server.channels} channels</span>
                        <span className="flex items-center gap-1"><Globe size={10} /> {server.client}</span>
                        <span className={`flex items-center gap-1 ${server.status === "healthy" ? "text-green-400" : "text-yellow-400"}`}>
                          <Zap size={10} /> {server.online} online
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyText(server.invite, server.id)} className="p-2 rounded-lg hover:bg-surface-light border border-transparent hover:border-border">
                      {copiedId === server.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-muted" />}
                    </button>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full ${server.status === "healthy" ? "bg-green-400/10 text-green-400" : "bg-yellow-400/10 text-yellow-400"}`}>{server.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Channel Sync Status */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Hash size={14} className="text-gold" /> Channel Sync Status - {currentServer?.name}</h3>
            <div className="space-y-1.5">
              {mockChannels.map(ch => (
                <div key={ch.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-light border border-border text-xs">
                  <div className="flex items-center gap-2">
                    {ch.type === "text" ? <Hash size={12} className="text-muted" /> : <Volume2 size={12} className="text-muted" />}
                    <span className="font-mono">{ch.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {ch.type === "text" && <span className="text-[10px] text-muted">{ch.messages} msgs</span>}
                    <span className={`text-[9px] px-2 py-0.5 rounded-full ${ch.synced ? "bg-green-400/10 text-green-400" : "bg-yellow-400/10 text-yellow-400"}`}>
                      {ch.synced ? "Synced" : "Pending"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Commands Tab */}
      {activeTab === "Commands" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Manage slash commands. Toggle to enable/disable per server.</p>
            <div className="flex gap-1">
              {["All", "Info", "Reports", "Tools"].map(f => (
                <button key={f} onClick={() => setCommandFilter(f)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border ${commandFilter === f ? "border-gold text-gold bg-gold/5" : "border-border text-muted"}`}>{f}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
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
                    className={`w-9 h-5 rounded-full cursor-pointer transition-all flex items-center ${cmd.enabled ? "bg-green-400" : "bg-gray-600"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${cmd.enabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Custom Command Builder */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Code size={14} className="text-gold" /> Custom Command Builder</h3>
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
            <button className="mt-3 text-xs bg-gold/10 text-gold px-4 py-2 rounded-lg font-medium hover:bg-gold/20">Register Command</button>
          </div>
        </div>
      )}

      {/* Auto-Roles Tab */}
      {activeTab === "Auto-Roles" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">Automatically assign roles based on join events, reactions, or commands.</p>
          <div className="space-y-2">
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
                  className={`w-9 h-5 rounded-full cursor-pointer transition-all flex items-center ${role.enabled ? "bg-green-400" : "bg-gray-600"}`}>
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
            <button className="mt-3 text-xs bg-gold/10 text-gold px-4 py-2 rounded-lg font-medium hover:bg-gold/20">Add Rule</button>
          </div>
        </div>
      )}

      {/* Welcome Tab */}
      {activeTab === "Welcome" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Smile size={14} className="text-gold" /> Welcome Message Editor</h3>
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
                  className={`w-9 h-5 rounded-full cursor-pointer transition-all flex items-center ${welcomeDm ? "bg-green-400" : "bg-gray-600"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${welcomeDm ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                </div>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-light border border-border">
                <span className="text-xs">Channel Post</span>
                <div onClick={() => setWelcomeChannel(!welcomeChannel)}
                  className={`w-9 h-5 rounded-full cursor-pointer transition-all flex items-center ${welcomeChannel ? "bg-green-400" : "bg-gray-600"}`}>
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
          <p className="text-xs text-muted">Auto-moderation rules to keep your community safe and clean.</p>
          <div className="space-y-2">
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
                      className={`w-9 h-5 rounded-full cursor-pointer transition-all flex items-center ${rule.enabled ? "bg-green-400" : "bg-gray-600"}`}>
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
            <div className="space-y-1.5">
              {[
                { user: "spammer_432", action: "Muted 10 min", reason: "Anti-Spam triggered", time: "5 min ago" },
                { user: "newuser_88", action: "Message Deleted", reason: "Link Filter", time: "22 min ago" },
                { user: "troll_xyz", action: "Warning Issued", reason: "Profanity Filter", time: "1 hr ago" },
                { user: "bot_account", action: "Kicked", reason: "Raid Protection (manual)", time: "3 hrs ago" },
              ].map((log, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-surface-light text-xs">
                  <div className="flex items-center gap-2">
                    <Users size={10} className="text-muted" />
                    <span className="font-mono">{log.user}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-400/10 text-red-400">{log.action}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted">
                    <span>{log.reason}</span>
                    <span>{log.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === "Analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Messages Today", value: "512", icon: MessageSquare, color: "text-[#5865F2]" },
              { label: "Active Members", value: "35", icon: Users, color: "text-green-400" },
              { label: "New Members (7d)", value: "12", icon: UserCheck, color: "text-gold" },
              { label: "Voice Hours (7d)", value: "28h", icon: Volume2, color: "text-purple-400" },
            ].map((stat, i) => (
              <div key={i} className="card p-3 text-center">
                <stat.icon size={16} className={`mx-auto mb-1 ${stat.color}`} />
                <p className="text-lg font-bold font-mono">{stat.value}</p>
                <p className="text-[10px] text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
          {/* Daily Activity Chart */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 size={14} className="text-gold" /> Daily Activity</h3>
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
            <div className="space-y-2">
              {mockChannels.filter(c => c.type === "text").sort((a, b) => b.messages - a.messages).slice(0, 5).map((ch, i) => (
                <div key={ch.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted w-4">{i + 1}.</span>
                    <Hash size={10} className="text-muted" />
                    <span className="font-mono">{ch.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-surface-light rounded-full overflow-hidden">
                      <div className="h-full bg-[#5865F2] rounded-full" style={{ width: `${(ch.messages / 892) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-muted w-12 text-right">{ch.messages} msgs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Events Tab */}
      {activeTab === "Events" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Schedule and manage Discord events.</p>
            <button onClick={() => setShowNewEvent(!showNewEvent)} className="text-xs bg-gold/10 text-gold px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5">
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
                    {mockChannels.filter(c => c.type === "voice").map(c => <option key={c.id}>#{c.name}</option>)}
                    {mockChannels.filter(c => c.type === "text").map(c => <option key={c.id}>#{c.name}</option>)}
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
              <button className="mt-3 text-xs bg-gold/10 text-gold px-4 py-2 rounded-lg font-medium">Create Event</button>
            </div>
          )}
          <div className="space-y-2">
            {mockEvents.map(event => (
              <div key={event.id} className="card p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#5865F2]/10 flex items-center justify-center">
                    <Calendar size={16} className="text-[#5865F2]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{event.title}</p>
                    <div className="flex items-center gap-3 text-[10px] text-muted">
                      <span>{event.date} at {event.time}</span>
                      <span>{event.channel}</span>
                      <span>{event.attendees} attending</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {event.recurring && <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-400/10 text-purple-400">Recurring</span>}
                  <button className="text-[10px] text-muted hover:text-foreground"><Edit3 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Embeds Tab */}
      {activeTab === "Embeds" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Builder */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Code size={14} className="text-gold" /> Embed Builder</h3>
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
                <button className="text-xs bg-gold/10 text-gold px-4 py-2 rounded-lg font-medium hover:bg-gold/20 w-full">
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
          <p className="text-xs text-muted">Manage webhooks for external integrations and automated notifications.</p>
          <div className="space-y-2">
            {mockWebhooks.map(wh => (
              <div key={wh.id} className="card p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center"><Link size={14} className="text-gold" /></div>
                  <div>
                    <p className="text-xs font-semibold">{wh.name}</p>
                    <div className="flex items-center gap-3 text-[10px] text-muted">
                      <span>{wh.channel}</span>
                      <span>Last: {wh.lastFired}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${wh.status === "active" ? "bg-green-400/10 text-green-400" : "bg-gray-400/10 text-gray-400"}`}>{wh.status}</span>
                  <button onClick={() => copyText(wh.url, wh.id)} className="p-1.5 rounded hover:bg-surface-light">
                    {copiedId === wh.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-muted" />}
                  </button>
                  <button className="p-1.5 rounded hover:bg-surface-light"><Trash2 size={12} className="text-red-400" /></button>
                </div>
              </div>
            ))}
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
                  {mockChannels.filter(c => c.type === "text").map(c => <option key={c.id}>#{c.name}</option>)}
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
            <button className="mt-3 text-xs bg-gold/10 text-gold px-4 py-2 rounded-lg font-medium hover:bg-gold/20">Create Webhook</button>
          </div>
        </div>
      )}

      {/* Announcements Tab */}
      {activeTab === "Announcements" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Megaphone size={14} className="text-gold" /> Schedule Announcement</h3>
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
              <button className="text-xs bg-gold/10 text-gold px-4 py-2 rounded-lg font-medium hover:bg-gold/20">Schedule</button>
            </div>
          </div>
          <div className="space-y-2">
            {mockAnnouncements.map(a => (
              <div key={a.id} className="card p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold">{a.title}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted">
                    <span>{a.scheduled}</span>
                    <span>{a.channels.join(", ")}</span>
                  </div>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${a.status === "sent" ? "bg-green-400/10 text-green-400" : a.status === "scheduled" ? "bg-[#5865F2]/10 text-[#5865F2]" : "bg-yellow-400/10 text-yellow-400"}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === "Insights" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Search size={14} className="text-muted" />
            <input value={searchMembers} onChange={e => setSearchMembers(e.target.value)} placeholder="Search members..."
              className="text-xs border border-border rounded-lg px-3 py-1.5 bg-surface flex-1" />
          </div>
          {/* Member Insights */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users size={14} className="text-gold" /> Member Insights</h3>
            <div className="p-6 text-center text-muted text-xs">
              <Users size={24} className="mx-auto mb-2 opacity-40" />
              <p>No member data yet. Connect your Discord server to track activity and contributions.</p>
            </div>
          </div>
          {/* Engagement trends */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-green-400" /> Engagement Trends</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Avg Messages/Day", value: "0" },
                { label: "Avg Active/Day", value: "0" },
                { label: "Retention (30d)", value: "--" },
                { label: "Avg Session", value: "--" },
              ].map(stat => (
                <div key={stat.label} className="text-center p-3 rounded-lg bg-surface-light border border-border">
                  <p className="text-lg font-bold font-mono">{stat.value}</p>
                  <p className="text-[10px] text-muted">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
