"use client";

import { useState } from "react";
import {
  Users, CheckCircle,
  Clock,
  Shield, BarChart3, UserPlus, Mail,
  Activity, X, Search, Crown, Pencil,
  Settings, Lock, Unlock,
  AlertTriangle,
  UsersRound,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

type TeamTab = "members" | "permissions" | "roles" | "activity" | "capacity";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  status: "online" | "away" | "offline";
  lastActive: string;
  clients: number;
  hoursThisWeek: number;
  tasksCompleted: number;
  tasksAssigned: number;
  joinDate: string;
  recentActions: { action: string; resource: string; time: string }[];
}

type RoleId = "owner" | "admin" | "manager" | "creator" | "viewer";

interface RoleDefinition {
  id: RoleId;
  label: string;
  description: string;
  color: string;
  memberCount: number;
}

interface PermissionRow {
  feature: string;
  category: string;
  owner: boolean;
  admin: boolean;
  manager: boolean;
  creator: boolean;
  viewer: boolean;
}

const MOCK_MEMBERS: TeamMember[] = [];

const ROLE_DEFINITIONS: RoleDefinition[] = [
  { id: "owner", label: "Owner", description: "Full access to everything including billing and workspace deletion", color: "#C9A84C", memberCount: 0 },
  { id: "admin", label: "Admin", description: "Everything except billing management and workspace deletion", color: "#3b82f6", memberCount: 0 },
  { id: "manager", label: "Manager", description: "Client management, reports, content creation and approval", color: "#8b5cf6", memberCount: 0 },
  { id: "creator", label: "Creator", description: "Content creation only - no client or financial access", color: "#10b981", memberCount: 0 },
  { id: "viewer", label: "Viewer", description: "Read-only access to dashboards and reports", color: "#6b7280", memberCount: 0 },
];

const PERMISSIONS: PermissionRow[] = [
  { feature: "View Dashboard", category: "Core", owner: true, admin: true, manager: true, creator: true, viewer: true },
  { feature: "View Analytics", category: "Core", owner: true, admin: true, manager: true, creator: false, viewer: true },
  { feature: "Manage Clients", category: "Clients", owner: true, admin: true, manager: true, creator: false, viewer: false },
  { feature: "Delete Clients", category: "Clients", owner: true, admin: true, manager: false, creator: false, viewer: false },
  { feature: "Create Content", category: "Content", owner: true, admin: true, manager: true, creator: true, viewer: false },
  { feature: "Approve Content", category: "Content", owner: true, admin: true, manager: true, creator: false, viewer: false },
  { feature: "Publish Content", category: "Content", owner: true, admin: true, manager: true, creator: false, viewer: false },
  { feature: "View Reports", category: "Reports", owner: true, admin: true, manager: true, creator: false, viewer: true },
  { feature: "Export Reports", category: "Reports", owner: true, admin: true, manager: true, creator: false, viewer: false },
  { feature: "Generate Reports", category: "Reports", owner: true, admin: true, manager: true, creator: false, viewer: false },
  { feature: "Access Financials", category: "Finance", owner: true, admin: false, manager: false, creator: false, viewer: false },
  { feature: "Manage Billing", category: "Finance", owner: true, admin: false, manager: false, creator: false, viewer: false },
  { feature: "Send Invoices", category: "Finance", owner: true, admin: true, manager: false, creator: false, viewer: false },
  { feature: "Manage Team", category: "Admin", owner: true, admin: true, manager: false, creator: false, viewer: false },
  { feature: "Manage Integrations", category: "Admin", owner: true, admin: true, manager: false, creator: false, viewer: false },
  { feature: "Workspace Settings", category: "Admin", owner: true, admin: true, manager: false, creator: false, viewer: false },
  { feature: "Delete Workspace", category: "Admin", owner: true, admin: false, manager: false, creator: false, viewer: false },
  { feature: "View Audit Log", category: "Security", owner: true, admin: true, manager: false, creator: false, viewer: false },
  { feature: "API Access", category: "Security", owner: true, admin: true, manager: false, creator: false, viewer: false },
];

const STATUS_COLORS: Record<string, string> = { online: "bg-emerald-400", away: "bg-yellow-400", offline: "bg-gray-500" };

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-gold/10 text-gold border-gold/20",
  admin: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  manager: "bg-purple-400/10 text-purple-400 border-purple-400/20",
  creator: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  viewer: "bg-gray-400/10 text-gray-400 border-gray-400/20",
};

export default function TeamPage() {
  const [tab, setTab] = useState<TeamTab>("members");
  const [members] = useState<TeamMember[]>(MOCK_MEMBERS);
  const [showInvite, setShowInvite] = useState(false);
  const [showCustomRole, setShowCustomRole] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "creator" as RoleId });
  const [customRoleName, setCustomRoleName] = useState("");
  const [customPermissions, setCustomPermissions] = useState<Record<string, boolean>>({});

  const onlineCount = members.filter(m => m.status === "online").length;
  const totalTasks = members.reduce((s, m) => s + m.tasksAssigned, 0);
  const completedTasks = members.reduce((s, m) => s + m.tasksCompleted, 0);
  const avgHours = members.length > 0 ? Math.round(members.reduce((s, m) => s + m.hoursThisWeek, 0) / members.length) : 0;

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const TABS: { id: TeamTab; label: string; icon: React.ReactNode }[] = [
    { id: "members", label: "Members", icon: <Users size={13} /> },
    { id: "permissions", label: "Permissions", icon: <Shield size={13} /> },
    { id: "roles", label: "Roles", icon: <Crown size={13} /> },
    { id: "activity", label: "Access Log", icon: <Activity size={13} /> },
    { id: "capacity", label: "Capacity", icon: <BarChart3 size={13} /> },
  ];

  // Group permissions by category
  const permCategories = PERMISSIONS.reduce<Record<string, PermissionRow[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<UsersRound size={28} />}
        title="Team"
        subtitle={`${members.length} members · ${onlineCount} online`}
        gradient="gold"
        actions={
          <button onClick={() => setShowInvite(true)} className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all flex items-center gap-1.5">
            <UserPlus size={12} /> Invite Member
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Users size={12} className="text-gold" /><p className="text-[10px] text-muted uppercase tracking-wider">Team Size</p></div>
          <p className="text-lg font-bold">{members.length}</p>
          <p className="text-[10px] text-emerald-400">{onlineCount} online now</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><Shield size={12} className="text-purple-400" /><p className="text-[10px] text-muted uppercase tracking-wider">Roles</p></div>
          <p className="text-lg font-bold text-purple-400">{ROLE_DEFINITIONS.length}</p>
          <p className="text-[10px] text-muted">defined roles</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><CheckCircle size={12} className="text-emerald-400" /><p className="text-[10px] text-muted uppercase tracking-wider">Tasks Done</p></div>
          <p className="text-lg font-bold text-emerald-400">{completedTasks}/{totalTasks}</p>
          <p className="text-[10px] text-muted">this week</p>
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

      {/* ═══ MEMBERS TAB ═══ */}
      {tab === "members" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="input w-full text-xs pl-8" placeholder="Search members..." />
            </div>
            <div className="flex gap-1 bg-surface rounded-lg p-0.5">
              <button onClick={() => setRoleFilter("all")} className={`px-2 py-1 rounded-md text-[9px] font-medium ${roleFilter === "all" ? "bg-gold/20 text-gold" : "text-muted"}`}>All</button>
              {ROLE_DEFINITIONS.map(r => (
                <button key={r.id} onClick={() => setRoleFilter(r.id)} className={`px-2 py-1 rounded-md text-[9px] font-medium ${roleFilter === r.id ? "bg-gold/20 text-gold" : "text-muted"}`}>{r.label}</button>
              ))}
            </div>
          </div>

          {/* Members Table */}
          <div className="card overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 text-muted font-semibold text-[10px]">Member</th>
                  <th className="text-left py-2.5 px-3 text-muted font-semibold text-[10px]">Role</th>
                  <th className="text-left py-2.5 px-3 text-muted font-semibold text-[10px] hidden md:table-cell">Status</th>
                  <th className="text-left py-2.5 px-3 text-muted font-semibold text-[10px] hidden lg:table-cell">Last Active</th>
                  <th className="text-left py-2.5 px-3 text-muted font-semibold text-[10px] hidden lg:table-cell">Clients</th>
                  <th className="text-right py-2.5 px-3 text-muted font-semibold text-[10px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-muted">No members match your search.</td></tr>
                )}
                {filteredMembers.map(member => (
                  <tr key={member.id} className="border-b border-border/50 hover:bg-surface-light/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedMember(selectedMember === member.id ? null : member.id)}>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-[10px] font-bold text-gold">{member.avatar}</div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--color-surface)] ${STATUS_COLORS[member.status]}`} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold">{member.name}</p>
                          <p className="text-[9px] text-muted">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium border ${ROLE_COLORS[member.role] || "bg-surface-light text-muted border-border"}`}>
                        {member.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 hidden md:table-cell">
                      <span className={`text-[9px] capitalize ${member.status === "online" ? "text-emerald-400" : member.status === "away" ? "text-yellow-400" : "text-gray-400"}`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[10px] text-muted hidden lg:table-cell">{member.lastActive}</td>
                    <td className="py-2.5 px-3 text-[10px] font-medium hidden lg:table-cell">{member.clients}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 rounded-md hover:bg-surface-light text-muted hover:text-foreground transition-colors" onClick={e => e.stopPropagation()}><Pencil size={11} /></button>
                        <button className="p-1.5 rounded-md hover:bg-surface-light text-muted hover:text-foreground transition-colors" onClick={e => e.stopPropagation()}><Mail size={11} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expanded Member Detail */}
          {selectedMember && (() => {
            const m = members.find(mem => mem.id === selectedMember);
            if (!m) return null;
            return (
              <div className="card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center text-lg font-bold text-gold">{m.avatar}</div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-surface)] ${STATUS_COLORS[m.status]}`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{m.name}</p>
                      <p className="text-[10px] text-muted">{m.email}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedMember(null)} className="text-muted hover:text-foreground"><X size={16} /></button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-lg bg-surface-light text-center border border-border">
                    <p className="text-lg font-bold">{m.clients}</p><p className="text-[8px] text-muted">Clients</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-light text-center border border-border">
                    <p className="text-lg font-bold text-blue-400">{m.hoursThisWeek}h</p><p className="text-[8px] text-muted">This Week</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-light text-center border border-border">
                    <p className="text-lg font-bold text-emerald-400">{m.tasksCompleted}</p><p className="text-[8px] text-muted">Tasks Done</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-light text-center border border-border">
                    <p className="text-lg font-bold text-gold">{m.tasksAssigned > 0 ? Math.round((m.tasksCompleted / m.tasksAssigned) * 100) : 0}%</p><p className="text-[8px] text-muted">Completion</p>
                  </div>
                </div>

                {/* Recent Actions */}
                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-2">Recent Actions</p>
                  <div className="space-y-1.5">
                    {m.recentActions.map((act, i) => (
                      <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-surface-light border border-border">
                        <Activity size={10} className="text-gold shrink-0" />
                        <span className="text-[10px] flex-1"><span className="font-medium">{act.action}</span> <span className="text-muted">on</span> {act.resource}</span>
                        <span className="text-[9px] text-muted shrink-0">{act.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══ PERMISSIONS TAB ═══ */}
      {tab === "permissions" && (
        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold flex items-center gap-2"><Shield size={14} className="text-gold" /> Role Permissions Matrix</h2>
            <button onClick={() => setShowCustomRole(true)} className="btn-secondary text-[10px] flex items-center gap-1.5"><Settings size={10} /> Custom Role Builder</button>
          </div>
          {Object.entries(permCategories).map(([category, perms]) => (
            <div key={category} className="mb-4">
              <p className="text-[9px] text-muted uppercase tracking-wider font-bold mb-2 px-2">{category}</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-muted font-semibold text-[10px] w-48 pl-2">Feature</th>
                    {ROLE_DEFINITIONS.map(role => (
                      <th key={role.id} className="text-center py-2 px-2 text-[10px] font-semibold" style={{ color: role.color }}>{role.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perms.map((perm, idx) => (
                    <tr key={idx} className="border-b border-border/30">
                      <td className="py-2 pr-4 font-medium pl-2">{perm.feature}</td>
                      {(["owner", "admin", "manager", "creator", "viewer"] as RoleId[]).map(roleId => (
                        <td key={roleId} className="text-center py-2">
                          {perm[roleId] ? (
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
          ))}
        </div>
      )}

      {/* ═══ ROLES TAB ═══ */}
      {tab === "roles" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ROLE_DEFINITIONS.map(role => (
              <div key={role.id} className="card p-4 hover:border-gold/10 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${role.color}15` }}>
                    <Shield size={16} style={{ color: role.color }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold">{role.label}</p>
                    <p className="text-[9px] text-muted">{role.memberCount} member{role.memberCount !== 1 ? "s" : ""}</p>
                  </div>
                  <button className="p-1.5 rounded-lg hover:bg-surface-light text-muted hover:text-foreground transition-colors"><Pencil size={11} /></button>
                </div>
                <p className="text-[10px] text-muted mb-3">{role.description}</p>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-surface-light overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(PERMISSIONS.filter(p => p[role.id]).length / PERMISSIONS.length) * 100}%`, background: role.color }} />
                  </div>
                  <span className="text-[9px] text-muted">{PERMISSIONS.filter(p => p[role.id]).length}/{PERMISSIONS.length} permissions</span>
                </div>
              </div>
            ))}

            {/* Add Custom Role Card */}
            <button onClick={() => setShowCustomRole(true)}
              className="card p-4 border-dashed hover:border-gold/20 transition-all flex flex-col items-center justify-center gap-2 min-h-[160px]">
              <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                <Settings size={16} className="text-gold" />
              </div>
              <p className="text-xs font-bold text-muted">Create Custom Role</p>
              <p className="text-[9px] text-muted text-center">Define a role with specific permissions for your team</p>
            </button>
          </div>
        </div>
      )}

      {/* ═══ ACCESS LOG TAB ═══ */}
      {tab === "activity" && (
        <div className="card">
          <h2 className="section-header flex items-center gap-2"><Activity size={13} className="text-gold" /> Per-Member Access Log</h2>
          <div className="space-y-2">
            {members.flatMap(m =>
              m.recentActions.map(a => ({
                ...a,
                member: m.name,
                avatar: m.avatar,
                role: m.role,
              }))
            ).map((act, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-light border-b border-border/30 transition-colors">
                <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center text-[9px] font-bold text-gold shrink-0">{act.avatar}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px]">
                    <span className="font-semibold">{act.member}</span>
                    <span className={`ml-1.5 text-[8px] px-1.5 py-0.5 rounded-full border ${ROLE_COLORS[act.role] || "bg-surface-light text-muted border-border"}`}>{act.role}</span>
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">{act.action} on <span className="text-foreground">{act.resource}</span></p>
                </div>
                <span className="text-[9px] text-muted shrink-0">{act.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ CAPACITY TAB ═══ */}
      {tab === "capacity" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><BarChart3 size={13} className="text-gold" /> Team Capacity Tracker</h2>
            <p className="text-[10px] text-muted mb-4">See who has bandwidth and who is overloaded.</p>
            <div className="space-y-3">
              {members.map(m => {
                const taskLoad = m.tasksAssigned > 0 ? (m.tasksAssigned / 30) * 100 : 0;
                const hourLoad = (m.hoursThisWeek / 45) * 100;
                const combinedLoad = Math.min(Math.round((taskLoad + hourLoad) / 2), 100);
                const loadLevel = combinedLoad > 80 ? "Overloaded" : combinedLoad > 50 ? "Balanced" : "Available";
                const loadColor = combinedLoad > 80 ? "text-red-400" : combinedLoad > 50 ? "text-gold" : "text-emerald-400";
                const barColor = combinedLoad > 80 ? "#ef4444" : combinedLoad > 50 ? "#C9A84C" : "#10b981";
                return (
                  <div key={m.id} className="p-3 rounded-lg bg-surface-light border border-border">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-[10px] font-bold text-gold">{m.avatar}</div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--color-surface-light)] ${STATUS_COLORS[m.status]}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold">{m.name}</p>
                          <div className="flex items-center gap-2">
                            {combinedLoad > 80 && <AlertTriangle size={10} className="text-red-400" />}
                            <span className={`text-[9px] font-medium ${loadColor}`}>{loadLevel}</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted">{m.role} &middot; {m.tasksAssigned} tasks &middot; {m.hoursThisWeek}h/week &middot; {m.clients} clients</p>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-surface overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${combinedLoad}%`, background: barColor }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-muted">{combinedLoad}% capacity used</span>
                      <span className="text-[9px] text-muted">{m.tasksCompleted}/{m.tasksAssigned} tasks done</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ INVITE MODAL ═══ */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><UserPlus size={14} className="text-gold" /> Invite Team Member</h3>
              <button onClick={() => setShowInvite(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Email Address</label>
              <input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                className="input w-full text-xs" placeholder="colleague@company.com" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Full Name</label>
              <input value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                className="input w-full text-xs" placeholder="John Smith" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Role</label>
              <div className="space-y-1.5">
                {ROLE_DEFINITIONS.filter(r => r.id !== "owner").map(role => (
                  <button key={role.id} onClick={() => setInviteForm({ ...inviteForm, role: role.id })}
                    className={`w-full p-2.5 rounded-lg border text-left transition-all ${
                      inviteForm.role === role.id
                        ? "border-gold/30 bg-gold/[0.03]"
                        : "border-border hover:border-gold/10"
                    }`}>
                    <div className="flex items-center gap-2">
                      <Shield size={12} style={{ color: role.color }} />
                      <span className="text-xs font-semibold">{role.label}</span>
                      {inviteForm.role === role.id && <CheckCircle size={10} className="text-gold ml-auto" />}
                    </div>
                    <p className="text-[9px] text-muted mt-0.5 ml-5">{role.description}</p>
                  </button>
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

      {/* ═══ CUSTOM ROLE BUILDER MODAL ═══ */}
      {showCustomRole && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCustomRole(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-lg p-5 space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Settings size={14} className="text-gold" /> Custom Role Builder</h3>
              <button onClick={() => setShowCustomRole(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Role Name</label>
              <input value={customRoleName} onChange={e => setCustomRoleName(e.target.value)}
                className="input w-full text-xs" placeholder="e.g. Content Reviewer" />
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-2">Toggle Permissions</p>
              {Object.entries(permCategories).map(([category, perms]) => (
                <div key={category} className="mb-3">
                  <p className="text-[9px] text-muted uppercase tracking-wider font-bold mb-1.5">{category}</p>
                  <div className="space-y-1">
                    {perms.map(perm => (
                      <div key={perm.feature} className="flex items-center gap-3 p-2 rounded-lg bg-surface-light border border-border">
                        <button onClick={() => setCustomPermissions(prev => ({ ...prev, [perm.feature]: !prev[perm.feature] }))}
                          className={`w-8 h-4 rounded-full transition-colors ${customPermissions[perm.feature] ? "bg-emerald-400" : "bg-surface"}`}>
                          <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-all mt-[1px] ${customPermissions[perm.feature] ? "ml-4" : "ml-0.5"}`} />
                        </button>
                        <span className="text-[10px] flex-1">{perm.feature}</span>
                        {customPermissions[perm.feature] ? <Unlock size={10} className="text-emerald-400" /> : <Lock size={10} className="text-muted/30" />}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowCustomRole(false)} className="btn-secondary text-xs">Cancel</button>
              <button className="btn-primary text-xs flex items-center gap-1.5" onClick={() => setShowCustomRole(false)}>
                <CheckCircle size={12} /> Create Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
