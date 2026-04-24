"use client";

import { useState, useEffect, useCallback } from "react";
import { Tag, Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import { TableSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface TagRow {
  id: string;
  name: string;
  color: string;
  category: string | null;
  _leadCount: number;
}

const PRESET_COLORS = [
  "#ef4444","#f97316","#f59e0b","#84cc16","#10b981",
  "#06b6d4","#3b82f6","#8b5cf6","#ec4899","#6b7280",
];

function TagBadge({ tag }: { tag: Pick<TagRow, "name" | "color"> }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ background: tag.color + "22", color: tag.color, border: `1px solid ${tag.color}44` }}
    >
      <span className="inline-block rounded-full w-2 h-2 shrink-0" style={{ background: tag.color }} />
      {tag.name}
    </span>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="rounded-full border-2 transition-all"
          style={{ width: 20, height: 20, background: c, borderColor: value === c ? "#fff" : "transparent" }}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
        title="Custom colour"
      />
    </div>
  );
}

export default function TagsPage() {
  const supabase = createClient();
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newCategory, setNewCategory] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);
  const [editCategory, setEditCategory] = useState("");

  const fetchTags = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tags")
      .select("id, name, color, category")
      .order("name");
    if (error) { toast.error("Failed to load tags"); setLoading(false); return; }

    // best-effort lead counts via leads.tags array if it exists
    const rows: TagRow[] = (data ?? []).map((t: Omit<TagRow, "_leadCount">) => ({ ...t, _leadCount: 0 }));
    try {
      const { data: leads } = await supabase.from("leads").select("tags_applied");
      if (leads) {
        const counts: Record<string, number> = {};
        leads.forEach((l: { tags_applied?: string[] }) => {
          (l.tags_applied ?? []).forEach((n) => { counts[n] = (counts[n] ?? 0) + 1; });
        });
        rows.forEach((r) => { r._leadCount = counts[r.name] ?? 0; });
      }
    } catch { /* column may not exist */ }
    setTags(rows);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setSaving(false); return; }
    const { error } = await supabase.from("tags").insert({
      name: newName.trim(), color: newColor,
      category: newCategory.trim() || null, user_id: user.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Tag created");
    setNewName(""); setNewColor(PRESET_COLORS[0]); setNewCategory(""); setShowCreate(false);
    fetchTags();
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("tags").update({
      name: editName.trim(), color: editColor,
      category: editCategory.trim() || null,
    }).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Tag updated"); setEditId(null); fetchTags();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this tag?")) return;
    setDeleting(id);
    const { error } = await supabase.from("tags").delete().eq("id", id);
    setDeleting(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Tag deleted");
    setTags((prev) => prev.filter((t) => t.id !== id));
  }

  function startEdit(tag: TagRow) {
    setEditId(tag.id); setEditName(tag.name);
    setEditColor(tag.color); setEditCategory(tag.category ?? "");
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Tag Manager"
        subtitle="Unified tag namespace across leads, clients, deals, and content."
        icon={<Tag size={22} />}
        gradient="gold"
        actions={
          <button onClick={() => setShowCreate((v) => !v)}
            className="btn-primary flex items-center gap-2 text-sm px-3 py-2 rounded-lg">
            <Plus size={16} /> New Tag
          </button>
        }
      />

      {showCreate && (
        <div className="card p-5 space-y-4 border border-white/10">
          <p className="font-semibold text-white text-sm">New Tag</p>
          <div className="flex flex-wrap gap-3">
            <input className="input flex-1 min-w-[160px] text-sm" placeholder="Tag name"
              value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus />
            <input className="input w-36 text-sm" placeholder="Category (optional)"
              value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Colour:</span>
            <ColorPicker value={newColor} onChange={setNewColor} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !newName.trim()}
              className="btn-primary flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
            </button>
            <button onClick={() => setShowCreate(false)}
              className="btn-ghost flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg">
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? <TableSkeleton rows={6} /> : tags.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-4 text-center">
          <Tag size={40} className="text-muted opacity-30" />
          <p className="text-white font-semibold">No tags yet</p>
          <p className="text-muted text-sm max-w-xs">Create tags to segment and organise every record in one place.</p>
          <button onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2 rounded-lg mt-1">
            <Plus size={15} /> Create first tag
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-muted text-xs">
                <th className="text-left px-4 py-3 font-medium">Tag</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Category</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Leads</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tags.map((tag) =>
                editId === tag.id ? (
                  <tr key={tag.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ColorPicker value={editColor} onChange={setEditColor} />
                        <input className="input text-sm h-8 w-32" value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleUpdate(tag.id)} autoFocus />
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <input className="input text-sm h-8 w-28" value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)} placeholder="Category" />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell" />
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleUpdate(tag.id)} disabled={saving}
                          className="p-1.5 rounded hover:bg-green-500/20 text-green-400">
                          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        </button>
                        <button onClick={() => setEditId(null)} className="p-1.5 rounded hover:bg-white/10 text-muted">
                          <X size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={tag.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-3"><TagBadge tag={tag} /></td>
                    <td className="px-4 py-3 text-muted hidden sm:table-cell">{tag.category ?? "—"}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {tag._leadCount > 0
                        ? <span className="text-xs bg-white/5 px-2 py-0.5 rounded-full">{tag._leadCount}</span>
                        : <span className="text-muted text-xs">0</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(tag)}
                          className="p-1.5 rounded hover:bg-white/10 text-muted hover:text-white">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(tag.id)} disabled={deleting === tag.id}
                          className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400">
                          {deleting === tag.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
