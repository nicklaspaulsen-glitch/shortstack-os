"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import { SlidersHorizontal, Save, Eye, Check, AlertCircle } from "lucide-react";

interface ConfigRow {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

type ConfigVal = boolean | number | string | Record<string, unknown>;

function parseValue(v: unknown): ConfigVal {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null) return v as Record<string, unknown>;
  return String(v);
}

function inferType(v: unknown): "boolean" | "number" | "json" | "string" {
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  if (typeof v === "object" && v !== null) return "json";
  return "string";
}

export default function AgentControlsPage() {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [edits, setEdits] = useState<Record<string, ConfigVal>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("system_config")
      .select("id, key, value, description, updated_at")
      .order("key");
    const r = (data as ConfigRow[]) ?? [];
    setRows(r);
    setEdits(Object.fromEntries(r.map(row => [row.key, parseValue(row.value)])));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const changed = rows.filter(row => {
    const orig = parseValue(row.value);
    const cur = edits[row.key];
    return JSON.stringify(orig) !== JSON.stringify(cur);
  });

  const handleSave = async () => {
    if (changed.length === 0) return;
    setSaving(true);
    setError(null);
    for (const row of changed) {
      const newVal = edits[row.key];
      const { error: err } = await supabase
        .from("system_config")
        .update({ value: newVal, updated_at: new Date().toISOString() })
        .eq("key", row.key);
      if (err) { setError(err.message); }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setShowDiff(false);
    load();
  };

  const updateEdit = (key: string, val: ConfigVal) => {
    setEdits(e => ({ ...e, [key]: val }));
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      <PageHero
        title="Agent Controls"
        subtitle="Key/value configuration for agent behaviour — toggle, tune, save."
        icon={<SlidersHorizontal className="w-6 h-6" />}
        gradient="purple"
        actions={
          <div className="flex items-center gap-2">
            {changed.length > 0 && (
              <button
                onClick={() => setShowDiff(d => !d)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm transition-colors border border-white/15"
              >
                <Eye className="w-4 h-4" />
                Diff ({changed.length})
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || changed.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
            </button>
          </div>
        }
      />

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Diff panel */}
      {showDiff && changed.length > 0 && (
        <div className="card-premium p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white mb-2">Pending changes</h3>
          {changed.map(row => (
            <div key={row.key} className="text-xs font-mono space-y-1">
              <div className="text-muted">{row.key}</div>
              <div className="text-red-400 bg-red-500/10 px-2 py-1 rounded">− {JSON.stringify(parseValue(row.value))}</div>
              <div className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">+ {JSON.stringify(edits[row.key])}</div>
            </div>
          ))}
        </div>
      )}

      {/* Config rows */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card-premium p-5 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/4 mb-2" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card-premium p-10 text-center text-muted">
          <SlidersHorizontal className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No config rows found in system_config.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => {
            const type = inferType(parseValue(row.value));
            const cur = edits[row.key];
            const isDirty = JSON.stringify(parseValue(row.value)) !== JSON.stringify(cur);

            return (
              <div key={row.key} className={`card-premium p-5 transition-all ${isDirty ? "ring-1 ring-purple-500/40" : ""}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white font-mono">{row.key}</span>
                      {isDirty && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          modified
                        </span>
                      )}
                    </div>
                    {row.description && <p className="text-xs text-muted mt-0.5">{row.description}</p>}
                    <p className="text-[10px] text-muted/50 mt-1">Updated {new Date(row.updated_at).toLocaleString()}</p>
                  </div>

                  <div className="shrink-0">
                    {type === "boolean" && (
                      <button
                        onClick={() => updateEdit(row.key, !(cur as boolean))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cur ? "bg-purple-600" : "bg-white/20"}`}
                        role="switch"
                        aria-checked={!!cur}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cur ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    )}
                    {type === "number" && (
                      <input
                        type="number"
                        value={cur as number}
                        onChange={e => updateEdit(row.key, parseFloat(e.target.value) || 0)}
                        className="w-28 px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white text-sm text-right focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                      />
                    )}
                    {type === "json" && (
                      <textarea
                        defaultValue={JSON.stringify(cur, null, 2)}
                        onChange={e => {
                          try { updateEdit(row.key, JSON.parse(e.target.value)); } catch { /* keep typing */ }
                        }}
                        rows={3}
                        className="w-64 px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none"
                      />
                    )}
                    {type === "string" && (
                      <input
                        type="text"
                        value={cur as string}
                        onChange={e => updateEdit(row.key, e.target.value)}
                        className="w-48 px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
