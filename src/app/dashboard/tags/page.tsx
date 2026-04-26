"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Tag, Plus, Pencil, Trash2, Check, X, Loader2,
  Users, Sparkles, GitMerge, ExternalLink,
} from "lucide-react";
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
  _assetCount: number;
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

  // Bulk-ops state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");

  const fetchTags = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tags")
      .select("id, name, color, category")
      .order("name");
    if (error) { toast.error("Failed to load tags"); setLoading(false); return; }

    type TagBaseRow = Omit<TagRow, "_leadCount" | "_assetCount">;
    const rows: TagRow[] = (data as TagBaseRow[] ?? []).map((t) => ({
      ...t,
      _leadCount: 0,
      _assetCount: 0,
    }));

    // Real usage counts via /api/tags/usage. Falls back to zero on failure.
    try {
      const res = await fetch("/api/tags/usage");
      if (res.ok) {
        const json = await res.json();
        const usage = (json.usage ?? []) as Array<{ name: string; leads: number; assets: number }>;
        const byName: Record<string, { leads: number; assets: number }> = {};
        for (const u of usage) byName[u.name] = { leads: u.leads, assets: u.assets };
        rows.forEach((r) => {
          const u = byName[r.name];
          if (u) {
            r._leadCount = u.leads;
            r._assetCount = u.assets;
          }
        });
      }
    } catch { /* non-fatal */ }
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

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleBulkMerge() {
    const target = mergeTarget.trim();
    if (!target) { toast.error("Pick a target tag name"); return; }
    const sourceNames = tags.filter((t) => selected.has(t.id) && t.name !== target).map((t) => t.name);
    if (sourceNames.length === 0) {
      toast.error("Select at least one source tag (different from target)");
      return;
    }
    setBulkBusy(true);
    try {
      const res = await fetch("/api/tags/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "merge", target_name: target, source_names: sourceNames }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Merge failed");
      toast.success(`Merged ${sourceNames.length} tag${sourceNames.length === 1 ? "" : "s"}`);
      setSelected(new Set());
      setShowMerge(false);
      setMergeTarget("");
      fetchTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkDeleteUnused() {
    if (!confirm("Delete every tag with zero leads and zero assets attached? This cannot be undone.")) {
      return;
    }
    setBulkBusy(true);
    try {
      const res = await fetch("/api/tags/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_unused" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Delete failed");
      toast.success(`Deleted ${json.deleted} unused tag${json.deleted === 1 ? "" : "s"}`);
      fetchTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Tag Manager"
        subtitle="Unified tag namespace across leads, clients, deals, and content."
        icon={<Tag size={22} />}
        gradient="gold"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={handleBulkDeleteUnused} disabled={bulkBusy}
              className="btn-ghost flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg disabled:opacity-50"
              title="Remove every tag that has zero usages">
              <Sparkles size={13} /> Clean Unused
            </button>
            <button onClick={() => setShowCreate((v) => !v)}
              className="btn-primary flex items-center gap-2 text-sm px-3 py-2 rounded-lg">
              <Plus size={16} /> New Tag
            </button>
          </div>
        }
      />

      {/* Bulk-action bar — appears when at least one tag is selected */}
      {selected.size > 0 && (
        <div className="card p-3 flex items-center justify-between gap-3 border border-gold/30 bg-gold/5">
          <p className="text-xs text-white/70">
            <span className="font-semibold text-white">{selected.size}</span> tag{selected.size === 1 ? "" : "s"} selected
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMerge((v) => !v)} disabled={bulkBusy}
              className="btn-ghost flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg">
              <GitMerge size={12} /> Merge into…
            </button>
            <button onClick={() => setSelected(new Set())} className="btn-ghost text-xs px-3 py-1.5 rounded-lg">
              Clear
            </button>
          </div>
        </div>
      )}

      {showMerge && selected.size > 0 && (
        <div className="card p-4 space-y-3 border border-gold/30">
          <p className="text-sm font-semibold text-white">Merge {selected.size} tag{selected.size === 1 ? "" : "s"} into:</p>
          <input
            className="input w-full text-sm"
            placeholder="Target tag name (existing or new)"
            value={mergeTarget}
            onChange={(e) => setMergeTarget(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleBulkMerge()}
            autoFocus
          />
          <p className="text-[11px] text-muted">
            Every lead currently tagged with the selected names will be re-tagged
            with the target. The source tag rows are deleted.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={handleBulkMerge} disabled={bulkBusy || !mergeTarget.trim()}
              className="btn-primary flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">
              {bulkBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Merge
            </button>
            <button onClick={() => setShowMerge(false)} className="btn-ghost text-sm px-3 py-1.5 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

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
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === tags.length}
                    onChange={() =>
                      setSelected((prev) =>
                        prev.size === tags.length ? new Set() : new Set(tags.map((t) => t.id)),
                      )
                    }
                    className="rounded accent-gold"
                    title="Select all"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium">Tag</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Category</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Usage</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tags.map((tag) =>
                editId === tag.id ? (
                  <tr key={tag.id}>
                    <td className="px-3 py-3" />
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
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(tag.id)}
                        onChange={() => toggleSelect(tag.id)}
                        className="rounded accent-gold"
                      />
                    </td>
                    <td className="px-4 py-3"><TagBadge tag={tag} /></td>
                    <td className="px-4 py-3 text-muted hidden sm:table-cell">{tag.category ?? "—"}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {tag._leadCount + tag._assetCount > 0 ? (
                        <Link
                          href={`/dashboard/leads?tag=${encodeURIComponent(tag.name)}`}
                          className="inline-flex items-center gap-1 text-xs bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-full transition-all"
                          title={`${tag._leadCount} leads · ${tag._assetCount} assets — click to filter Leads`}
                        >
                          <Users size={11} /> {tag._leadCount}
                          <ExternalLink size={10} className="opacity-50" />
                        </Link>
                      ) : (
                        <span className="text-muted text-xs">0</span>
                      )}
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
