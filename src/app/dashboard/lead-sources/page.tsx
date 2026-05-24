import { Check, CircleNotch, Funnel, Pencil, Plus, Trash, X } from "@phosphor-icons/react";
﻿"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { TableSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { MotionPage } from "@/components/motion/motion-page";

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
    <motion.div className="glass rounded-xl p-5 space-y-4 spotlight-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4, scale: 1.01 }} onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`); e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`); }}>
      <p className="text-sm font-semibold text-text-primary">Leads by Source</p>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div
          className="rounded-full shrink-0"
          style={{ width: 140, height: 140, background: `conic-gradient(${gradient})` }}
        />
        <div className="space-y-2 flex-1 min-w-0">
          {segments.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span className="inline-block rounded-full w-3 h-3 shrink-0" style={{ background: s.color }} />
              <span className="text-text-secondary truncate max-w-[140px]">{s.label}</span>
              <span className="text-text-muted ml-auto shrink-0">{s.value} ({s.pct.toFixed(0)}%)</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

const SLICE_COLORS = [
  "#D4FF00","#D4FF00","#f59e0b","#8b5cf6","#ef4444",
  "#FF5252","#84cc16","#ec4899","#f97316","#6b7280",
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
    <MotionPage className="space-y-6">{/* -- Lead Sources command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">SOURCE TRACKING</p>
        <h1 className="text-2xl font-display font-bold text-text-primary">Lead Sources</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => setShowCreate((v) => !v)}
                  className="btn-primary flex items-center gap-2 text-sm px-3 py-2 rounded-lg">
                  <Plus size={16} /> Add Source
                </button>
      </div>
    </div>{pieSlices.length > 0 && <PieChart slices={pieSlices} />}{showCreate && (
              <motion.div className="glass rounded-xl p-5 space-y-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <p className="font-semibold text-text-primary text-sm">New Source</p>
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
                  <span className="text-xs text-text-muted">Icon:</span>
                  {ICON_OPTIONS.map((ic) => (
                    <button key={ic} type="button" onClick={() => setForm({ ...form, icon: ic })}
                      className={`text-lg p-1 rounded ${form.icon === ic ? "bg-[rgba(212,255,0,0.14)]" : "hover:bg-white/5"}`}>{ic}</button>
                  ))}
                </div>
                <input className="input w-full text-sm" placeholder="Description (optional)"
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <div className="flex gap-2">
                  <button onClick={handleCreate} disabled={saving || !form.source_name.trim()}
                    className="btn-primary flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">
                    {saving ? <CircleNotch size={13} className="animate-spin" /> : <Check size={13} />} Save
                  </button>
                  <button onClick={() => setShowCreate(false)}
                    className="btn-ghost flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg">
                    <X size={13} /> Cancel
                  </button>
                </div>
              </motion.div>
            )}{loading ? <TableSkeleton rows={5} /> : sources.length === 0 ? (
              <motion.div className="glass rounded-xl p-12 flex flex-col items-center gap-4 text-center" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <Funnel size={40} className="text-text-muted" />
                <p className="text-text-primary font-semibold">No lead sources yet</p>
                <p className="text-text-muted text-sm max-w-xs">Add your first source to start tracking where leads originate.</p>
                <button onClick={() => setShowCreate(true)}
                  className="btn-primary flex items-center gap-2 text-sm px-4 py-2 rounded-lg mt-1">
                  <Plus size={15} /> Add first source
                </button>
              </motion.div>
            ) : (
              <motion.div className="glass rounded-xl overflow-hidden" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted text-xs">
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
                        <tr key={s.id} className="bg-[rgba(212,255,0,0.04)]">
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
                                className="p-1.5 rounded hover:bg-green-500/10 text-green-400">
                                {saving ? <CircleNotch size={13} className="animate-spin" /> : <Check size={13} />}
                              </button>
                              <button onClick={() => setEditId(null)} className="p-1.5 rounded hover:bg-white/5 text-text-muted">
                                <X size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={s.id} className="hover:bg-white/4 transition-colors group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{s.icon ?? "🔍"}</span>
                              <span className="text-text-primary font-medium">{s.source_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-text-muted hidden sm:table-cell text-xs">
                            {(s.attribution_model ?? "last_touch").replace("_", " ")}
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary hidden md:table-cell">{s.total_leads_attributed}</td>
                          <td className="px-4 py-3 text-right text-text-muted hidden md:table-cell">{s.total_revenue_cents ? fmt(s.total_revenue_cents) : "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEdit(s)} className="p-1.5 rounded hover:bg-white/5 text-text-muted hover:text-text-primary">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id}
                                className="p-1.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400">
                                {deleting === s.id ? <CircleNotch size={13} className="animate-spin" /> : <Trash size={13} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
                </div>
              </motion.div>
            )}</MotionPage>
  );
}
