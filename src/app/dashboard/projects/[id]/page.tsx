"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FolderKanban,
  FileText,
  Image as ImageIcon,
  Users,
  Clock,
  Loader2,
  Save,
  Trash2,
  Plus,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";

type Status = "draft" | "active" | "review" | "complete" | "archived";
type Role = "lead" | "contributor" | "freelancer" | "client" | "viewer";
type AssetType = "ai_generation" | "invoice" | "booking" | "file" | "hire" | "message" | "thumbnail" | "video";
type Tab = "brief" | "assets" | "team" | "timeline";

interface Project {
  id: string;
  org_id: string | null;
  client_id: string | null;
  name: string;
  brief: string | null;
  deadline: string | null;
  status: Status;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Member {
  project_id: string;
  user_id: string;
  role: Role;
  added_at: string;
}

interface Asset {
  id: string;
  project_id: string;
  asset_type: AssetType;
  asset_id: string | null;
  asset_table: string | null;
  added_at: string;
  added_by: string | null;
}

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  draft:     { label: "Draft",     color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  active:    { label: "Active",    color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  review:    { label: "Review",    color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  complete:  { label: "Complete",  color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  archived:  { label: "Archived",  color: "#4b5563", bg: "rgba(75,85,99,0.12)" },
};

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "brief",    label: "Brief",    icon: <FileText size={14} /> },
  { key: "assets",   label: "Assets",   icon: <ImageIcon size={14} /> },
  { key: "team",     label: "Team",     icon: <Users size={14} /> },
  { key: "timeline", label: "Timeline", icon: <Clock size={14} /> },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("brief");
  const [saving, setSaving] = useState(false);

  // brief tab local state
  const [briefDraft, setBriefDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<Status>("draft");
  const [deadlineDraft, setDeadlineDraft] = useState("");

  // new member form
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<Role>("contributor");

  const fetchAll = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [pr, mr, ar] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/members`),
        fetch(`/api/projects/${id}/assets`),
      ]);
      if (!pr.ok) throw new Error("Failed to load project");
      const pj = await pr.json();
      const mj = mr.ok ? await mr.json() : { members: [] };
      const aj = ar.ok ? await ar.json() : { assets: [] };

      setProject(pj.project);
      setMembers(mj.members ?? []);
      setAssets(aj.assets ?? []);

      setNameDraft(pj.project.name ?? "");
      setBriefDraft(pj.project.brief ?? "");
      setStatusDraft(pj.project.status ?? "draft");
      setDeadlineDraft(pj.project.deadline ? pj.project.deadline.slice(0, 10) : "");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't load project");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  async function saveBrief() {
    if (!id) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: nameDraft.trim(),
          brief: briefDraft,
          status: statusDraft,
          deadline: deadlineDraft ? new Date(deadlineDraft).toISOString() : null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Save failed");
      setProject(j.project);
      toast.success("Saved");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject() {
    if (!id) return;
    if (!confirm("Delete this project? This cannot be undone.")) return;
    try {
      const r = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Delete failed");
      toast.success("Project deleted");
      router.push("/dashboard/projects");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      toast.error(msg);
    }
  }

  async function addMember() {
    if (!id || !newUserId.trim()) return;
    try {
      const r = await fetch(`/api/projects/${id}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: newUserId.trim(), role: newRole }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to add");
      setMembers((prev) => [...prev, j.member]);
      setNewUserId("");
      toast.success("Member added");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add member";
      toast.error(msg);
    }
  }

  async function removeMember(userId: string) {
    if (!id) return;
    try {
      const r = await fetch(`/api/projects/${id}/members?user_id=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error("Remove failed");
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      toast.success("Member removed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Remove failed";
      toast.error(msg);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-60 rounded-lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        icon={<FolderKanban size={36} />}
        title="Project not found"
        description="It may have been deleted or you no longer have access."
        action={
          <Link href="/dashboard/projects" className="text-xs underline hover:text-[#C9A84C]">
            Back to projects
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 fade-in">
      <PageHero
        title={project.name}
        subtitle={project.brief || "No brief yet."}
        icon={<FolderKanban size={20} />}
        gradient="gold"
        eyebrow={
          <Link href="/dashboard/projects" className="inline-flex items-center gap-1 hover:text-[#C9A84C]">
            <ArrowLeft size={12} /> Back to projects
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ color: STATUS_META[project.status].color, background: STATUS_META[project.status].bg }}
            >
              {STATUS_META[project.status].label}
            </span>
            <button
              onClick={deleteProject}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-red-400 hover:border-red-400"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition ${
              tab === t.key
                ? "border-[#C9A84C] text-[#C9A84C]"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "brief" && (
        <div className="max-w-2xl flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Name</label>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Brief</label>
            <textarea
              value={briefDraft}
              onChange={(e) => setBriefDraft(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Status</label>
              <select
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value as Status)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="review">Review</option>
                <option value="complete">Complete</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Deadline</label>
              <input
                type="date"
                value={deadlineDraft}
                onChange={(e) => setDeadlineDraft(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="pt-2">
            <button
              onClick={saveBrief}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-black hover:bg-[#D6B85E] disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          </div>
        </div>
      )}

      {tab === "assets" && (
        <div>
          {assets.length === 0 ? (
            <EmptyState
              icon={<ImageIcon size={36} />}
              title="No assets linked yet"
              description="Link generations, invoices, videos, files, and more to this project as work progresses."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {assets.map((a) => (
                <div key={a.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
                      {a.asset_type}
                    </span>
                    <span className="text-[10px] text-muted">
                      {new Date(a.added_at).toLocaleDateString()}
                    </span>
                  </div>
                  {a.asset_table && (
                    <div className="text-[11px] text-muted">{a.asset_table}</div>
                  )}
                  {a.asset_id && (
                    <div className="text-[10px] text-muted font-mono truncate">{a.asset_id}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "team" && (
        <div className="flex flex-col gap-4 max-w-2xl">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted mb-1">User ID</label>
              <input
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder="uuid of profile"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="lead">Lead</option>
                <option value="contributor">Contributor</option>
                <option value="freelancer">Freelancer</option>
                <option value="client">Client</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button
              onClick={addMember}
              disabled={!newUserId.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-[#C9A84C] px-3 py-2 text-xs font-semibold text-black disabled:opacity-50"
            >
              <Plus size={12} /> Add
            </button>
          </div>

          {members.length === 0 ? (
            <EmptyState
              icon={<Users size={36} />}
              title="No team members yet"
              description="Add leads, contributors, freelancers, clients, or viewers to collaborate on this project."
            />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <div className="flex flex-col">
                    <span className="font-mono text-[11px]">{m.user_id}</span>
                    <span className="text-[10px] text-muted">Added {new Date(m.added_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-card px-2 py-0.5 text-[10px] capitalize">{m.role}</span>
                    <button
                      onClick={() => removeMember(m.user_id)}
                      aria-label="Remove member"
                      className="text-muted hover:text-red-400"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "timeline" && (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3 text-sm">
              <Clock size={14} className="text-muted" />
              <span className="text-muted">Created</span>
              <span>{new Date(project.created_at).toLocaleString()}</span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3 text-sm">
              <Clock size={14} className="text-muted" />
              <span className="text-muted">Last updated</span>
              <span>{new Date(project.updated_at).toLocaleString()}</span>
            </div>
          </div>
          {project.deadline && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3 text-sm">
                <Clock size={14} className="text-muted" />
                <span className="text-muted">Deadline</span>
                <span>{new Date(project.deadline).toLocaleString()}</span>
              </div>
            </div>
          )}
          <EmptyState
            icon={<Clock size={36} />}
            title="More timeline events coming soon"
            description="Activity feed, milestones, and auto-generated project events will live here in a later sprint."
          />
        </div>
      )}
    </div>
  );
}
