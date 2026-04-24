"use client";

/**
 * Booking teams builder.
 *
 * Create round-robin pools, pick a distribution mode, add team members,
 * preview the next 5 assignments.
 */

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  UsersRound,
  Plus,
  Trash2,
  Repeat,
  ShieldCheck,
  Zap,
  Eye,
  Loader2,
  X,
  ArrowRight,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

interface TeamMember {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  priority: number;
  assignments_count: number;
  active: boolean;
}

interface Team {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string | null;
  distribution_mode: "round_robin" | "fair" | "first_available";
  default_duration_minutes: number | null;
  active: boolean;
  last_assigned_user_id: string | null;
  members: TeamMember[];
}

interface AgencyMember {
  id: string;
  email: string;
  full_name: string | null;
  member_profile_id: string | null;
  status: string;
}

interface PreviewRow {
  order: number;
  userId: string | null;
  name?: string;
}

const MODE_META: Record<Team["distribution_mode"], { label: string; icon: React.ReactNode; desc: string }> = {
  round_robin: { label: "Round robin", icon: <Repeat className="w-4 h-4" />, desc: "Rotate evenly through the team" },
  fair: { label: "Fair", icon: <ShieldCheck className="w-4 h-4" />, desc: "Whoever has the fewest assignments" },
  first_available: { label: "First available", icon: <Zap className="w-4 h-4" />, desc: "Top priority member first" },
};

export default function CalendarTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [agencyMembers, setAgencyMembers] = useState<AgencyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    distribution_mode: "round_robin" as Team["distribution_mode"],
    default_duration_minutes: 30,
    members: [] as string[],
  });
  const [previews, setPreviews] = useState<Record<string, PreviewRow[]>>({});
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [teamsRes, membersRes] = await Promise.all([
        fetch("/api/calendar/teams"),
        fetch("/api/team"),
      ]);
      if (teamsRes.ok) {
        const d = await teamsRes.json();
        setTeams(d.teams || []);
      }
      if (membersRes.ok) {
        const d = await membersRes.json();
        setAgencyMembers(d.members || []);
      }
    } catch {
      toast.error("Failed to load teams");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createTeam() {
    if (!createForm.name.trim()) {
      toast.error("Team name required");
      return;
    }
    const res = await fetch("/api/calendar/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    if (!res.ok) {
      toast.error("Failed to create team");
      return;
    }
    toast.success("Team created");
    setShowCreate(false);
    setCreateForm({
      name: "",
      distribution_mode: "round_robin",
      default_duration_minutes: 30,
      members: [],
    });
    load();
  }

  async function deleteTeam(id: string) {
    if (!confirm("Delete team?")) return;
    const res = await fetch(`/api/calendar/teams?id=${id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Failed");
    else {
      toast.success("Team deleted");
      setTeams((prev) => prev.filter((t) => t.id !== id));
    }
  }

  async function updateMode(id: string, mode: Team["distribution_mode"]) {
    setTeams((prev) =>
      prev.map((t) => (t.id === id ? { ...t, distribution_mode: mode } : t)),
    );
    await fetch("/api/calendar/teams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, distribution_mode: mode }),
    });
  }

  async function updateMembers(id: string, memberIds: string[]) {
    await fetch("/api/calendar/teams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, members: memberIds }),
    });
    load();
  }

  async function loadPreview(id: string) {
    setPreviewLoading(id);
    try {
      const res = await fetch(`/api/calendar/teams/preview?team_id=${id}&count=5`);
      if (res.ok) {
        const d = await res.json();
        setPreviews((prev) => ({ ...prev, [id]: d.preview || [] }));
      }
    } finally {
      setPreviewLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      <PageHero
        title="Booking teams"
        subtitle="Round-robin pools for your client portal's book-a-call flow."
        icon={<UsersRound className="w-6 h-6" />}
        gradient="gold"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            New team
          </button>
        }
      />

      <div className="max-w-6xl mx-auto px-6 mt-6 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-white/40">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-12 text-center">
            <UsersRound className="w-12 h-12 mx-auto text-white/20 mb-3" />
            <div className="text-lg font-medium">No booking teams yet</div>
            <div className="text-sm text-white/50 mt-1 mb-6">
              Create a team to route inbound bookings across multiple reps.
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-lg bg-gold/20 hover:bg-gold/30 text-gold text-sm font-medium"
            >
              <Plus className="w-4 h-4 inline mr-1" /> Create team
            </button>
          </div>
        ) : (
          teams.map((team) => (
            <div
              key={team.id}
              className="bg-white/[0.03] border border-white/10 rounded-xl p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-lg font-semibold">{team.name}</div>
                  <div className="text-xs text-white/40">
                    {team.members.length} member{team.members.length === 1 ? "" : "s"} · default{" "}
                    {team.default_duration_minutes} min
                  </div>
                </div>
                <button
                  onClick={() => deleteTeam(team.id)}
                  className="text-white/40 hover:text-red-400 p-1"
                  title="Delete team"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Distribution mode pills */}
              <div className="flex flex-wrap gap-2 mb-4">
                {(Object.keys(MODE_META) as Team["distribution_mode"][]).map((m) => (
                  <button
                    key={m}
                    onClick={() => updateMode(team.id, m)}
                    className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 border transition ${
                      team.distribution_mode === m
                        ? "bg-gold/20 border-gold/40 text-gold"
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                    }`}
                    title={MODE_META[m].desc}
                  >
                    {MODE_META[m].icon}
                    {MODE_META[m].label}
                  </button>
                ))}
              </div>

              {/* Members */}
              <div className="mb-4">
                <div className="text-xs uppercase tracking-wider text-white/40 mb-2">
                  Members
                </div>
                <div className="flex flex-wrap gap-2">
                  {team.members.length === 0 ? (
                    <div className="text-sm text-white/40">
                      No members — add from your agency team.
                    </div>
                  ) : (
                    team.members.map((m) => (
                      <div
                        key={m.id}
                        className="bg-white/5 rounded-lg px-3 py-1.5 text-xs flex items-center gap-2"
                      >
                        <span className="font-medium">{m.name}</span>
                        <span className="text-white/40">
                          · {m.assignments_count} assigned
                        </span>
                        <button
                          onClick={() =>
                            updateMembers(
                              team.id,
                              team.members.filter((x) => x.id !== m.id).map((x) => x.user_id),
                            )
                          }
                          className="text-white/40 hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <AddMemberPicker
                  agencyMembers={agencyMembers}
                  existingUserIds={team.members.map((m) => m.user_id)}
                  onAdd={(uid) =>
                    updateMembers(team.id, [...team.members.map((m) => m.user_id), uid])
                  }
                />
              </div>

              {/* Preview */}
              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs uppercase tracking-wider text-white/40 flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    Next 5 bookings would go to
                  </div>
                  <button
                    onClick={() => loadPreview(team.id)}
                    disabled={previewLoading === team.id}
                    className="text-xs text-gold hover:underline disabled:opacity-50"
                  >
                    {previewLoading === team.id ? "…" : "Refresh"}
                  </button>
                </div>
                {previews[team.id] ? (
                  <div className="space-y-1">
                    {previews[team.id].length === 0 ? (
                      <div className="text-sm text-white/40">
                        No members to assign.
                      </div>
                    ) : (
                      previews[team.id].map((p) => (
                        <div
                          key={p.order}
                          className="flex items-center gap-3 text-sm"
                        >
                          <span className="text-white/30 w-5">#{p.order}</span>
                          <ArrowRight className="w-3 h-3 text-white/30" />
                          <span>{p.name || "—"}</span>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-white/40">
                    Click Refresh to compute.
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">New booking team</h3>
              <button
                onClick={() => setShowCreate(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="block text-sm">
              <span className="text-white/70 mb-1 block">Team name</span>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
                placeholder="Sales, Onboarding, Account managers…"
                className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-white/70 mb-1 block">Distribution</span>
              <select
                value={createForm.distribution_mode}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    distribution_mode: e.target.value as Team["distribution_mode"],
                  })
                }
                className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-sm"
              >
                {(Object.keys(MODE_META) as Team["distribution_mode"][]).map((m) => (
                  <option key={m} value={m}>
                    {MODE_META[m].label} — {MODE_META[m].desc}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-white/70 mb-1 block">
                Default duration (minutes)
              </span>
              <input
                type="number"
                min={15}
                max={120}
                step={15}
                value={createForm.default_duration_minutes}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    default_duration_minutes: Number(e.target.value) || 30,
                  })
                }
                className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-sm"
              />
            </label>
            <div className="block text-sm">
              <span className="text-white/70 mb-1 block">Members</span>
              <div className="space-y-1 max-h-48 overflow-y-auto bg-[#1a1a1a] border border-white/10 rounded p-2">
                {agencyMembers.filter((m) => !!m.member_profile_id).length === 0 ? (
                  <div className="text-xs text-white/40 p-2">
                    No agency team members yet. Create them in Dashboard → Team first.
                  </div>
                ) : (
                  agencyMembers
                    .filter((m) => !!m.member_profile_id)
                    .map((m) => {
                      const uid = m.member_profile_id!;
                      const checked = createForm.members.includes(uid);
                      return (
                        <label
                          key={m.id}
                          className="flex items-center gap-2 text-sm py-1"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setCreateForm({
                                ...createForm,
                                members: e.target.checked
                                  ? [...createForm.members, uid]
                                  : createForm.members.filter((x) => x !== uid),
                              })
                            }
                          />
                          <span>{m.full_name || m.email}</span>
                          <span className="text-white/40 text-xs ml-auto">
                            {m.status}
                          </span>
                        </label>
                      );
                    })
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={createTeam}
                className="px-4 py-2 rounded-lg bg-gold/20 hover:bg-gold/30 text-gold text-sm font-medium"
              >
                Create team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddMemberPicker({
  agencyMembers,
  existingUserIds,
  onAdd,
}: {
  agencyMembers: AgencyMember[];
  existingUserIds: string[];
  onAdd: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const available = agencyMembers.filter(
    (m) => !!m.member_profile_id && !existingUserIds.includes(m.member_profile_id!),
  );
  if (available.length === 0) {
    return null;
  }
  return (
    <div className="relative mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-gold hover:underline flex items-center gap-1"
      >
        <Plus className="w-3 h-3" />
        Add member
      </button>
      {open && (
        <div className="absolute z-10 mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl min-w-[200px] py-1">
          {available.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onAdd(m.member_profile_id!);
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-white/5"
            >
              {m.full_name || m.email}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
