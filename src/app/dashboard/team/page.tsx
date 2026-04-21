"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  Users, CheckCircle,
  Clock,
  Shield, BarChart3, UserPlus, Mail,
  Activity, X, Search, Crown, Pencil,
  Settings, Lock, Unlock, Trash2, Key, Eye, EyeOff,
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "creator" as RoleId });
  const [customRoleName, setCustomRoleName] = useState("");
  const [customPermissions, setCustomPermissions] = useState<Record<string, boolean>>({});

  // Real team members from DB
  interface RealMember {
    id: string; email: string; full_name: string; role: string; status: string;
    can_manage_clients: boolean; can_manage_outreach: boolean; can_manage_content: boolean;
    can_manage_ads: boolean; can_manage_team: boolean; can_view_financials: boolean;
    client_access_mode: string; allowed_client_ids: string[];
    last_active_at?: string; created_at: string; avatar_url?: string; job_title?: string;
  }
  const [realMembers, setRealMembers] = useState<RealMember[]>([]);
  const [createForm, setCreateForm] = useState({
    email: "", full_name: "", password: "", job_title: "", role: "member",
    can_manage_clients: true, can_manage_outreach: true, can_manage_content: true,
    can_manage_ads: false, can_manage_team: false, can_view_financials: false,
    client_access_mode: "all" as "all" | "specific" | "none",
  });
  const [creating, setCreating] = useState(false);
  const [editingMember, setEditingMember] = useState<RealMember | null>(null);

  async function loadRealMembers() {
    try {
      const res = await fetch("/api/team");
      if (res.ok) {
        const d = await res.json();
        setRealMembers(d.members || []);
      } else {
        toast.error("Couldn't load team members");
      }
    } catch (err) {
      console.error("[team] loadRealMembers failed:", err);
      toast.error("Couldn't load team members");
    }
  }

  useEffect(() => { loadRealMembers(); }, []);

  async function createMember() {
    if (!createForm.email || !createForm.password) {
      toast.error("Email and password required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          permissions: {
            can_manage_clients: createForm.can_manage_clients,
            can_manage_outreach: createForm.can_manage_outreach,
            can_manage_content: createForm.can_manage_content,
            can_manage_ads: createForm.can_manage_ads,
            can_manage_team: createForm.can_manage_team,
            can_view_financials: createForm.can_view_financials,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Team member created: ${createForm.email}`);
        setCreateForm({
          email: "", full_name: "", password: "", job_title: "", role: "member",
          can_manage_clients: true, can_manage_outreach: true, can_manage_content: true,
          can_manage_ads: false, can_manage_team: false, can_view_financials: false,
          client_access_mode: "all",
        });
        setShowInvite(false);
        loadRealMembers();
      } else {
        toast.error(data.error || "Failed to create member");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setCreating(false);
    }
  }

  async function updateMember(id: string, updates: Record<string, unknown>) {
    const res = await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("Member updated");
      loadRealMembers();
      return true;
    }
    toast.error(data.error || "Update failed");
    return false;
  }

  async function removeMember(id: string, email: string) {
    if (!confirm(`Remove ${email} from your team? They'll lose access immediately.`)) return;
    const res = await fetch(`/api/team/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Member removed");
      loadRealMembers();
    } else {
      toast.error("Failed to remove");
    }
  }

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
                className="input w-full text-xs pl-8" placeholder="Search members..." aria-label="Search team members" />
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
                        <button
                          onClick={e => { e.stopPropagation(); toast("Edit panel coming soon — use the 'Active Team Members' section below to manage real members.", { icon: "💡" }); }}
                          className="p-1.5 rounded-md hover:bg-surface-light text-muted hover:text-foreground transition-colors"
                          title="Edit"
                        ><Pencil size={11} /></button>
                        <button
                          onClick={e => { e.stopPropagation(); window.open(`mailto:${member.email}`); }}
                          className="p-1.5 rounded-md hover:bg-surface-light text-muted hover:text-foreground transition-colors"
                          title="Email"
                        ><Mail size={11} /></button>
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
                  <button
                    onClick={() => toast("Role editing is managed by the permission matrix — tweak per-member permissions in the Active Team Members list.", { icon: "💡" })}
                    className="p-1.5 rounded-lg hover:bg-surface-light text-muted hover:text-foreground transition-colors"
                    title="Role permissions are managed per-member"
                  ><Pencil size={11} /></button>
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

      {/* ═══ REAL TEAM MEMBERS SECTION ═══ */}
      {tab === "members" && realMembers.length > 0 && (
        <div className="card mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-header flex items-center gap-2 mb-0">
              <Users size={13} className="text-gold" /> Active Team Members
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold">
                {realMembers.filter(m => m.status === "active").length} active
              </span>
            </h2>
          </div>
          <div className="space-y-2">
            {realMembers.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-light/30 border border-border hover:border-gold/20 transition-all">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold/30 to-amber-500/20 flex items-center justify-center text-gold text-xs font-bold shrink-0">
                  {m.full_name?.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase() || m.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold truncate">{m.full_name || m.email}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full capitalize ${
                      m.role === "manager" ? "bg-purple-400/10 text-purple-400" :
                      m.role === "viewer" ? "bg-gray-400/10 text-gray-400" :
                      "bg-emerald-400/10 text-emerald-400"
                    }`}>{m.role}</span>
                    {m.job_title && <span className="text-[9px] text-muted">· {m.job_title}</span>}
                  </div>
                  <p className="text-[10px] text-muted">{m.email}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {m.can_manage_clients && <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-muted">Clients</span>}
                    {m.can_manage_outreach && <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-muted">Outreach</span>}
                    {m.can_manage_content && <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-muted">Content</span>}
                    {m.can_manage_ads && <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-muted">Ads</span>}
                    {m.can_view_financials && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-400/10 text-amber-400">Financials</span>}
                    {m.client_access_mode === "specific" && (
                      <span className="text-[8px] px-1 py-0.5 rounded bg-blue-400/10 text-blue-400">
                        {m.allowed_client_ids.length} client{m.allowed_client_ids.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditingMember(m)} className="p-1.5 rounded hover:bg-white/5 text-muted hover:text-foreground" title="Edit">
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => removeMember(m.id, m.email)} className="p-1.5 rounded hover:bg-red-500/10 text-muted hover:text-red-400" title="Remove">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ INVITE MODAL ═══ */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><UserPlus size={14} className="text-gold" /> Create Team Member</h3>
              <button onClick={() => setShowInvite(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <p className="text-[10px] text-muted -mt-1">A new account will be created. They&apos;ll log in with the email and password you set.</p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Email *</label>
                <input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                  className="input w-full text-xs" placeholder="member@yourco.com" />
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Full Name</label>
                <input value={createForm.full_name} onChange={e => setCreateForm({ ...createForm, full_name: e.target.value })}
                  className="input w-full text-xs" placeholder="Jane Smith" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Password *</label>
                <input type="password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                  className="input w-full text-xs" placeholder="Min 8 chars" />
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Job Title</label>
                <input value={createForm.job_title} onChange={e => setCreateForm({ ...createForm, job_title: e.target.value })}
                  className="input w-full text-xs" placeholder="Account Manager" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Role</label>
              <div className="flex gap-1">
                {(["member", "manager", "viewer"] as const).map(r => (
                  <button key={r} onClick={() => setCreateForm({ ...createForm, role: r })}
                    className={`flex-1 py-1.5 rounded-lg text-xs capitalize transition-all ${
                      createForm.role === r ? "bg-gold/15 text-gold border border-gold/30" : "bg-surface-light text-muted border border-border"
                    }`}>{r}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Permissions</label>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { key: "can_manage_clients", label: "Manage clients" },
                  { key: "can_manage_outreach", label: "Run outreach" },
                  { key: "can_manage_content", label: "Create content" },
                  { key: "can_manage_ads", label: "Manage ads" },
                  { key: "can_manage_team", label: "Invite team" },
                  { key: "can_view_financials", label: "View financials" },
                ] as const).map(p => (
                  <label key={p.key} className="flex items-center gap-2 p-2 rounded-lg bg-surface-light/50 border border-border cursor-pointer hover:border-gold/20">
                    <input
                      type="checkbox"
                      checked={!!createForm[p.key as keyof typeof createForm]}
                      onChange={e => setCreateForm({ ...createForm, [p.key]: e.target.checked })}
                      className="accent-gold"
                    />
                    <span className="text-[10px]">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5 flex items-start gap-2">
              <AlertTriangle size={11} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted">
                Team members control <span className="text-amber-400 font-medium">your clients</span>. They cannot create their own agency accounts, manage billing, or see other agencies.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowInvite(false)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={createMember} disabled={creating || !createForm.email || !createForm.password}
                className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                <UserPlus size={12} /> {creating ? "Creating..." : "Create Member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT MEMBER MODAL ═══ */}
      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={async (updates) => {
            const ok = await updateMember(editingMember.id, updates);
            if (ok) setEditingMember(null);
          }}
        />
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
              <button
                className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
                disabled={!customRoleName.trim()}
                onClick={() => {
                  const name = customRoleName.trim();
                  if (!name) { toast.error("Role name is required"); return; }
                  const selected = Object.entries(customPermissions)
                    .filter(([, v]) => v)
                    .map(([k]) => k);
                  if (selected.length === 0) {
                    toast.error("Toggle at least one permission for this role");
                    return;
                  }
                  // Custom roles aren't persisted to the backend yet — surface
                  // that clearly instead of fake-success closing the modal.
                  toast("Custom roles aren't saved yet. Use per-member permissions in Active Team Members for now.", { icon: "💡", duration: 6000 });
                  setShowCustomRole(false);
                  setCustomRoleName("");
                  setCustomPermissions({});
                }}
              >
                <CheckCircle size={12} /> Create Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Edit Team Member Modal ── */
interface EditMemberProps {
  member: {
    id: string;
    email: string;
    full_name: string;
    job_title?: string;
    role: string;
    can_manage_clients: boolean;
    can_manage_outreach: boolean;
    can_manage_content: boolean;
    can_manage_ads: boolean;
    can_manage_team: boolean;
    can_view_financials: boolean;
  };
  onClose: () => void;
  onSave: (updates: Record<string, unknown>) => Promise<void>;
}

function EditMemberModal({ member, onClose, onSave }: EditMemberProps) {
  const [full_name, setFullName] = useState(member.full_name || "");
  const [new_email, setNewEmail] = useState(member.email);
  const [new_password, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [job_title, setJobTitle] = useState(member.job_title || "");
  const [role, setRole] = useState(member.role);
  const [perms, setPerms] = useState({
    can_manage_clients: member.can_manage_clients,
    can_manage_outreach: member.can_manage_outreach,
    can_manage_content: member.can_manage_content,
    can_manage_ads: member.can_manage_ads,
    can_manage_team: member.can_manage_team,
    can_view_financials: member.can_view_financials,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const updates: Record<string, unknown> = {
      full_name, job_title, role, ...perms,
    };
    if (new_email !== member.email) updates.new_email = new_email;
    if (new_password) updates.new_password = new_password;
    await onSave(updates);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl border border-border w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2"><Pencil size={14} className="text-gold" /> Edit Team Member</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close edit dialog"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Full Name</label>
            <input value={full_name} onChange={e => setFullName(e.target.value)} className="input w-full text-xs" />
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Job Title</label>
            <input value={job_title} onChange={e => setJobTitle(e.target.value)} className="input w-full text-xs" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold flex items-center gap-1">
            <Mail size={9} /> Email (change requires re-login)
          </label>
          <input type="email" value={new_email} onChange={e => setNewEmail(e.target.value)} className="input w-full text-xs" />
        </div>

        <div>
          <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold flex items-center gap-1">
            <Key size={9} /> Reset Password <span className="text-muted normal-case">(optional — leave blank to keep)</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={new_password}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              className="input w-full text-xs pr-8"
            />
            <button onClick={() => setShowPassword(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
              {showPassword ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Role</label>
          <div className="flex gap-1">
            {(["member", "manager", "viewer"] as const).map(r => (
              <button key={r} onClick={() => setRole(r)}
                className={`flex-1 py-1.5 rounded-lg text-xs capitalize transition-all ${
                  role === r ? "bg-gold/15 text-gold border border-gold/30" : "bg-surface-light text-muted border border-border"
                }`}>{r}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Permissions</label>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              { key: "can_manage_clients", label: "Manage clients" },
              { key: "can_manage_outreach", label: "Run outreach" },
              { key: "can_manage_content", label: "Create content" },
              { key: "can_manage_ads", label: "Manage ads" },
              { key: "can_manage_team", label: "Invite team" },
              { key: "can_view_financials", label: "View financials" },
            ] as const).map(p => (
              <label key={p.key} className="flex items-center gap-2 p-2 rounded-lg bg-surface-light/50 border border-border cursor-pointer hover:border-gold/20">
                <input
                  type="checkbox"
                  checked={perms[p.key as keyof typeof perms]}
                  onChange={e => setPerms({ ...perms, [p.key]: e.target.checked })}
                  className="accent-gold"
                />
                <span className="text-[10px]">{p.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
