"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Webhook, Plus, Trash2, Copy, CheckCircle, AlertCircle,
  Zap, Users, CreditCard, MessageSquare
} from "lucide-react";
import toast from "react-hot-toast";

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  lastTriggered: string | null;
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
];

export default function WebhooksPage() {
  useAuth();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [form, setForm] = useState({ name: "", url: "", events: [] as string[] });
  const [showCreate, setShowCreate] = useState(false);

  const inboundUrl = "https://shortstack-os.vercel.app/api/webhooks/inbound";

  function createWebhook() {
    if (!form.name || !form.url || form.events.length === 0) {
      toast.error("Name, URL, and at least one event required");
      return;
    }
    const webhook: WebhookConfig = {
      id: `wh_${Date.now()}`,
      name: form.name,
      url: form.url,
      events: form.events,
      active: true,
      lastTriggered: null,
    };
    setWebhooks(prev => [...prev, webhook]);
    setShowCreate(false);
    setForm({ name: "", url: "", events: [] });
    toast.success("Webhook created!");
  }

  function toggleEvent(eventId: string) {
    setForm(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId],
    }));
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Webhook size={18} className="text-gold" /> Webhooks
          </h1>
          <p className="text-xs text-muted mt-0.5">Connect ShortStack to any tool via webhooks</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus size={12} /> New Webhook
        </button>
      </div>

      {/* Inbound webhook URL */}
      <div className="card">
        <h2 className="section-header">Inbound Webhook URL</h2>
        <p className="text-[10px] text-muted mb-2">Send data TO ShortStack from external tools (Zapier, Make, n8n)</p>
        <div className="flex gap-2">
          <code className="flex-1 text-[10px] font-mono p-2.5 rounded-lg truncate" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            {inboundUrl}
          </code>
          <button onClick={() => { navigator.clipboard.writeText(inboundUrl); toast.success("Copied!"); }}
            className="btn-secondary text-xs px-3"><Copy size={12} /></button>
        </div>
      </div>

      {/* Create webhook */}
      {showCreate && (
        <div className="card border-gold/10">
          <h2 className="section-header">Create Outbound Webhook</h2>
          <p className="text-[10px] text-muted mb-3">Send data FROM ShortStack when events happen</p>
          <div className="space-y-3">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="input w-full" placeholder="Webhook name (e.g. Zapier Lead Sync)" />
            <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
              className="input w-full" placeholder="https://hooks.zapier.com/..." />

            <div>
              <p className="text-[10px] text-muted mb-2 font-semibold">Trigger on events:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {EVENTS.map(event => (
                  <button key={event.id} onClick={() => toggleEvent(event.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg text-[10px] transition-all text-left ${
                      form.events.includes(event.id) ? "bg-gold/[0.06] border-gold/15 text-gold" : "border-white/[0.04] text-muted"
                    }`} style={{ border: `1px solid ${form.events.includes(event.id) ? "rgba(200,168,85,0.15)" : "rgba(255,255,255,0.04)"}` }}>
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

      {/* Webhook list */}
      {webhooks.length === 0 && !showCreate ? (
        <div className="card text-center py-12">
          <Webhook size={24} className="mx-auto mb-2 text-muted/30" />
          <p className="text-xs text-muted mb-2">No outbound webhooks configured</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-xs">Create Your First Webhook</button>
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map(wh => (
            <div key={wh.id} className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${wh.active ? "bg-success" : "bg-muted"}`} />
                <div>
                  <p className="text-xs font-semibold">{wh.name}</p>
                  <p className="text-[9px] text-muted font-mono truncate max-w-[300px]">{wh.url}</p>
                  <div className="flex gap-1 mt-1">
                    {wh.events.map(e => (
                      <span key={e} className="text-[7px] px-1.5 py-0.5 rounded" style={{ background: "rgba(200,168,85,0.08)", color: "#c8a855" }}>
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => setWebhooks(prev => prev.filter(w => w.id !== wh.id))}
                className="text-muted hover:text-danger p-2"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
