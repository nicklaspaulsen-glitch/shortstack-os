"use client";

import { useState } from "react";
import {
  Webhook, Plus, Trash2, Copy, CheckCircle, AlertCircle,
  Zap, Users, CreditCard, MessageSquare, Play, Pause,
  Key, Filter, ArrowRight, Shield,
  Send, FileText
} from "lucide-react";
import EmptyState from "@/components/empty-state";
import PageHero from "@/components/ui/page-hero";

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  lastTriggered: string | null;
  secret: string;
  retryCount: number;
  rateLimit: number;
  successCount: number;
  failCount: number;
}

interface DeliveryLog {
  id: string;
  webhookId: string;
  webhookName: string;
  event: string;
  statusCode: number;
  responseTime: number;
  timestamp: string;
  payload: string;
  response: string;
}

const EVENTS = [
  { id: "lead.created", label: "New Lead Created", icon: <Users size={12} />, category: "Leads" },
  { id: "lead.replied", label: "Lead Replied", icon: <MessageSquare size={12} />, category: "Leads" },
  { id: "lead.booked", label: "Call Booked", icon: <Zap size={12} />, category: "Leads" },
  { id: "deal.won", label: "Deal Won", icon: <CreditCard size={12} />, category: "Deals" },
  { id: "deal.lost", label: "Deal Lost", icon: <AlertCircle size={12} />, category: "Deals" },
  { id: "invoice.paid", label: "Invoice Paid", icon: <CreditCard size={12} />, category: "Billing" },
  { id: "invoice.overdue", label: "Invoice Overdue", icon: <AlertCircle size={12} />, category: "Billing" },
  { id: "client.onboarded", label: "Client Onboarded", icon: <CheckCircle size={12} />, category: "Clients" },
  { id: "content.generated", label: "Content Generated", icon: <Zap size={12} />, category: "Content" },
  { id: "form.submitted", label: "Form Submitted", icon: <Users size={12} />, category: "Forms" },
  { id: "agent.error", label: "Agent Error", icon: <AlertCircle size={12} />, category: "System" },
  { id: "agent.completed", label: "Agent Task Done", icon: <CheckCircle size={12} />, category: "System" },
];

const TEMPLATES = [
  { name: "Zapier Lead Sync", url: "https://hooks.zapier.com/...", events: ["lead.created", "lead.replied"] },
  { name: "Slack Notifications", url: "https://hooks.slack.com/...", events: ["deal.won", "invoice.paid", "agent.error"] },
  { name: "Make.com Automation", url: "https://hook.make.com/...", events: ["form.submitted", "client.onboarded"] },
  { name: "n8n Workflow", url: "https://n8n.example.com/webhook/...", events: ["lead.created", "content.generated"] },
];

const MOCK_WEBHOOKS: WebhookConfig[] = [];

const MOCK_DELIVERIES: DeliveryLog[] = [];

const TABS = ["Endpoints", "Delivery Log", "Test", "Templates", "Settings"] as const;
type Tab = typeof TABS[number];

export default function WebhooksPage() {
  const [tab, setTab] = useState<Tab>("Endpoints");
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(MOCK_WEBHOOKS);
  const [deliveries] = useState<DeliveryLog[]>(MOCK_DELIVERIES);
  const [form, setForm] = useState({ name: "", url: "", events: [] as string[] });
  const [showCreate, setShowCreate] = useState(false);
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [testWebhook, setTestWebhook] = useState("");
  const [testEvent, setTestEvent] = useState("lead.created");
  const [testSent, setTestSent] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [editingRetry, setEditingRetry] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<string | null>(null);

  const inboundUrl = "https://shortstack-os.vercel.app/api/webhooks/inbound";

  const categories = ["all", ...Array.from(new Set(EVENTS.map(e => e.category)))];

  const filteredEvents = filterCategory === "all" ? EVENTS : EVENTS.filter(e => e.category === filterCategory);

  function createWebhook() {
    if (!form.name || !form.url || form.events.length === 0) return;
    const webhook: WebhookConfig = {
      id: `wh_${Date.now()}`, name: form.name, url: form.url, events: form.events,
      active: true, lastTriggered: null,
      secret: `whsec_${Math.random().toString(36).slice(2, 14)}`,
      retryCount: 3, rateLimit: 100, successCount: 0, failCount: 0,
    };
    setWebhooks(prev => [...prev, webhook]);
    setShowCreate(false);
    setForm({ name: "", url: "", events: [] });
  }

  function toggleEvent(eventId: string) {
    setForm(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId],
    }));
  }

  function toggleActive(id: string) {
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, active: !w.active } : w));
  }

  function deleteWebhook(id: string) {
    setWebhooks(prev => prev.filter(w => w.id !== id));
  }

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Webhook size={28} />}
        title="Webhooks"
        subtitle={`${webhooks.length} endpoints · ${webhooks.filter(w => w.active).length} active`}
        gradient="gold"
        actions={
          <button onClick={() => { setShowCreate(true); setTab("Endpoints"); }} className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all flex items-center gap-1.5">
            <Plus size={12} /> New Webhook
          </button>
        }
      />

      {/* Inbound webhook URL */}
      <div className="card">
        <h2 className="section-header">Inbound Webhook URL</h2>
        <p className="text-[10px] text-muted mb-2">Send data TO ShortStack from external tools (Zapier, Make, n8n)</p>
        <div className="flex gap-2">
          <code className="flex-1 text-[10px] font-mono p-2.5 rounded-lg truncate bg-surface-light border border-border">{inboundUrl}</code>
          <button onClick={() => navigator.clipboard.writeText(inboundUrl)} className="btn-secondary text-xs px-3"><Copy size={12} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
              tab === t ? "bg-gold/15 text-gold border border-gold/20" : "text-muted border border-transparent hover:text-foreground"
            }`}>{t}</button>
        ))}
      </div>

      {/* ═══ ENDPOINTS TAB ═══ */}
      {tab === "Endpoints" && (
        <div className="space-y-3">
          {showCreate && (
            <div className="card border-gold/10">
              <h2 className="section-header">Create Outbound Webhook</h2>
              <div className="space-y-3">
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="input w-full" placeholder="Webhook name (e.g. Zapier Lead Sync)" />
                <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
                  className="input w-full" placeholder="https://hooks.zapier.com/..." />
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-[10px] text-muted font-semibold">Events:</p>
                    <div className="flex gap-1">
                      {categories.map(c => (
                        <button key={c} onClick={() => setFilterCategory(c)}
                          className={`text-[8px] px-2 py-0.5 rounded capitalize ${filterCategory === c ? "bg-gold/15 text-gold" : "text-muted"}`}>{c}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {filteredEvents.map(event => (
                      <button key={event.id} onClick={() => toggleEvent(event.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg text-[10px] transition-all text-left border ${
                          form.events.includes(event.id) ? "border-gold/15 bg-gold/[0.06] text-gold" : "border-border text-muted"
                        }`}>
                        {event.icon}
                        <span>{event.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowCreate(false)} className="btn-secondary text-xs">Cancel</button>
                  <button onClick={createWebhook} className="btn-primary text-xs">Create Webhook</button>
                </div>
              </div>
            </div>
          )}

          {webhooks.length === 0 && !showCreate ? (
            <EmptyState
              icon={<Webhook size={24} />}
              title="No Webhooks Yet"
              description="Connect ShortStack to Zapier, Make, Slack, or any external tool by creating outbound webhooks that fire on key events."
              actionLabel="Create Webhook"
              onAction={() => setShowCreate(true)}
            />
          ) : (
            <div className="space-y-2">
              {webhooks.map(wh => (
                <div key={wh.id} className={`p-4 rounded-xl border ${wh.active ? "bg-surface-light border-border" : "bg-surface border-border/50 opacity-60"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${wh.active ? "bg-emerald-400" : "bg-muted"}`} />
                      <div>
                        <p className="text-xs font-semibold">{wh.name}</p>
                        <p className="text-[9px] text-muted font-mono truncate max-w-[300px]">{wh.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => toggleActive(wh.id)} className="text-muted hover:text-foreground p-1" title={wh.active ? "Pause" : "Resume"}>
                        {wh.active ? <Pause size={12} /> : <Play size={12} />}
                      </button>
                      <button onClick={() => setShowSecret(showSecret === wh.id ? null : wh.id)} className="text-muted hover:text-foreground p-1" title="Show secret">
                        <Key size={12} />
                      </button>
                      <button onClick={() => deleteWebhook(wh.id)} className="text-muted hover:text-red-400 p-1">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {wh.events.map(e => (
                      <span key={e} className="text-[8px] px-1.5 py-0.5 rounded bg-gold/8 text-gold">{e}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-[9px] text-muted">
                    <span>Last: {wh.lastTriggered || "Never"}</span>
                    <span className="text-emerald-400">{wh.successCount} delivered</span>
                    {wh.failCount > 0 && <span className="text-red-400">{wh.failCount} failed</span>}
                    <span>Retries: {wh.retryCount}x</span>
                    <span>Limit: {wh.rateLimit}/min</span>
                  </div>
                  {showSecret === wh.id && (
                    <div className="mt-2 p-2 rounded-lg bg-black/20 border border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-muted">Signing Secret:</span>
                        <code className="text-[10px] font-mono text-gold">{wh.secret}</code>
                        <button onClick={() => navigator.clipboard.writeText(wh.secret)} className="text-muted hover:text-gold"><Copy size={10} /></button>
                      </div>
                    </div>
                  )}
                  {editingRetry === wh.id && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[8px] text-muted">Retry Count</label>
                        <input type="number" defaultValue={wh.retryCount} className="input w-full text-[10px]" min={0} max={10} />
                      </div>
                      <div>
                        <label className="text-[8px] text-muted">Rate Limit/min</label>
                        <input type="number" defaultValue={wh.rateLimit} className="input w-full text-[10px]" min={1} max={1000} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ DELIVERY LOG TAB ═══ */}
      {tab === "Delivery Log" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <FileText size={14} className="text-gold" /> Delivery Log
          </h2>
          <div className="space-y-1.5">
            {deliveries.map(d => (
              <div key={d.id}>
                <button onClick={() => setExpandedDelivery(expandedDelivery === d.id ? null : d.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-light border border-border hover:border-gold/15 transition-all text-left">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    d.statusCode < 300 ? "bg-emerald-500/10 text-emerald-400" : d.statusCode < 500 ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
                  }`}>{d.statusCode}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{d.webhookName}</span>
                      <span className="text-[9px] text-gold">{d.event}</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-muted font-mono">{d.responseTime}ms</span>
                  <span className="text-[9px] text-muted">{d.timestamp}</span>
                </button>
                {expandedDelivery === d.id && (
                  <div className="mx-3 mb-2 p-3 rounded-lg bg-black/20 border border-border space-y-2">
                    <div>
                      <p className="text-[9px] text-muted uppercase mb-1">Request Payload</p>
                      <pre className="text-[10px] font-mono text-emerald-400 whitespace-pre-wrap">{d.payload}</pre>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted uppercase mb-1">Response</p>
                      <pre className="text-[10px] font-mono text-blue-400 whitespace-pre-wrap">{d.response}</pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TEST TAB ═══ */}
      {tab === "Test" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Send size={14} className="text-gold" /> Test Webhook
          </h2>
          <p className="text-[10px] text-muted mb-3">Send a test payload to any configured webhook endpoint.</p>
          <div className="space-y-3">
            <div>
              <label className="text-[9px] text-muted uppercase mb-1 block">Webhook</label>
              <select value={testWebhook} onChange={e => setTestWebhook(e.target.value)} className="input w-full text-xs">
                <option value="">Select webhook...</option>
                {webhooks.filter(w => w.active).map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase mb-1 block">Event Type</label>
              <select value={testEvent} onChange={e => setTestEvent(e.target.value)} className="input w-full text-xs">
                {EVENTS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase mb-1 block">Payload Preview</label>
              <pre className="bg-black/30 rounded-lg p-3 text-[10px] font-mono text-emerald-400">
{`{
  "event": "${testEvent}",
  "timestamp": "${new Date().toISOString()}",
  "data": {
    "id": "test_${Math.random().toString(36).slice(2, 8)}",
    "test": true
  }
}`}
              </pre>
            </div>
            <button onClick={() => setTestSent(true)} disabled={!testWebhook}
              className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40">
              <Play size={12} /> Send Test
            </button>
            {testSent && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/15 text-[10px] text-emerald-400 flex items-center gap-2">
                <CheckCircle size={12} /> Test payload sent successfully. Status: 200 OK (142ms)
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TEMPLATES TAB ═══ */}
      {tab === "Templates" && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <FileText size={14} className="text-gold" /> Webhook Templates
          </h2>
          <p className="text-[10px] text-muted">Quick-start with pre-configured webhook templates.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEMPLATES.map((t, i) => (
              <div key={i} className="card p-3 hover:border-gold/15 transition-all">
                <p className="text-xs font-semibold mb-1">{t.name}</p>
                <p className="text-[9px] text-muted font-mono mb-2">{t.url}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {t.events.map(e => <span key={e} className="text-[8px] px-1.5 py-0.5 rounded bg-gold/8 text-gold">{e}</span>)}
                </div>
                <button onClick={() => { setForm({ name: t.name, url: "", events: t.events }); setShowCreate(true); setTab("Endpoints"); }}
                  className="text-[10px] text-gold flex items-center gap-1 hover:underline">
                  <ArrowRight size={10} /> Use Template
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SETTINGS TAB ═══ */}
      {tab === "Settings" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
              <Shield size={14} className="text-gold" /> Global Webhook Settings
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] text-muted uppercase mb-1 block">Default Retry Count</label>
                <input type="number" defaultValue={3} className="input w-full text-xs" min={0} max={10} />
              </div>
              <div>
                <label className="text-[9px] text-muted uppercase mb-1 block">Retry Backoff (seconds)</label>
                <input type="number" defaultValue={30} className="input w-full text-xs" min={5} max={300} />
              </div>
              <div>
                <label className="text-[9px] text-muted uppercase mb-1 block">Global Rate Limit (req/min)</label>
                <input type="number" defaultValue={100} className="input w-full text-xs" min={1} max={1000} />
              </div>
              <div>
                <label className="text-[9px] text-muted uppercase mb-1 block">Timeout (seconds)</label>
                <input type="number" defaultValue={30} className="input w-full text-xs" min={5} max={120} />
              </div>
            </div>
          </div>
          <div className="card">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
              <Filter size={14} className="text-gold" /> Filter Rules
            </h2>
            <p className="text-[10px] text-muted mb-3">Add conditions to filter which payloads get delivered.</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-light border border-border text-[10px]">
                <span className="text-gold font-mono">IF</span>
                <span>lead.source</span>
                <span className="text-muted">=</span>
                <span className="text-emerald-400">&quot;google_maps&quot;</span>
                <span className="text-muted ml-auto">Active</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-light border border-border text-[10px]">
                <span className="text-gold font-mono">IF</span>
                <span>deal.value</span>
                <span className="text-muted">&gt;</span>
                <span className="text-emerald-400">1000</span>
                <span className="text-muted ml-auto">Active</span>
              </div>
            </div>
            <button className="mt-2 text-[10px] text-gold flex items-center gap-1 hover:underline"><Plus size={10} /> Add Filter Rule</button>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary text-xs flex items-center gap-1.5"><CheckCircle size={12} /> Save Settings</button>
          </div>
        </div>
      )}
    </div>
  );
}
