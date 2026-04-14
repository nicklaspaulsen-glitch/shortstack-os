"use client";

import { useState } from "react";
import {
  Users, Trophy, DollarSign, Briefcase,
  Clock, MessageSquare, CheckCircle,
  Shield, BarChart3, UserPlus, Mail, MapPin, Globe,
  Activity, X, Search
} from "lucide-react";

type TeamTab = "members" | "performance" | "workload" | "activity" | "permissions";

interface TeamMemberData {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  status: "online" | "away" | "offline";
  skills: string[];
  clients: string[];
  hoursThisWeek: number;
  dealsWon: number;
  revenue: number;
  joinDate: string;
  country: string;
  availability: Record<string, boolean>;
  onboardingComplete: boolean;
  onboardingChecklist: { task: string; done: boolean }[];
  recentActivity: { action: string; time: string }[];
}

const MOCK_MEMBERS: TeamMemberData[] = [
  {
    id: "1", name: "Nicklas", email: "nicklas@shortstackcreative.com", role: "Founder / CEO", avatar: "N",
    status: "online", skills: ["Strategy", "Sales", "AI Systems", "Automation"],
    clients: ["Bright Dental", "Metro Realty", "FitPro Gym"], hoursThisWeek: 42, dealsWon: 8, revenue: 24500,
    joinDate: "2024-01-01", country: "Sweden",
    availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false },
    onboardingComplete: true,
    onboardingChecklist: [{ task: "Set up profile", done: true }, { task: "Connect integrations", done: true }],
    recentActivity: [{ action: "Closed deal with Metro Realty", time: "2h ago" }, { action: "Updated ad campaign", time: "4h ago" }],
  },
  {
    id: "2", name: "Sarah Chen", email: "sarah@shortstackcreative.com", role: "Content Manager", avatar: "S",
    status: "online", skills: ["Content Strategy", "Copywriting", "Social Media", "SEO"],
    clients: ["Luxe Salon", "Green Eats"], hoursThisWeek: 38, dealsWon: 3, revenue: 8500,
    joinDate: "2024-06-15", country: "USA",
    availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false },
    onboardingComplete: true,
    onboardingChecklist: [{ task: "Set up profile", done: true }, { task: "Connect integrations", done: true }],
    recentActivity: [{ action: "Published 5 posts for Luxe Salon", time: "1h ago" }, { action: "Wrote blog for Green Eats", time: "3h ago" }],
  },
  {
    id: "3", name: "James Wilson", email: "james@shortstackcreative.com", role: "Video Editor", avatar: "J",
    status: "away", skills: ["Video Editing", "Motion Graphics", "Thumbnail Design", "Premiere Pro"],
    clients: ["FitPro Gym", "Green Eats", "Bright Dental"], hoursThisWeek: 35, dealsWon: 0, revenue: 0,
    joinDate: "2024-09-01", country: "Philippines",
    availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: true, Sun: false },
    onboardingComplete: true,
    onboardingChecklist: [{ task: "Set up profile", done: true }, { task: "Connect integrations", done: true }],
    recentActivity: [{ action: "Delivered 3 reels for FitPro", time: "30m ago" }, { action: "Started video for Bright Dental", time: "2h ago" }],
  },
  {
    id: "4", name: "Maria Rodriguez", email: "maria@shortstackcreative.com", role: "Ads Manager", avatar: "M",
    status: "online", skills: ["Meta Ads", "Google Ads", "Analytics", "Landing Pages"],
    clients: ["Metro Realty", "Bright Dental", "Luxe Salon"], hoursThisWeek: 40, dealsWon: 2, revenue: 6200,
    joinDate: "2025-01-10", country: "Colombia",
    availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false },
    onboardingComplete: true,
    onboardingChecklist: [{ task: "Set up profile", done: true }, { task: "Connect integrations", done: true }],
    recentActivity: [{ action: "Optimized Metro Realty campaign", time: "1h ago" }, { action: "Created ad set for Luxe Salon", time: "5h ago" }],
  },
  {
    id: "5", name: "Alex Park", email: "alex@shortstackcreative.com", role: "Cold Caller", avatar: "A",
    status: "offline", skills: ["Cold Calling", "Lead Gen", "CRM", "Sales Scripts"],
    clients: [], hoursThisWeek: 28, dealsWon: 5, revenue: 12000,
    joinDate: "2025-11-01", country: "South Korea",
    availability: { Mon: true, Tue: true, Wed: true, Thu: false, Fri: true, Sat: false, Sun: false },
    onboardingComplete: false,
    onboardingChecklist: [
      { task: "Set up profile", done: true }, { task: "Connect integrations", done: true },
      { task: "Complete CRM training", done: true }, { task: "First mock call", done: true },
      { task: "Shadow senior caller", done: false }, { task: "Complete compliance training", done: false },
    ],
    recentActivity: [{ action: "Made 45 calls today", time: "1h ago" }, { action: "Booked 3 discovery calls", time: "3h ago" }],
  },
];

const ROLES = ["Founder / CEO", "Content Manager", "Video Editor", "Ads Manager", "Cold Caller", "Account Manager", "Developer", "Designer"];

const PERMISSIONS: { feature: string; roles: Record<string, boolean> }[] = [
  { feature: "View Dashboard", roles: { "Founder / CEO": true, "Content Manager": true, "Video Editor": true, "Ads Manager": true, "Cold Caller": true } },
  { feature: "Manage Clients", roles: { "Founder / CEO": true, "Content Manager": true, "Video Editor": false, "Ads Manager": true, "Cold Caller": false } },
  { feature: "Access Financials", roles: { "Founder / CEO": true, "Content Manager": false, "Video Editor": false, "Ads Manager": false, "Cold Caller": false } },
  { feature: "Edit Content", roles: { "Founder / CEO": true, "Content Manager": true, "Video Editor": true, "Ads Manager": false, "Cold Caller": false } },
  { feature: "Manage Ads", roles: { "Founder / CEO": true, "Content Manager": false, "Video Editor": false, "Ads Manager": true, "Cold Caller": false } },
  { feature: "View Reports", roles: { "Founder / CEO": true, "Content Manager": true, "Video Editor": false, "Ads Manager": true, "Cold Caller": true } },
  { feature: "Send Invoices", roles: { "Founder / CEO": true, "Content Manager": false, "Video Editor": false, "Ads Manager": false, "Cold Caller": false } },
  { feature: "Manage Team", roles: { "Founder / CEO": true, "Content Manager": false, "Video Editor": false, "Ads Manager": false, "Cold Caller": false } },
];

const STATUS_COLORS = { online: "bg-emerald-400", away: "bg-yellow-400", offline: "bg-gray-500" };

export default function TeamPage() {
  const [tab, setTab] = useState<TeamTab>("members");
  const [members] = useState<TeamMemberData[]>(MOCK_MEMBERS);
  const [showInvite, setShowInvite] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: ROLES[0] });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [expandedChat, setExpandedChat] = useState<string | null>(null);

  const totalRevenue = members.reduce((s, m) => s + m.revenue, 0);
  const totalDeals = members.reduce((s, m) => s + m.dealsWon, 0);
  const avgHours = Math.round(members.reduce((s, m) => s + m.hoursThisWeek, 0) / members.length);
  const onlineCount = members.filter(m => m.status === "online").length;

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const TABS: { id: TeamTab; label: string; icon: React.ReactNode }[] = [
    { id: "members", label: "Members", icon: <Users size={13} /> },
    { id: "performance", label: "Performance", icon: <Trophy size={13} /> },
    { id: "workload", label: "Workload", icon: <BarChart3 size={13} /> },
    { id: "activity", label: "Activity", icon: <Activity size={13} /> },
    { id: "permissions", label: "Permissions", icon: <Shield size={13} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2"><Users size={18} className="text-gold" /> Team</h1>
          <p className="text-xs text-muted mt-0.5">{members.length} members - {onlineCount} online</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <UserPlus size={12} /> Invite Member
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Users size={12} className="text-gold" /><p className="text-[10px] text-muted uppercase tracking-wider">Active Members</p></div>
          <p className="text-lg font-bold">{members.length}</p>
          <p className="text-[10px] text-emerald-400">{onlineCount} online now</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Trophy size={12} className="text-gold" /><p className="text-[10px] text-muted uppercase tracking-wider">Total Deals</p></div>
          <p className="text-lg font-bold text-gold">{totalDeals}</p>
          <p className="text-[10px] text-muted">this quarter</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><DollarSign size={12} className="text-emerald-400" /><p className="text-[10px] text-muted uppercase tracking-wider">Revenue</p></div>
          <p className="text-lg font-bold text-emerald-400">${totalRevenue.toLocaleString()}</p>
          <p className="text-[10px] text-muted">team-generated</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Clock size={12} className="text-blue-400" /><p className="text-[10px] text-muted uppercase tracking-wider">Avg Hours/Week</p></div>
          <p className="text-lg font-bold text-blue-400">{avgHours}h</p>
          <p className="text-[10px] text-muted">across team</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
              tab === t.id ? "bg-gold/10 text-gold font-medium" : "text-muted hover:text-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {tab === "members" && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="input w-full text-xs pl-8" placeholder="Search team members..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredMembers.map(member => (
              <div key={member.id} className="card p-4 hover:border-gold/10 transition-all cursor-pointer" onClick={() => setSelectedMember(selectedMember === member.id ? null : member.id)}>
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center text-lg font-bold text-gold">{member.avatar}</div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0a0a0a] ${STATUS_COLORS[member.status]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{member.name}</p>
                    <p className="text-[10px] text-gold">{member.role}</p>
                    <p className="text-[10px] text-muted flex items-center gap-1"><Mail size={8} /> {member.email}</p>
                    <p className="text-[10px] text-muted flex items-center gap-1"><MapPin size={8} /> {member.country}</p>
                  </div>
                </div>
                {/* Skills */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {member.skills.map(skill => (
                    <span key={skill} className="text-[8px] px-1.5 py-0.5 rounded-full bg-gold/5 text-gold border border-gold/10">{skill}</span>
                  ))}
                </div>
                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="p-1.5 rounded-lg bg-surface-light">
                    <p className="text-xs font-bold">{member.clients.length}</p>
                    <p className="text-[8px] text-muted">Clients</p>
                  </div>
                  <div className="p-1.5 rounded-lg bg-surface-light">
                    <p className="text-xs font-bold">{member.hoursThisWeek}h</p>
                    <p className="text-[8px] text-muted">This Week</p>
                  </div>
                  <div className="p-1.5 rounded-lg bg-surface-light">
                    <p className="text-xs font-bold text-emerald-400">{member.dealsWon}</p>
                    <p className="text-[8px] text-muted">Deals</p>
                  </div>
                </div>
                {/* Expanded Details */}
                {selectedMember === member.id && (
                  <div className="mt-3 pt-3 border-t border-border space-y-3">
                    {/* Availability Calendar */}
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1.5">Availability</p>
                      <div className="flex gap-1">
                        {Object.entries(member.availability).map(([day, available]) => (
                          <div key={day} className={`flex-1 text-center py-1 rounded text-[9px] ${available ? "bg-emerald-400/10 text-emerald-400" : "bg-surface-light text-muted/30"}`}>
                            {day}
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Client Assignments */}
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1.5">Client Assignments</p>
                      {member.clients.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {member.clients.map(c => (
                            <span key={c} className="text-[9px] px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">{c}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[9px] text-muted">No clients assigned</p>
                      )}
                    </div>
                    {/* Onboarding Checklist */}
                    {!member.onboardingComplete && (
                      <div>
                        <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1.5">Onboarding Progress</p>
                        <div className="space-y-1">
                          {member.onboardingChecklist.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-[10px]">
                              <CheckCircle size={10} className={item.done ? "text-emerald-400" : "text-muted/30"} />
                              <span className={item.done ? "text-muted line-through" : ""}>{item.task}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-1.5">
                          <div className="h-1.5 rounded-full bg-surface-light overflow-hidden">
                            <div className="h-full bg-gold rounded-full" style={{ width: `${(member.onboardingChecklist.filter(i => i.done).length / member.onboardingChecklist.length) * 100}%` }} />
                          </div>
                          <p className="text-[9px] text-muted mt-0.5">{member.onboardingChecklist.filter(i => i.done).length}/{member.onboardingChecklist.length} complete</p>
                        </div>
                      </div>
                    )}
                    {/* Recent Activity */}
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1.5">Recent Activity</p>
                      {member.recentActivity.map((act, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[10px] py-1">
                          <Activity size={9} className="text-gold shrink-0" />
                          <span className="flex-1">{act.action}</span>
                          <span className="text-muted">{act.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Team Chat Preview */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><MessageSquare size={13} className="text-gold" /> Team Chat</h2>
            <div className="space-y-2">
              {[
                { from: "Nicklas", msg: "New client incoming - Metro Realty. Maria, can you handle ads?", time: "10:30 AM" },
                { from: "Maria", msg: "On it! I'll set up the campaign structure today.", time: "10:32 AM" },
                { from: "Sarah", msg: "Content calendar for next week is ready for review.", time: "10:45 AM" },
                { from: "James", msg: "Just delivered the 3 reels for FitPro. Check Slack for previews.", time: "11:00 AM" },
                { from: "Alex", msg: "Booked 3 discovery calls today. One is a dentist in Houston.", time: "11:15 AM" },
              ].map((chat, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/[0.02]">
                  <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-[9px] font-bold text-gold shrink-0">{chat.from[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold">{chat.from}</span>
                      <span className="text-[9px] text-muted">{chat.time}</span>
                    </div>
                    <p className="text-[11px] text-muted">{chat.msg}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Performance Tab */}
      {tab === "performance" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Trophy size={13} className="text-gold" /> Performance Rankings</h2>
            <div className="space-y-2">
              {[...members].sort((a, b) => b.revenue - a.revenue).map((member, idx) => (
                <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-light border border-border">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${idx === 0 ? "bg-gold/20 text-gold" : idx === 1 ? "bg-gray-300/20 text-gray-300" : idx === 2 ? "bg-amber-700/20 text-amber-600" : "bg-surface text-muted"}`}>
                    #{idx + 1}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-sm font-bold text-gold">{member.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{member.name}</p>
                    <p className="text-[10px] text-muted">{member.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">${member.revenue.toLocaleString()}</p>
                    <p className="text-[9px] text-muted">{member.dealsWon} deals</p>
                  </div>
                  <div className="w-24">
                    <div className="h-2 rounded-full bg-surface overflow-hidden">
                      <div className="h-full bg-gold rounded-full" style={{ width: `${(member.revenue / Math.max(members[0]?.revenue || 1, 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Time Tracking Summary */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Clock size={13} className="text-blue-400" /> Time Tracking Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {members.map(m => (
                <div key={m.id} className="p-3 rounded-lg bg-surface-light text-center border border-border">
                  <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-xs font-bold text-gold mx-auto mb-1">{m.avatar}</div>
                  <p className="text-[10px] font-semibold truncate">{m.name}</p>
                  <p className="text-lg font-bold text-blue-400">{m.hoursThisWeek}h</p>
                  <p className="text-[9px] text-muted">this week</p>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden mt-1">
                    <div className="h-full rounded-full" style={{ width: `${(m.hoursThisWeek / 45) * 100}%`, background: m.hoursThisWeek > 40 ? "#ef4444" : m.hoursThisWeek > 30 ? "#c8a855" : "#3b82f6" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Workload Tab */}
      {tab === "workload" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><BarChart3 size={13} className="text-gold" /> Workload Distribution</h2>
            <div className="space-y-3">
              {members.map(m => {
                const load = m.clients.length * 20 + m.hoursThisWeek;
                const maxLoad = 100;
                const pct = Math.min((load / maxLoad) * 100, 100);
                const loadLevel = pct > 80 ? "Overloaded" : pct > 50 ? "Balanced" : "Available";
                const loadColor = pct > 80 ? "text-red-400" : pct > 50 ? "text-gold" : "text-emerald-400";
                const barColor = pct > 80 ? "#ef4444" : pct > 50 ? "#c8a855" : "#10b981";
                return (
                  <div key={m.id} className="p-3 rounded-lg bg-surface-light border border-border">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-xs font-bold text-gold">{m.avatar}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold">{m.name}</p>
                          <span className={`text-[9px] font-medium ${loadColor}`}>{loadLevel}</span>
                        </div>
                        <p className="text-[10px] text-muted">{m.role} - {m.clients.length} clients - {m.hoursThisWeek}h/week</p>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-surface overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Client Assignments Overview */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Briefcase size={13} className="text-blue-400" /> Client Assignments</h2>
            <div className="space-y-2">
              {["Bright Dental", "Luxe Salon", "FitPro Gym", "Metro Realty", "Green Eats"].map(client => {
                const assigned = members.filter(m => m.clients.includes(client));
                return (
                  <div key={client} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                    <Globe size={14} className="text-gold shrink-0" />
                    <span className="text-xs font-semibold flex-1">{client}</span>
                    <div className="flex -space-x-2">
                      {assigned.map(m => (
                        <div key={m.id} className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-[9px] font-bold text-gold border-2 border-[#0a0a0a]" title={m.name}>{m.avatar}</div>
                      ))}
                    </div>
                    <span className="text-[10px] text-muted">{assigned.length} member{assigned.length !== 1 ? "s" : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {tab === "activity" && (
        <div className="card">
          <h2 className="section-header flex items-center gap-2"><Activity size={13} className="text-gold" /> Team Activity Feed</h2>
          <div className="space-y-2">
            {members.flatMap(m => m.recentActivity.map(a => ({ ...a, member: m.name, avatar: m.avatar })))
              .sort(() => Math.random() - 0.5)
              .map((act, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.02] border-b border-border">
                  <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center text-[10px] font-bold text-gold shrink-0">{act.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px]"><span className="font-semibold">{act.member}</span> {act.action}</p>
                  </div>
                  <span className="text-[9px] text-muted shrink-0">{act.time}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Permissions Tab */}
      {tab === "permissions" && (
        <div className="card overflow-x-auto">
          <h2 className="section-header flex items-center gap-2"><Shield size={13} className="text-gold" /> Role Permissions Matrix</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-muted font-semibold">Feature</th>
                {["Founder / CEO", "Content Manager", "Video Editor", "Ads Manager", "Cold Caller"].map(role => (
                  <th key={role} className="text-center py-2 px-2 text-muted font-semibold text-[10px]">{role.split(" / ")[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((perm, idx) => (
                <tr key={idx} className="border-b border-border/50">
                  <td className="py-2.5 pr-4 font-medium">{perm.feature}</td>
                  {Object.values(perm.roles).map((allowed, rIdx) => (
                    <td key={rIdx} className="text-center py-2.5">
                      {allowed ? (
                        <CheckCircle size={14} className="text-emerald-400 mx-auto" />
                      ) : (
                        <X size={14} className="text-red-400/30 mx-auto" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><UserPlus size={14} className="text-gold" /> Invite Team Member</h3>
              <button onClick={() => setShowInvite(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Full Name</label>
              <input value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })} className="input w-full text-xs" placeholder="John Smith" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Email</label>
              <input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} className="input w-full text-xs" placeholder="john@example.com" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Role</label>
              <select value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })} className="input w-full text-xs">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {/* Onboarding Checklist Preview */}
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1.5">Auto-assigned onboarding tasks</p>
              <div className="space-y-1">
                {["Set up profile", "Connect integrations", "Complete role training", "First task assignment", "Team introduction call", "Review SOPs"].map((task, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[10px] text-muted">
                    <CheckCircle size={9} className="text-muted/30" />
                    {task}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowInvite(false)} className="btn-secondary text-xs">Cancel</button>
              <button className="btn-primary text-xs flex items-center gap-1.5" onClick={() => setShowInvite(false)}>
                <Mail size={12} /> Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
