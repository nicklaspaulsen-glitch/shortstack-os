"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Search, Send, Edit3, Trash2, Plus, X, Loader, Eye, Save,
  MessageSquare, CheckCircle2, AlertCircle, Lock, Sparkles,
  BarChart3, Filter, ExternalLink,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import EmptyState from "@/components/ui/empty-state";
import { PresetEditExamplePanel } from "@/components/ui/preset-edit-example-panel";
import toast from "react-hot-toast";
import { TelegramIcon } from "@/components/ui/platform-icons";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Preset {
  id: string;
  user_id: string | null;
  category: string;
  name: string;
  body: string;
  variables: string[];
  active: boolean;
  last_sent_at: string | null;
  sent_count: number;
  error_count: number;
  created_at: string;
  updated_at: string;
}

// Display labels for the 14 categories the seed uses. Order here drives the
// tab ordering. Unknown categories (user-created exotics) fall through to an
// auto-generated "Other" bucket at the end.
const CATEGORY_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  nurture: "Nurture",
  reactivation: "Reactivation",
  "payment-reminder": "Payment",
  "appointment-confirm": "Appt Confirm",
  "appointment-reminder": "Appt Reminder",
  "review-request": "Review",
  "thank-you": "Thank You",
  upsell: "Upsell",
  "feedback-survey": "Feedback",
  "holiday-promo": "Holiday",
  winback: "Winback",
  "referral-ask": "Referral",
  "support-followup": "Support",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtTime(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Health indicator rules:
//   green  → active AND sent_count>0 AND error_count=0 AND (no last_sent OR within 30d)
//   red    → error_count >= 3
//   yellow → error_count between 1-2 OR last_sent_at older than 30d OR never sent
//   gray   → inactive
type Health = "green" | "yellow" | "red" | "gray";
function healthFor(p: Preset): Health {
  if (!p.active) return "gray";
  if (p.error_count >= 3) return "red";

  const over30d = p.last_sent_at
    ? (Date.now() - new Date(p.last_sent_at).getTime()) / 86_400_000 > 30
    : false;

  if (p.error_count > 0 || over30d) return "yellow";
  if (p.sent_count > 0) return "green";
  // Never sent yet — yellow so it stands out in an actively-curated list,
  // because a brand-new preset with no sends is a reasonable "needs attention"
  // signal on the dashboard.
  return "yellow";
}

const HEALTH_CONFIG: Record<Health, { dot: string; ring: string; label: string }> = {
  green: {
    dot: "bg-emerald-400",
    ring: "bg-emerald-400/20",
    label: "Healthy",
  },
  yellow: {
    dot: "bg-amber-400",
    ring: "bg-amber-400/20",
    label: "Needs attention",
  },
  red: {
    dot: "bg-red-400",
    ring: "bg-red-400/20",
    label: "Failing",
  },
  gray: {
    dot: "bg-muted",
    ring: "bg-surface-light",
    label: "Inactive",
  },
};

function extractVars(body: string): string[] {
  const found = new Set<string>();
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(body)) !== null) {
    found.add(m[1]);
  }
  return Array.from(found);
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function TelegramPresetsPage() {
  useAuth();

  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [scope, setScope] = useState<"all" | "mine" | "global">("all");

  // Edit/create modal
  const [editing, setEditing] = useState<Preset | null>(null);
  const [saving, setSaving] = useState(false);

  // Preview modal (for global defaults or just peeking)
  const [previewing, setPreviewing] = useState<Preset | null>(null);

  // Edit example panel
  const [editExample, setEditExample] = useState<Preset | null>(null);

  // Send modal — chat_id + variable inputs
  const [sending, setSending] = useState<Preset | null>(null);
  const [sendChatId, setSendChatId] = useState("");
  const [sendVars, setSendVars] = useState<Record<string, string>>({});
  const [sendLoading, setSendLoading] = useState(false);

  // ─── Data ───────────────────────────────────────────────────────────────

  const loadPresets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (scope !== "all") params.set("scope", scope);
      const res = await fetch(`/api/telegram-presets?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setPresets(data.presets || []);
      } else {
        toast.error(data.error || "Failed to load presets");
      }
    } catch (err) {
      console.error("[telegram-presets] load failed:", err);
      toast.error("Failed to load presets");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  // ─── Derived ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return presets.filter(p => {
      if (activeCategory !== "all" && p.category !== activeCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [presets, activeCategory, search]);

  // Category counts (for tab pills). Built on the currently-loaded scope so
  // switching scope updates the counts.
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: presets.length };
    for (const p of presets) {
      c[p.category] = (c[p.category] ?? 0) + 1;
    }
    return c;
  }, [presets]);

  // Header stats
  const stats = useMemo(() => {
    const total = presets.length;
    const mine = presets.filter(p => p.user_id !== null).length;
    const totalSends = presets.reduce((s, p) => s + (p.sent_count || 0), 0);
    const totalErrors = presets.reduce((s, p) => s + (p.error_count || 0), 0);
    const healthy = presets.filter(p => healthFor(p) === "green").length;
    return { total, mine, totalSends, totalErrors, healthy };
  }, [presets]);

  // Categories that actually appear in results (for the tab bar); use the
  // canonical order, then append any stragglers.
  const categoryTabs = useMemo(() => {
    const seen = new Set(presets.map(p => p.category));
    const ordered = CATEGORY_ORDER.filter(c => seen.has(c));
    const extras = Array.from(seen).filter(c => !CATEGORY_ORDER.includes(c)).sort();
    return [...ordered, ...extras];
  }, [presets]);

  // ─── Handlers ──────────────────────────────────────────────────────────

  function openNew() {
    setEditing({
      id: "",
      user_id: null, // placeholder; server assigns ownerId
      category: activeCategory !== "all" ? activeCategory : "onboarding",
      name: "",
      body: "",
      variables: [],
      active: true,
      last_sent_at: null,
      sent_count: 0,
      error_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  function openEdit(p: Preset) {
    if (p.user_id === null) {
      toast("Global defaults are read-only — duplicating for edit", {
        icon: "✂️",
      });
      // Fork-style: open a new preset pre-filled with this one's body.
      setEditing({
        ...p,
        id: "",
        name: `${p.name} (copy)`,
        user_id: null, // server will fill in from auth
        sent_count: 0,
        error_count: 0,
        last_sent_at: null,
      });
      return;
    }
    setEditing({ ...p });
  }

  async function handleSave() {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("Name required");
      return;
    }
    if (!editing.body.trim()) {
      toast.error("Body required");
      return;
    }
    setSaving(true);
    try {
      const isNew = !editing.id;
      const url = isNew
        ? "/api/telegram-presets"
        : `/api/telegram-presets/${editing.id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: editing.category,
          name: editing.name,
          body: editing.body,
          variables: extractVars(editing.body),
          active: editing.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success(isNew ? "Preset created" : "Preset updated");
      setEditing(null);
      loadPresets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Preset) {
    if (p.user_id === null) {
      toast.error("Global defaults can't be deleted");
      return;
    }
    if (!confirm(`Delete preset "${p.name}"?`)) return;
    try {
      const res = await fetch(`/api/telegram-presets/${p.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      setPresets(prev => prev.filter(x => x.id !== p.id));
      toast.success("Preset deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function openSend(p: Preset) {
    setSending(p);
    setSendChatId("");
    const initial: Record<string, string> = {};
    for (const v of extractVars(p.body)) initial[v] = "";
    setSendVars(initial);
  }

  async function handleSend() {
    if (!sending) return;
    setSendLoading(true);
    try {
      const res = await fetch(`/api/telegram-presets/${sending.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: sendChatId.trim() || undefined,
          variables: sendVars,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      if (data.success) {
        toast.success("Message sent");
        setSending(null);
        loadPresets();
      } else {
        toast.error("Telegram API rejected the message");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSendLoading(false);
    }
  }

  // Live preview text — substitutes live inputs into body for the Send modal.
  const sendPreview = useMemo(() => {
    if (!sending) return "";
    return sending.body.replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (_m, k: string) => sendVars[k] || `{{${k}}}`
    );
  }, [sending, sendVars]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHero
        icon={<TelegramIcon size={28} />}
        title="Telegram Presets"
        subtitle="300 ready-to-send messages across 14 categories. Fork, edit, and send to any chat."
        gradient="blue"
        actions={
          <>
            <span className="text-xs text-white bg-white/10 border border-white/20 px-3 py-1.5 rounded-full">
              {stats.total} total
            </span>
            <span className="text-xs text-white bg-white/10 border border-white/20 px-3 py-1.5 rounded-full">
              {stats.mine} yours
            </span>
            <span className="text-xs text-white bg-white/10 border border-white/20 px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
              <CheckCircle2 size={11} /> {stats.healthy} healthy
            </span>
            <span className="text-xs text-white bg-emerald-500/30 border border-emerald-300/40 px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
              <Send size={11} /> {stats.totalSends} sends
            </span>
            {stats.totalErrors > 0 && (
              <span className="text-xs text-white bg-red-500/30 border border-red-300/40 px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
                <AlertCircle size={11} /> {stats.totalErrors} errors
              </span>
            )}
          </>
        }
      />

      {/* Top controls: search + scope + new */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, body, category..."
            className="w-full bg-surface-light border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40"
          />
        </div>

        <div className="flex items-center gap-1 bg-surface-light border border-border rounded-lg p-1">
          {(["all", "global", "mine"] as const).map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                scope === s
                  ? "bg-gold/10 text-gold border border-gold/20"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : s === "global" ? "Library" : "Mine"}
            </button>
          ))}
        </div>

        <button
          onClick={openNew}
          className="px-4 py-2 bg-gold text-black rounded-lg text-sm font-semibold hover:bg-gold/90 transition-all flex items-center gap-2"
        >
          <Plus size={14} /> New Preset
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 bg-surface-light border border-border rounded-xl p-1 overflow-x-auto">
        <button
          onClick={() => setActiveCategory("all")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
            activeCategory === "all"
              ? "bg-gold/10 text-gold border border-gold/20"
              : "text-muted hover:text-foreground hover:bg-surface"
          }`}
        >
          <Filter size={12} /> All
          <span className="text-[10px] text-muted bg-surface px-1.5 py-0.5 rounded">
            {counts.all ?? 0}
          </span>
        </button>
        {categoryTabs.map(c => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeCategory === c
                ? "bg-gold/10 text-gold border border-gold/20"
                : "text-muted hover:text-foreground hover:bg-surface"
            }`}
          >
            {CATEGORY_LABELS[c] ?? c}
            <span className="text-[10px] text-muted bg-surface px-1.5 py-0.5 rounded">
              {counts[c] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="card flex items-center justify-center py-12">
          <Loader size={18} className="animate-spin text-gold" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<MessageSquare size={48} />}
            title={search ? "No presets match your search" : "No presets in this view"}
            description={
              search
                ? "Try clearing the search or switching category."
                : "Create your first custom preset or switch scope to see the library."
            }
            action={
              <button
                onClick={openNew}
                className="px-4 py-2 bg-gold text-black rounded-lg text-sm font-semibold hover:bg-gold/90 flex items-center gap-2"
              >
                <Plus size={14} /> New Preset
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const health = healthFor(p);
            const cfg = HEALTH_CONFIG[health];
            const isGlobal = p.user_id === null;
            return (
              <div
                key={p.id}
                className="card !p-4 flex items-start gap-4 flex-wrap md:flex-nowrap"
              >
                {/* Health dot */}
                <div className="relative flex-shrink-0 mt-1.5" title={cfg.label}>
                  <div
                    className={`absolute inset-0 rounded-full ${cfg.ring} animate-pulse`}
                  />
                  <div className={`relative w-3 h-3 rounded-full ${cfg.dot}`} />
                </div>

                {/* Name + body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">
                      {p.name}
                    </p>
                    <span className="text-[10px] uppercase tracking-wider text-muted bg-surface-light border border-border rounded px-1.5 py-0.5">
                      {CATEGORY_LABELS[p.category] ?? p.category}
                    </span>
                    {isGlobal && (
                      <span
                        className="text-[10px] uppercase tracking-wider text-gold bg-gold/10 border border-gold/20 rounded px-1.5 py-0.5 inline-flex items-center gap-1"
                        title="Global default — read-only. Duplicate to edit."
                      >
                        <Lock size={9} /> Library
                      </span>
                    )}
                    {!p.active && (
                      <span className="text-[10px] uppercase tracking-wider text-muted bg-surface-light border border-border rounded px-1.5 py-0.5">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-1 line-clamp-2">
                    {p.body}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted flex-wrap">
                    <span>Last sent: {fmtTime(p.last_sent_at)}</span>
                    {p.sent_count > 0 && (
                      <span className="text-emerald-400 inline-flex items-center gap-1">
                        <Send size={10} /> {p.sent_count}
                      </span>
                    )}
                    {p.error_count > 0 && (
                      <span className="text-red-400 inline-flex items-center gap-1">
                        <AlertCircle size={10} /> {p.error_count}
                      </span>
                    )}
                    {p.variables && p.variables.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Sparkles size={10} /> {p.variables.length} vars
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openSend(p)}
                    title="Send"
                    className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                  >
                    <Send size={14} />
                  </button>
                  <button
                    onClick={() => setPreviewing(p)}
                    title="Preview"
                    className="p-2 rounded-lg bg-surface-light border border-border text-muted hover:text-foreground hover:border-gold/20 transition-colors"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => setEditExample(p)}
                    title="Edit example"
                    className="p-2 rounded-lg bg-surface-light border border-border text-muted hover:text-gold hover:border-gold/20 transition-colors"
                  >
                    <ExternalLink size={14} />
                  </button>
                  <button
                    onClick={() => openEdit(p)}
                    title={isGlobal ? "Duplicate" : "Edit"}
                    className="p-2 rounded-lg bg-surface-light border border-border text-muted hover:text-foreground hover:border-gold/20 transition-colors"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    title={isGlobal ? "Library preset — read-only" : "Delete"}
                    disabled={isGlobal}
                    className={`p-2 rounded-lg border transition-colors ${
                      isGlobal
                        ? "bg-surface-light border-border text-muted/40 cursor-not-allowed"
                        : "bg-surface-light border-border text-muted hover:text-red-400 hover:border-red-400/20"
                    }`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════ EDIT / CREATE MODAL ═══════════ */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-surface border border-border rounded-xl p-6 w-full max-w-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                {editing.id ? "Edit preset" : "New preset"}
              </h2>
              <button
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg hover:bg-surface-light text-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted mb-1 block">Category</label>
                  <select
                    value={editing.category}
                    onChange={e =>
                      setEditing({ ...editing, category: e.target.value })
                    }
                    className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold/40"
                  >
                    {CATEGORY_ORDER.map(c => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Name</label>
                  <input
                    value={editing.name}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                    placeholder="e.g. Welcome kickoff"
                    className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted mb-1 block">
                  Body{" "}
                  <span className="text-muted/70">
                    — use {"{{variable}}"} for tokens
                  </span>
                </label>
                <textarea
                  value={editing.body}
                  onChange={e => setEditing({ ...editing, body: e.target.value })}
                  rows={6}
                  placeholder="Hi {{first_name}}, your onboarding call is set for {{meeting_time}}."
                  className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40 font-mono"
                />
                {extractVars(editing.body).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {extractVars(editing.body).map(v => (
                      <span
                        key={v}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/20"
                      >
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={e =>
                    setEditing({ ...editing, active: e.target.checked })
                  }
                  className="rounded border-border"
                />
                Active — can be sent
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 bg-surface-light border border-border rounded-lg text-sm text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-gold text-black rounded-lg text-sm font-semibold hover:bg-gold/90 disabled:opacity-60 flex items-center gap-2"
              >
                {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                {editing.id ? "Save changes" : "Create preset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ PREVIEW MODAL ═══════════ */}
      {previewing && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewing(null)}
        >
          <div
            className="bg-surface border border-border rounded-xl p-6 w-full max-w-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">{previewing.name}</h2>
              <button
                onClick={() => setPreviewing(null)}
                className="p-1.5 rounded-lg hover:bg-surface-light text-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-muted bg-surface-light border border-border rounded px-1.5 py-0.5">
                {CATEGORY_LABELS[previewing.category] ?? previewing.category}
              </span>
              {previewing.user_id === null && (
                <span className="text-[10px] uppercase tracking-wider text-gold bg-gold/10 border border-gold/20 rounded px-1.5 py-0.5 inline-flex items-center gap-1">
                  <Lock size={9} /> Library
                </span>
              )}
            </div>
            <div className="rounded-lg border border-border bg-surface-light p-4 whitespace-pre-wrap text-sm text-foreground leading-relaxed">
              {previewing.body}
            </div>
            {previewing.variables && previewing.variables.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted mb-1.5">Variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {previewing.variables.map(v => (
                    <span
                      key={v}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/20"
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
              <div className="rounded-lg border border-border bg-surface-light p-3">
                <p className="text-muted">Sends</p>
                <p className="text-lg font-semibold text-foreground">
                  {previewing.sent_count}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface-light p-3">
                <p className="text-muted">Errors</p>
                <p className="text-lg font-semibold text-foreground">
                  {previewing.error_count}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setPreviewing(null)}
                className="px-4 py-2 bg-surface-light border border-border rounded-lg text-sm text-muted hover:text-foreground"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const p = previewing;
                  setPreviewing(null);
                  openSend(p);
                }}
                className="px-4 py-2 bg-gold text-black rounded-lg text-sm font-semibold hover:bg-gold/90 flex items-center gap-2"
              >
                <Send size={14} /> Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ EDIT EXAMPLE PANEL ═══════════ */}
      {editExample && (
        <PresetEditExamplePanel
          kind="telegram"
          preset={{
            id: editExample.id,
            name: editExample.name,
            category: editExample.category,
            body: editExample.body,
            variables: editExample.variables || [],
          }}
          onClose={() => setEditExample(null)}
        />
      )}

      {/* ═══════════ SEND MODAL ═══════════ */}
      {sending && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSending(null)}
        >
          <div
            className="bg-surface border border-border rounded-xl p-6 w-full max-w-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">
                Send: {sending.name}
              </h2>
              <button
                onClick={() => setSending(null)}
                className="p-1.5 rounded-lg hover:bg-surface-light text-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted mb-1 block">
                  Chat ID{" "}
                  <span className="text-muted/70">
                    (leave blank to use TELEGRAM_CHAT_ID env)
                  </span>
                </label>
                <input
                  value={sendChatId}
                  onChange={e => setSendChatId(e.target.value)}
                  placeholder="e.g. 123456789 or @username"
                  className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40 font-mono"
                />
              </div>

              {Object.keys(sendVars).length > 0 && (
                <div>
                  <p className="text-xs text-muted mb-1.5">Variable values</p>
                  <div className="space-y-2">
                    {Object.keys(sendVars).map(v => (
                      <div key={v} className="flex items-center gap-2">
                        <span className="text-xs text-gold font-mono bg-gold/10 border border-gold/20 rounded px-2 py-1 min-w-[120px] text-center">
                          {`{{${v}}}`}
                        </span>
                        <input
                          value={sendVars[v]}
                          onChange={e =>
                            setSendVars(prev => ({ ...prev, [v]: e.target.value }))
                          }
                          placeholder={v}
                          className="flex-1 bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-muted mb-1.5 flex items-center gap-1.5">
                  <BarChart3 size={11} /> Preview
                </p>
                <div className="rounded-lg border border-border bg-surface-light p-4 whitespace-pre-wrap text-sm text-foreground leading-relaxed min-h-[80px]">
                  {sendPreview}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setSending(null)}
                className="px-4 py-2 bg-surface-light border border-border rounded-lg text-sm text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sendLoading}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-500/90 disabled:opacity-60 flex items-center gap-2"
              >
                {sendLoading ? (
                  <Loader size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Send now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
