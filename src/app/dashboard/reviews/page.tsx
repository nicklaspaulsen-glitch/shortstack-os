"use client";

/**
 * Reviews — two tabs:
 *  1. Review Manager  — log & respond to incoming reviews (localStorage MVP)
 *  2. Review Requests — auto-send review links after appointments complete
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Star,
  Plus,
  Trash2,
  ArrowLeft,
  MessageSquare,
  Loader,
  ExternalLink,
  CheckCircle2,
  Send,
  Clock,
  Settings2,
  History,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import EmptyState from "@/components/ui/empty-state";

/* ─────────────────────────────────────────────────────────────── */
/* Types                                                            */
/* ─────────────────────────────────────────────────────────────── */

interface Review {
  id: string;
  author: string;
  source: string;
  rating: number;
  body: string;
  reply: string;
  status: "new" | "replied" | "resolved";
  created_at: string;
}

interface ReviewConfig {
  id: string;
  client_id: string | null;
  trigger_type: string;
  delay_minutes: number;
  platform: string;
  review_url: string;
  message_template: string;
  channel: string;
  enabled: boolean;
  created_at: string;
}

interface HistoryRow {
  id: string;
  event_id: string | null;
  client_id: string | null;
  sent_at: string;
  channel: string;
  status: string;
  config?: { platform: string; review_url: string } | null;
}

interface Client {
  id: string;
  contact_name: string;
  business_name: string;
}

const STORAGE_KEY = "ss_reviews_v1";
const SOURCES = ["Google", "Yelp", "Trustpilot", "Facebook", "G2", "Other"];

const STATUS_STYLES: Record<Review["status"], { label: string; tint: string }> = {
  new: { label: "New", tint: "bg-amber-500/15 text-amber-300" },
  replied: { label: "Replied", tint: "bg-sky-500/15 text-sky-300" },
  resolved: { label: "Resolved", tint: "bg-emerald-500/15 text-emerald-300" },
};

const DEFAULT_TEMPLATE =
  "Hi {{first_name}}, thanks for your visit! We'd love a review: {{review_url}}";

/* ─────────────────────────────────────────────────────────────── */
/* Stars                                                            */
/* ─────────────────────────────────────────────────────────────── */

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={12}
          className={n <= rating ? "fill-amber-400 text-amber-400" : "text-muted/40"}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Page root                                                        */
/* ─────────────────────────────────────────────────────────────── */

export default function ReviewsPage() {
  useAuth();
  const [tab, setTab] = useState<"manager" | "requests">("manager");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHero
        title="Reviews"
        subtitle="Manage incoming reviews and auto-send review links after appointments."
        icon={<Star size={20} />}
        gradient="sunset"
      />

      {/* Tab bar */}
      <div className="mx-auto max-w-5xl px-6 pt-5">
        <div className="flex gap-1 border-b border-border/40 mb-6">
          <button
            onClick={() => setTab("manager")}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
              tab === "manager"
                ? "border-gold text-gold"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            Review Manager
          </button>
          <button
            onClick={() => setTab("requests")}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-1.5 ${
              tab === "requests"
                ? "border-gold text-gold"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Send size={13} />
            Review Requests
          </button>
        </div>
      </div>

      {tab === "manager" ? <ReviewManager /> : <ReviewRequests />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Tab 1 — Review Manager (original localStorage page)             */
/* ─────────────────────────────────────────────────────────────── */

function ReviewManager() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<"all" | Review["status"]>("all");

  const load = useCallback(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      setReviews(raw ? (JSON.parse(raw) as Review[]) : []);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = (next: Review[]) => {
    setReviews(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
  };

  function remove(id: string) {
    if (!window.confirm("Delete this review entry?")) return;
    persist(reviews.filter((r) => r.id !== id));
    toast.success("Review deleted");
  }

  function reply(id: string, text: string) {
    persist(reviews.map((r) => r.id === id ? { ...r, reply: text, status: "replied" as const } : r));
    toast.success("Reply saved");
  }

  function resolve(id: string) {
    persist(reviews.map((r) => r.id === id ? { ...r, status: "resolved" as const } : r));
    toast.success("Marked resolved");
  }

  const filtered = useMemo(
    () => (filter === "all" ? reviews : reviews.filter((r) => r.status === filter)),
    [reviews, filter],
  );

  const stats = useMemo(() => {
    const count = reviews.length;
    const avg = count === 0 ? 0 : Math.round((reviews.reduce((a, r) => a + r.rating, 0) / count) * 10) / 10;
    const unreplied = reviews.filter((r) => r.status === "new").length;
    const critical = reviews.filter((r) => r.rating <= 2).length;
    return { count, avg, unreplied, critical };
  }, [reviews]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 pb-10">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-200">
        <span className="font-semibold">Beta:</span> reviews are logged locally on this device.
        Google Business Profile + Trustpilot auto-import lands next sprint.
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card"><p className="text-[10px] uppercase tracking-wider text-muted">Total</p><p className="mt-1 text-2xl font-bold">{stats.count}</p></div>
        <div className="card"><p className="text-[10px] uppercase tracking-wider text-muted">Avg rating</p><div className="mt-1 flex items-center gap-1.5"><span className="text-2xl font-bold">{stats.avg || "—"}</span>{stats.avg > 0 && <Stars rating={Math.round(stats.avg)} />}</div></div>
        <div className="card"><p className="text-[10px] uppercase tracking-wider text-muted">Unreplied</p><p className="mt-1 text-2xl font-bold text-amber-300">{stats.unreplied}</p></div>
        <div className="card"><p className="text-[10px] uppercase tracking-wider text-muted">1–2 star</p><p className="mt-1 text-2xl font-bold text-rose-300">{stats.critical}</p></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {(["all", "new", "replied", "resolved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                filter === f ? "bg-gold/20 text-gold" : "bg-surface-light/40 text-muted hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold/90"
        >
          <Plus size={14} /> Log review
        </button>
      </div>

      {showNew && (
        <NewReviewForm
          onClose={() => setShowNew(false)}
          onCreated={(r) => { persist([r, ...reviews]); setShowNew(false); toast.success("Review logged"); }}
        />
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted"><Loader size={14} className="animate-spin" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Star size={36} />}
            title={reviews.length === 0 ? "No reviews yet" : "No reviews match this filter"}
            description={reviews.length === 0 ? "Log a review manually to track responses." : "Try a different filter, or log a new review."}
            action={reviews.length === 0 ? <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black"><Plus size={14} /> Log review</button> : null}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <ReviewCard key={r.id} review={r} onDelete={() => remove(r.id)} onReply={(text) => reply(r.id, text)} onResolve={() => resolve(r.id)} />
          ))}
        </div>
      )}

      <div className="mt-8 rounded-xl border border-border/40 bg-background/40 p-5 text-[12px] text-muted">
        <p className="mb-2 font-semibold text-foreground">Coming soon</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Auto-import from Google Business Profile, Yelp, Trustpilot, G2</li>
          <li>AI-drafted replies tuned to your brand voice</li>
          <li>Auto-route 1–2 star reviews to a human immediately</li>
          <li><Link href="/dashboard/google-business" className="text-gold underline">Google Business</Link> {" · "} <Link href="/dashboard/tickets" className="text-gold underline">Tickets</Link></li>
        </ul>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Tab 2 — Review Requests                                         */
/* ─────────────────────────────────────────────────────────────── */

function ReviewRequests() {
  const [subTab, setSubTab] = useState<"config" | "history">("config");
  const [configs, setConfigs] = useState<ReviewConfig[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ReviewConfig | null>(null);
  const [manualClientId, setManualClientId] = useState("");
  const [manualConfigId, setManualConfigId] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, histRes, clientRes] = await Promise.all([
        fetch("/api/review-requests/config"),
        fetch("/api/review-requests/history"),
        fetch("/api/clients"),
      ]);
      if (cfgRes.ok) { const d = await cfgRes.json(); setConfigs(d.configs ?? []); }
      if (histRes.ok) { const d = await histRes.json(); setHistory(d.history ?? []); }
      if (clientRes.ok) { const d = await clientRes.json(); setClients(d.clients ?? []); }
    } catch { /* network */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleEnabled(cfg: ReviewConfig) {
    const res = await fetch("/api/review-requests/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cfg, enabled: !cfg.enabled }),
    });
    if (res.ok) { toast.success(cfg.enabled ? "Config disabled" : "Config enabled"); load(); }
    else toast.error("Failed to update");
  }

  async function deleteConfig(id: string) {
    if (!window.confirm("Delete this review request config?")) return;
    const res = await fetch(`/api/review-requests/config/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); load(); }
    else toast.error("Failed to delete");
  }

  async function sendManual() {
    if (!manualConfigId || !manualClientId) {
      toast.error("Select both a config and a client");
      return;
    }
    setSending(true);
    const res = await fetch("/api/review-requests/send-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config_id: manualConfigId, client_id: manualClientId }),
    });
    setSending(false);
    if (res.ok) { toast.success("Review request sent!"); load(); }
    else { const d = await res.json().catch(() => ({})); toast.error((d as { error?: string }).error || "Failed to send"); }
  }

  const PLATFORM_LABELS: Record<string, string> = { google: "Google", yelp: "Yelp", custom: "Custom" };
  const CHANNEL_LABELS: Record<string, string> = { sms: "SMS", email: "Email", whatsapp: "WhatsApp" };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 pb-10">
      {/* Sub-tab bar */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab("config")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${subTab === "config" ? "bg-gold/20 text-gold" : "bg-surface-light/40 text-muted hover:text-foreground"}`}
        >
          <Settings2 size={12} /> Configs
        </button>
        <button
          onClick={() => setSubTab("history")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${subTab === "history" ? "bg-gold/20 text-gold" : "bg-surface-light/40 text-muted hover:text-foreground"}`}
        >
          <History size={12} /> Sent History
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted"><Loader size={14} className="animate-spin" /> Loading…</div>
      ) : subTab === "config" ? (
        <>
          {/* Config list */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              Auto-send review links after appointments complete. Runs every 15 minutes via cron.
            </p>
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-gold/90"
            >
              <Plus size={14} /> New config
            </button>
          </div>

          {showForm && (
            <ConfigForm
              initial={editing}
              onClose={() => { setShowForm(false); setEditing(null); }}
              onSaved={() => { setShowForm(false); setEditing(null); load(); }}
            />
          )}

          {configs.length === 0 && !showForm ? (
            <div className="card">
              <EmptyState
                icon={<Send size={36} />}
                title="No review request configs"
                description="Create a config to automatically text or email clients a review link after their appointment ends."
                action={
                  <button
                    onClick={() => { setEditing(null); setShowForm(true); }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black"
                  >
                    <Plus size={14} /> New config
                  </button>
                }
              />
            </div>
          ) : (
            <div className="space-y-2">
              {configs.map((cfg) => (
                <div key={cfg.id} className="rounded-lg border border-border/50 bg-surface-light/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cfg.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-surface-light/60 text-muted"}`}>
                      <Send size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{PLATFORM_LABELS[cfg.platform] || cfg.platform}</span>
                        <span className="rounded bg-background/60 px-1.5 py-0.5 text-[10px] text-muted">{CHANNEL_LABELS[cfg.channel] || cfg.channel}</span>
                        <span className="rounded bg-background/60 px-1.5 py-0.5 text-[10px] text-muted flex items-center gap-1"><Clock size={9} /> {cfg.delay_minutes}m delay</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-muted/10 text-muted"}`}>
                          {cfg.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted truncate">{cfg.review_url}</p>
                      <p className="mt-0.5 text-[11px] text-muted/60 truncate">{cfg.message_template}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <button
                        onClick={() => toggleEnabled(cfg)}
                        className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${cfg.enabled ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25" : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"}`}
                      >
                        {cfg.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => { setEditing(cfg); setShowForm(true); }}
                        className="rounded bg-surface-light/40 px-2.5 py-1 text-[11px] text-muted hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteConfig(cfg.id)}
                        className="rounded bg-rose-500/10 px-2 py-1 text-rose-300 hover:bg-rose-500/20"
                        aria-label="Delete config"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Manual send */}
          {configs.length > 0 && (
            <div className="rounded-xl border border-border/40 bg-surface-light/10 p-5">
              <h3 className="mb-3 text-sm font-semibold">Send Now (Manual)</h3>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">Config</label>
                  <select
                    value={manualConfigId}
                    onChange={(e) => setManualConfigId(e.target.value)}
                    className="rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm min-w-[160px]"
                  >
                    <option value="">— select —</option>
                    {configs.map((c) => (
                      <option key={c.id} value={c.id}>{PLATFORM_LABELS[c.platform] || c.platform} / {CHANNEL_LABELS[c.channel] || c.channel}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">Client</label>
                  <select
                    value={manualClientId}
                    onChange={(e) => setManualClientId(e.target.value)}
                    className="rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm min-w-[160px]"
                  >
                    <option value="">— select —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.contact_name || c.business_name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={sendManual}
                  disabled={sending || !manualConfigId || !manualClientId}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
                >
                  {sending ? <Loader size={13} className="animate-spin" /> : <Send size={13} />}
                  Send now
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* History tab */
        <>
          <p className="text-sm text-muted">All review requests sent (auto + manual), newest first.</p>
          {history.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<History size={36} />}
                title="No requests sent yet"
                description="Review requests will appear here once the cron fires or you send manually."
              />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted">
                    <th className="px-4 py-3">Sent</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Platform</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Event ID</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-b border-border/20 hover:bg-surface-light/10">
                      <td className="px-4 py-3 text-muted">{new Date(row.sent_at).toLocaleString()}</td>
                      <td className="px-4 py-3 capitalize">{row.channel}</td>
                      <td className="px-4 py-3 capitalize">{(row.config as { platform?: string } | null)?.platform || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.status === "sent" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted font-mono text-[10px]">{row.event_id ? row.event_id.slice(0, 8) + "…" : "manual"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Config form                                                      */
/* ─────────────────────────────────────────────────────────────── */

function ConfigForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: ReviewConfig | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [platform, setPlatform] = useState(initial?.platform ?? "google");
  const [reviewUrl, setReviewUrl] = useState(initial?.review_url ?? "");
  const [delayMinutes, setDelayMinutes] = useState(initial?.delay_minutes ?? 60);
  const [channel, setChannel] = useState(initial?.channel ?? "sms");
  const [template, setTemplate] = useState(initial?.message_template ?? DEFAULT_TEMPLATE);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!reviewUrl.trim()) { toast.error("Review URL is required"); return; }
    setSaving(true);
    const res = await fetch("/api/review-requests/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: initial?.id,
        platform,
        review_url: reviewUrl.trim(),
        delay_minutes: Number(delayMinutes),
        channel,
        message_template: template,
        enabled,
      }),
    });
    setSaving(false);
    if (res.ok) { toast.success(initial ? "Config updated" : "Config created"); onSaved(); }
    else { const d = await res.json().catch(() => ({})); toast.error((d as { error?: string }).error || "Failed to save"); }
  }

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="rounded p-1 text-muted hover:text-foreground" aria-label="Close form"><ArrowLeft size={14} /></button>
          <h3 className="text-base font-semibold">{initial ? "Edit config" : "New review request config"}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Platform */}
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">Platform</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm">
            <option value="google">Google</option>
            <option value="yelp">Yelp</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {/* Channel */}
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">Channel</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm">
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>

        {/* Review URL */}
        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">Review URL</label>
          <input
            type="url"
            value={reviewUrl}
            onChange={(e) => setReviewUrl(e.target.value)}
            placeholder="https://g.page/r/your-business/review"
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
          />
        </div>

        {/* Delay */}
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Delay after appointment ends (minutes)
          </label>
          <input
            type="number"
            min={0}
            max={10080}
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(Number(e.target.value))}
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm"
          />
        </div>

        {/* Enabled */}
        <div className="flex items-end pb-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border/50 accent-gold"
            />
            Enabled
          </label>
        </div>

        {/* Message template */}
        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">
            Message template
          </label>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm font-mono"
          />
          <p className="mt-1 text-[10px] text-muted">
            Variables: <code className="text-gold">{"{{first_name}}"}</code>{" "}
            <code className="text-gold">{"{{last_name}}"}</code>{" "}
            <code className="text-gold">{"{{review_url}}"}</code>{" "}
            <code className="text-gold">{"{{business_name}}"}</code>
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground">Cancel</button>
        <button
          onClick={save}
          disabled={saving || !reviewUrl.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-black disabled:opacity-40"
        >
          {saving ? <Loader size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
          Save config
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Review row (original)                                            */
/* ─────────────────────────────────────────────────────────────── */

function ReviewCard({
  review,
  onDelete,
  onReply,
  onResolve,
}: {
  review: Review;
  onDelete: () => void;
  onReply: (text: string) => void;
  onResolve: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState(review.reply);
  const style = STATUS_STYLES[review.status];
  const critical = review.rating <= 2;

  return (
    <div className={`rounded-lg border bg-surface-light/20 transition hover:border-gold/40 ${critical ? "border-rose-500/30" : "border-border/50"}`}>
      <div className="flex items-start gap-3 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${critical ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300"}`}>
          <Star size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{review.author}</p>
            <span className="rounded bg-background/60 px-1.5 py-0.5 text-[10px] text-muted">{review.source}</span>
            <Stars rating={review.rating} />
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.tint}`}>{style.label}</span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-foreground">{review.body}</p>
          <p className="mt-1 text-[10px] text-muted">{new Date(review.created_at).toLocaleDateString()}</p>
          {review.reply && !replying && (
            <div className="mt-2 rounded-lg border-l-2 border-sky-400/50 bg-background/40 px-3 py-2">
              <p className="mb-0.5 text-[10px] uppercase tracking-wider text-sky-300">Your reply</p>
              <p className="text-[12px] leading-relaxed text-foreground">{review.reply}</p>
            </div>
          )}
          {replying && (
            <div className="mt-2">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Thanks for sharing your feedback…" className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm" />
              <div className="mt-2 flex items-center justify-end gap-2">
                <button onClick={() => { setReplying(false); setDraft(review.reply); }} className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-foreground">Cancel</button>
                <button onClick={() => { if (!draft.trim()) return; onReply(draft.trim()); setReplying(false); }} disabled={!draft.trim()} className="inline-flex items-center gap-1 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40">
                  <MessageSquare size={11} /> Save reply
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {!replying && review.status !== "resolved" && (
            <button onClick={() => setReplying(true)} className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-2.5 py-1.5 text-[11px] text-sky-300 hover:bg-sky-500/25"><MessageSquare size={11} /> Reply</button>
          )}
          {review.status !== "resolved" && review.reply && !replying && (
            <button onClick={onResolve} className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2.5 py-1.5 text-[11px] text-emerald-300 hover:bg-emerald-500/25" title="Mark as resolved"><CheckCircle2 size={11} /> Resolve</button>
          )}
          <button onClick={onDelete} className="rounded bg-rose-500/10 px-2 py-1.5 text-rose-300 hover:bg-rose-500/20" title="Delete" aria-label="Delete review"><Trash2 size={11} /></button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* New review form (original)                                       */
/* ─────────────────────────────────────────────────────────────── */

function NewReviewForm({ onClose, onCreated }: { onClose: () => void; onCreated: (r: Review) => void }) {
  const [author, setAuthor] = useState("");
  const [source, setSource] = useState("Google");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const canSubmit = author.trim() && body.trim();

  function submit() {
    if (!canSubmit) return;
    onCreated({
      id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      author: author.trim(),
      source,
      rating,
      body: body.trim(),
      reply: "",
      status: "new",
      created_at: new Date().toISOString(),
    });
  }

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="rounded p-1 text-muted hover:text-foreground" aria-label="Back to reviews list"><ArrowLeft size={14} /></button>
          <h3 className="text-base font-semibold">Log review</h3>
        </div>
        <Link href="/dashboard/google-business" className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-gold"><ExternalLink size={11} /> Google Business</Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">Reviewer name</label>
          <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Sarah K." className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm">
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">Rating</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`} className="p-1">
                <Star size={22} className={n <= rating ? "fill-amber-400 text-amber-400" : "text-muted/40 hover:text-amber-300/60"} />
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-muted">Review text</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Great service, quick turnaround…" className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground">Cancel</button>
        <button onClick={submit} disabled={!canSubmit} className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:opacity-40">
          <Plus size={14} /> Log review
        </button>
      </div>
    </div>
  );
}
