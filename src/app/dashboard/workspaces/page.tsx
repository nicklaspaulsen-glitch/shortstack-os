"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { LayoutGrid, Plus, Check, X, Loader2, Users, CheckCircle } from "lucide-react";
import { CardSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { MotionPage } from "@/components/motion/motion-page";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  _memberCount: number;
}

const ACTIVE_KEY = "active_workspace_id";

function getActiveId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function WorkspacesPage() {
  const supabase = createClient();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });

  useEffect(() => { setActiveId(getActiveId()); }, []);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("workspaces")
      .select("id, name, slug, description, is_active, is_default, created_at")
      .order("created_at", { ascending: true });
    if (error) { toast.error("Failed to load workspaces"); setLoading(false); return; }

    const rows = data ?? [];
    // fetch member counts
    const { data: members } = await supabase
      .from("workspace_members")
      .select("workspace_id");

    const counts: Record<string, number> = {};
    (members ?? []).forEach((m: { workspace_id: string }) => {
      counts[m.workspace_id] = (counts[m.workspace_id] ?? 0) + 1;
    });

    setWorkspaces(rows.map((w: Omit<Workspace, "_memberCount">) => ({ ...w, _memberCount: counts[w.id] ?? 0 })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  function handleNameChange(name: string) {
    setForm({ ...form, name, slug: slugify(name) });
  }

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setSaving(false); return; }
    const slug = form.slug || slugify(form.name);
    const { error } = await supabase.from("workspaces").insert({
      name: form.name.trim(),
      slug,
      description: form.description.trim() || null,
      profile_id: user.id,
      is_active: true,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Workspace created");
    setForm({ name: "", slug: "", description: "" }); setShowCreate(false); fetchWorkspaces();
  }

  function switchWorkspace(id: string) {
    localStorage.setItem(ACTIVE_KEY, id);
    setActiveId(id);
    const ws = workspaces.find((w) => w.id === id);
    toast.success(`Switched to "${ws?.name ?? "workspace"}"`);
  }

  return (
    <MotionPage className="space-y-6">{/* -- Workspaces command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">Multi-tenant Setup</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Workspaces</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => setShowCreate((v) => !v)}
                  className="btn-primary flex items-center gap-2 text-sm px-3 py-2 rounded-lg">
                  <Plus size={16} /> New Workspace
                </button>
      </div>
    </div>{showCreate && (
              <motion.div
                className="glass rounded-xl p-5 space-y-4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <p className="font-semibold text-text-primary text-sm">New Workspace</p>
                <div className="flex flex-wrap gap-3">
                  <input className="input flex-1 min-w-[180px] text-sm" placeholder="Workspace name"
                    value={form.name} onChange={(e) => handleNameChange(e.target.value)} autoFocus />
                  <input className="input w-44 text-sm" placeholder="slug (auto)"
                    value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} />
                </div>
                <input className="input w-full text-sm" placeholder="Description (optional)"
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <div className="flex gap-2">
                  <button onClick={handleCreate} disabled={saving || !form.name.trim()}
                    className="btn-primary flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Create
                  </button>
                  <button onClick={() => setShowCreate(false)}
                    className="btn-ghost flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg">
                    <X size={13} /> Cancel
                  </button>
                </div>
              </motion.div>
            )}{loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[0,1,2].map((i) => <CardSkeleton key={i} />)}
              </div>
            ) : workspaces.length === 0 ? (
              <motion.div
                className="glass rounded-xl p-12 flex flex-col items-center gap-4 text-center"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <LayoutGrid size={40} className="text-text-muted opacity-30" />
                <p className="text-text-primary font-semibold">No workspaces yet</p>
                <p className="text-text-muted text-sm max-w-xs">Create your first workspace to start isolating data per brand or client.</p>
                <button onClick={() => setShowCreate(true)}
                  className="btn-primary flex items-center gap-2 text-sm px-4 py-2 rounded-lg mt-1">
                  <Plus size={15} /> Create first workspace
                </button>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {workspaces.map((w, i) => {
                  const isActive = activeId === w.id;
                  return (
                    <motion.div
                      key={w.id}
                      className={`glass rounded-xl p-5 flex flex-col gap-3 transition-all spotlight-card ${isActive ? "border border-brand-accent/40 bg-brand-accent/5" : ""}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                      whileHover={{ y: -4, scale: 1.01 }}
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                        e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-text-primary font-semibold truncate">{w.name}</p>
                            {w.is_default && (
                              <span className="text-[10px] bg-brand-accent/10 text-indigo-400 border border-brand-accent/20 px-1.5 py-0.5 rounded-full shrink-0">Default</span>
                            )}
                          </div>
                          <p className="text-text-muted text-xs mt-0.5 font-mono">{w.slug}</p>
                        </div>
                        {isActive && <CheckCircle size={18} className="text-brand-accent shrink-0 mt-0.5" />}
                      </div>
                      {w.description && <p className="text-text-muted text-xs line-clamp-2">{w.description}</p>}
                      <div className="flex items-center gap-3 text-xs text-text-muted mt-auto">
                        <span className="flex items-center gap-1"><Users size={12} /> {w._memberCount} member{w._memberCount !== 1 ? "s" : ""}</span>
                        <span>·</span>
                        <span>{new Date(w.created_at).toLocaleDateString()}</span>
                      </div>
                      {!isActive && (
                        <button onClick={() => switchWorkspace(w.id)}
                          className="btn-ghost text-sm py-1.5 rounded-lg w-full border border-border-subtle hover:border-brand-accent/30 mt-1">
                          Switch to this workspace
                        </button>
                      )}
                      {isActive && (
                        <div className="text-center text-xs text-indigo-400 py-1">Currently active</div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}</MotionPage>
  );
}
