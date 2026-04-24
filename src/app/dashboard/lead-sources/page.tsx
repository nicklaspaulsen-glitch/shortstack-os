"use client";

import { useState, useEffect, useCallback } from "react";
import { Filter, Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import { TableSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface LeadSource {
  id: string;
  source_name: string;
  icon: string | null;
  attribution_model: string | null;
  description: string | null;
  total_leads_attributed: number;
  total_revenue_cents: number;
}

const ATTRIBUTION_MODELS = ["last_touch", "first_touch", "linear", "time_decay"];

const ICON_OPTIONS = ["🔍","📢","🤝","📧","📱","🌐","📰","🎯","💬","📺","🎙️","🏷️"];

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** Pure-CSS pie slice chart — no chart lib */
function PieChart({ slices }: { slices: { id: string; label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return null;

  let offset = 0;
  const segments = slices.map((sl) => {
    const pct = (sl.value / total) * 100;
    const seg = { id: sl.id, label: sl.label, value: sl.value, color: sl.color, pct, offset };
    offset += pct;
    return seg;
  });

  // Build conic-gradient string
  const gradient = segments
    .map((s) => `${s.color} ${s.offset.toFixed(1)}% ${(s.offset + s.pct).toFixed(1)}%`)
    .join(", ");

  return (
    <div className="card p-5 space-y-4">
      <p className="text-sm font-semibold text-white">Leads by Source</p>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div
          className="rounded-full shrink-0"
          style={{ width: 140, height: 140, background: `conic-gradient(${gradient})` }}
        />
        <div className="space-y-2 flex-1 min-w-0">
          {segments.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span className="inline-block rounded-full w-3 h-3 shrink-0" style={{ background: s.color }} />
              <span className="text-white truncate max-w-[140px]">{s.label}</span>
              <span className="text-muted ml-auto shrink-0">{s.value} ({s.pct.toFixed(0)}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SLICE_COLORS = [
  "#3b82f6","#10b981","#f59e0b","#8b5cf6","#ef4444",
  "#06b6d4","#84cc16","#ec4899","#f97316","#6b7280",
];

export default function LeadSourcesPage() {
  const supabase = createClient();
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ source_name: "", icon: "🔍", attribution_model: "last_touch", description: "" });

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ source_name: "", icon: "", attribution_model: "", description: "" });

  const fetchSources = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_sources")
      .select("id, source_name, icon, attribution_model, description, total_leads_attributed, total_revenue_cents")
      .order("total_leads_attributed", { ascending: false });
    setLoading(false);
    if (error) { toast.error("Failed to load sources"); return; }
    setSources(data ?? []);
  }, [supabase]);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  async function handleCreate() {
    if (!form.source_name.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setSaving(false); return; }
    const { error } = await supabase.from("lead_sources").insert({
      source_name: form.source_name.trim(),
      icon: form.icon,
      attribution_model: form.attribution_model,
      description: form.description.trim() || null,
      user_id: user.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Source created");
    setForm({ source_name: "", icon: "🔍", attribution_model: "last_touch", description: "" });
    setShowCreate(false);
    fetchSources();
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    const { error } = await supabase.from("lead_sources").update({
      source_name: editForm.source_name.trim(),
      icon: editForm.icon,
      attribution_model: editForm.attribution_model,
      description: editForm.description.trim() || null,
    }).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Source updated"); setEditId(null); fetchSources();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this lead source?")) return;
    setDeleting(id);
    const { error } = await supabase.from("lead_sources").delete().eq("id", id);
    setDeleting(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Source deleted");
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  function startEdit(s: LeadSource) {
    setEditId(s.id);
    setEditForm({ source_name: s.source_name, icon: s.icon ?? "🔍", attribution_model: s.attribution_model ?? "last_touch", description: s.description ?? "" });
  }

  const pieSlices = sources
    .filter((s) => s.total_leads_attributed > 0)
    .map((s, i) => ({ id: s.id, label: s.source_name, value: s.total_leads_attributed, color: SLICE_COLORS[i % SLICE_COLORS.length] }));

  return (
    <div className="space-y-6">
      <PageHero
        title="Lead Sources"
        subtitle="Track where every lead comes from and what each source is worth."
        icon={<Filter size={22} />}
        gradient="green"
        actions={
          <button onClick={() => setShowCreate((v) => !v)}
            className="btn-primary flex items-center gap-2 text-sm px-3 py-2 rounded-lg">
            <Plus size={16} /> Add Source
          </button>
        }
      />

      {pieSlices.length > 0 && <PieChart slices={pieSlices} />}

      {showCreate && (
        <div className="card p-5 space-y-4 border border-white/10">
          <p className="font-semibold text-white text-sm">New Source</p>
          <div className="flex flex-wrap gap-3">
            <input className="input flex-1 min-w-[160px] text-sm" placeholder="Source name (e.g. Google Ads)"
              value={form.source_name} onChange={(e) => setForm({ ...form, source_name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus />
            <select className="input w-40 text-sm" value={form.attribution_model}
              onChange={(e) => setForm({ ...form, attribution_model: e.target.value })}>
              {ATTRIBUTION_MODELS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted">Icon:</span>
            {ICON_OPTIONS.map((ic) => (
              <button key={ic} type="button" onClick={() => setForm({ ...form, icon: ic })}
                className={`text-lg p-1 rounded ${form.icon === ic ? "bg-white/20" : "hover:bg-white/10"}`}>{ic}</button>
            ))}
          </div>
          <input className="input w-full text-sm" placeholder="Description (optional)"
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !form.source_name.trim()}
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

      {loading ? <TableSkeleton rows={5} /> : sources.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-4 text-center">
          <Filter size={40} className="text-muted opacity-30" />
          <p className="text-white font-semibold">No lead sources yet</p>
          <p className="text-muted text-sm max-w-xs">Add your first source to start tracking where leads originate.</p>
          <button onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2 rounded-lg mt-1">
            <Plus size={15} /> Add first source
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-muted text-xs">
                <th className="text-left px-4 py-3 font-medium">Source</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Attribution</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Leads</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Revenue</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sources.map((s) =>
                editId === s.id ? (
                  <tr key={s.id} className="bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select className="input text-sm h-8 w-12 px-1"
                          value={editForm.icon} onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}>
                          {ICON_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                        </select>
                        <input className="input text-sm h-8 flex-1" value={editForm.source_name}
                          onChange={(e) => setEditForm({ ...editForm, source_name: e.target.value })} autoFocus />
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <select className="input text-sm h-8 w-32"
                        value={editForm.attribution_model}
                        onChange={(e) => setEditForm({ ...editForm, attribution_model: e.target.value })}>
                        {ATTRIBUTION_MODELS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell" />
                    <td className="px-4 py-3 hidden md:table-cell" />
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleUpdate(s.id)} disabled={saving}
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
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{s.icon ?? "🔍"}</span>
                        <span className="text-white font-medium">{s.source_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted hidden sm:table-cell text-xs">
                      {(s.attribution_model ?? "last_touch").replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-right text-white hidden md:table-cell">{s.total_leads_attributed}</td>
                    <td className="px-4 py-3 text-right text-muted hidden md:table-cell">{s.total_revenue_cents ? fmt(s.total_revenue_cents) : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(s)} className="p-1.5 rounded hover:bg-white/10 text-muted hover:text-white">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id}
                          className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400">
                          {deleting === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
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
