"use client";

import { useEffect, useState } from "react";
import {
  Webhook,
  Plus,
  Send,
  Trash2,
  Power,
  AlertTriangle,
  CheckCircle,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";
import { MotionPage } from "@/components/motion/motion-page";

interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret: string;
  created_at: string;
}

const ALL_EVENTS = [
  "lead.created",
  "lead.updated",
  "lead.deleted",
  "deal.created",
  "deal.updated",
  "deal.stage_changed",
  "deal.won",
  "deal.lost",
  "contact.created",
  "contact.updated",
  "email.sent",
  "email.opened",
  "email.clicked",
  "email.replied",
  "form.submitted",
  "appointment.booked",
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>(["lead.created"]);
  const [creating, setCreating] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  async function loadWebhooks() {
    setLoading(true);
    try {
      const res = await fetch("/api/api-webhooks");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load webhooks");
      setWebhooks(json.webhooks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWebhooks();
  }, []);

  function toggleEvent(event: string) {
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  async function handleCreate() {
    if (!newUrl.trim() || newEvents.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/api-webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl.trim(), events: newEvents }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      setNewUrl("");
      setNewEvents(["lead.created"]);
      setShowCreate(false);
      await loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(w: WebhookRow) {
    try {
      const res = await fetch(`/api/api-webhooks/${w.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !w.active }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Toggle failed");
      }
      await loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toggle failed");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this webhook subscription? Existing deliveries will stop.")) return;
    try {
      const res = await fetch(`/api/api-webhooks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Delete failed");
      }
      await loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const res = await fetch(`/api/api-webhooks/${id}/test`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Test failed");
      alert(json.note ?? "Test enqueued");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTestingId(null);
    }
  }

  function copySecret(secret: string, id: string) {
    navigator.clipboard.writeText(secret);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <MotionPage className="space-y-5">{/* -- Webhooks command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">Endpoint Manager</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Webhooks</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
                  onClick={() => setShowCreate((v) => !v)}
                  className="text-[11px] px-3 py-1.5 rounded-lg bg-white/8 text-text-primary border border-border-subtle hover:bg-white/12 transition-all flex items-center gap-1.5"
                >
                  <Plus size={11} />
                  New Webhook
                </button>
      </div>
    </div>{error && (
              <div className="glass rounded-xl p-3 border-red-500/30 bg-red-500/5 text-[11px] text-red-400 flex items-center gap-2">
                <AlertTriangle size={13} />
                <span>{error}</span>
              </div>
            )}{showCreate && (
              <div className="glass rounded-xl p-4 space-y-3 border-[rgba(212,255,0,0.2)] bg-[rgba(212,255,0,0.05)]">
                <div className="flex items-center gap-2">
                  <Webhook size={13} className="text-brand-accent" />
                  <h2 className="text-xs font-semibold text-brand-accent">New Webhook</h2>
                </div>
                <div>
                  <label className="text-[9px] text-text-muted uppercase tracking-wider block mb-1">
                    Endpoint URL
                  </label>
                  <input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://api.example.com/hooks/shortstack"
                    className="input w-full text-xs py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-text-muted uppercase tracking-wider block mb-1">
                    Events ({newEvents.length} selected)
                  </label>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5">
                    {ALL_EVENTS.map((e) => (
                      <button
                        key={e}
                        onClick={() => toggleEvent(e)}
                        className={`text-[10px] px-2 py-1.5 rounded border font-mono transition-all text-left ${
                          newEvents.includes(e)
                            ? "bg-[rgba(212,255,0,0.08)] border-[rgba(212,255,0,0.35)] text-brand-accent"
                            : "border-border-subtle text-text-muted hover:text-text-primary"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="text-[10px] px-3 py-1.5 rounded-lg border border-border-subtle text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newUrl.trim() || newEvents.length === 0}
                    className="text-[10px] px-4 py-1.5 rounded-lg bg-brand-accent text-[#020711] font-medium hover:bg-brand-accent/80 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {creating ? "Creating…" : "Create Webhook"}
                  </button>
                </div>
              </div>
            )}<div className="space-y-3">
              {loading ? (
                <div className="glass rounded-xl p-8 text-center text-[11px] text-text-muted">Loading…</div>
              ) : webhooks.length === 0 ? (
                <div className="glass rounded-xl p-10 text-center">
                  <Webhook size={22} className="mx-auto mb-2 text-text-muted opacity-40" />
                  <p className="text-[11px] text-text-muted">No webhooks yet. Add one to start receiving events.</p>
                </div>
              ) : (
                webhooks.map((w) => (
                  <div key={w.id} className="glass rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              w.active ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" : "bg-red-400/60"
                            }`}
                          />
                          <span className="text-xs font-medium">
                            {w.active ? "Active" : "Paused"}
                          </span>
                          <span className="text-[9px] text-text-muted">
                            Created {new Date(w.created_at).toISOString().split("T")[0]}
                          </span>
                        </div>
                        <code className="text-[11px] text-text-primary font-mono break-all block">
                          {w.url}
                        </code>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleTest(w.id)}
                          disabled={testingId === w.id || !w.active}
                          className="text-[9px] px-2 py-1 rounded border border-[rgba(212,255,0,0.25)] text-brand-accent hover:bg-[rgba(212,255,0,0.08)] transition-all flex items-center gap-1 disabled:opacity-40"
                        >
                          <Send size={9} />
                          {testingId === w.id ? "Sending…" : "Test"}
                        </button>
                        <button
                          onClick={() => handleToggleActive(w)}
                          className={`text-[9px] px-2 py-1 rounded border transition-all flex items-center gap-1 ${
                            w.active
                              ? "border-orange-500/25 text-orange-400 hover:bg-orange-500/10"
                              : "border-green-500/25 text-green-400 hover:bg-green-500/10"
                          }`}
                        >
                          <Power size={9} />
                          {w.active ? "Pause" : "Resume"}
                        </button>
                        <button
                          onClick={() => handleDelete(w.id)}
                          className="text-[9px] px-2 py-1 rounded border border-red-500/25 text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-1"
                        >
                          <Trash2 size={9} />
                          Delete
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1">
                        Events ({w.events.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {w.events.map((e) => (
                          <span
                            key={e}
                            className="text-[9px] px-1.5 py-0.5 rounded border border-[rgba(212,255,0,0.25)] text-[rgba(212,255,0,0.9)] bg-[rgba(212,255,0,0.05)] font-mono"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1">
                        Signing secret
                      </p>
                      <div className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-lg px-3 py-2 font-mono text-[10px]">
                        <span className="truncate flex-1">
                          {revealedSecrets[w.id]
                            ? w.secret
                            : `${w.secret.slice(0, 12)}${"•".repeat(20)}${w.secret.slice(-4)}`}
                        </span>
                        <button
                          onClick={() =>
                            setRevealedSecrets((p) => ({ ...p, [w.id]: !p[w.id] }))
                          }
                          className="text-text-muted hover:text-text-primary"
                        >
                          {revealedSecrets[w.id] ? <EyeOff size={10} /> : <Eye size={10} />}
                        </button>
                        <button
                          onClick={() => copySecret(w.secret, w.id)}
                          className="text-text-muted hover:text-brand-accent"
                        >
                          {copiedId === w.id ? (
                            <CheckCircle size={10} className="text-green-400" />
                          ) : (
                            <Copy size={10} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div><div className="glass rounded-xl p-4">
              <h3 className="text-xs font-semibold mb-2">Verifying signatures</h3>
              <p className="text-[10px] text-text-muted mb-2">
                Every delivery includes <code className="text-brand-accent">x-shortstack-signature</code> — HMAC-SHA256 of
                the raw body using your subscription secret.
              </p>
              <pre className="bg-white/4 border border-white/8 rounded-lg p-3 text-[10px] font-mono text-brand-accent overflow-x-auto">
      {`import crypto from "crypto";

const signature = req.headers["x-shortstack-signature"];
const expected = crypto
  .createHmac("sha256", process.env.SHORTSTACK_WEBHOOK_SECRET)
  .update(rawBody)
  .digest("hex");
const valid = crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(expected),
);`}
              </pre>
            </div></MotionPage>
  );
}
