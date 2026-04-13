"use client";

import { useState, useEffect } from "react";
import {
  Mail, Phone, MessageSquare, Send, Loader, Zap,
  CheckCircle, Clock, XCircle, ArrowRight,
  Sparkles, Bot,
  Smartphone, Globe,
} from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

type Channel = "email" | "dm" | "sms" | "call";
type Tab = "compose" | "history" | "templates";

interface OutreachLog {
  id: string;
  platform: string;
  business_name: string;
  recipient_handle: string | null;
  message_text: string;
  status: string;
  reply_text: string | null;
  sent_at: string;
}

const MESSAGE_TEMPLATES: Record<Channel, Array<{ name: string; subject?: string; body: string }>> = {
  email: [
    { name: "Friendly Intro", subject: "Quick question about {business_name}", body: "Hi {name},\n\nI came across {business_name} and was impressed by what you've built. I help businesses like yours grow their online presence and generate more leads.\n\nWould you be open to a quick 10-minute chat this week?\n\nBest,\n{my_name}" },
    { name: "Value First", subject: "3 ideas for {business_name}", body: "Hi {name},\n\nI did a quick audit of {business_name}'s online presence and found 3 opportunities you might be missing.\n\nWould you like me to share them? No strings attached.\n\n{my_name}" },
    { name: "Social Proof", subject: "How we helped a {industry} grow 3x", body: "Hi {name},\n\nWe recently helped a {industry} business triple their monthly leads in 90 days.\n\nI think we could do something similar for {business_name}. Want me to show you how?\n\n{my_name}" },
  ],
  dm: [
    { name: "Casual DM", body: "Hey! Love what you're doing with {business_name} 🔥 I help {industry} businesses get more clients through social media. Mind if I share a quick idea?" },
    { name: "Loom Offer", body: "Hey {name}! I made a quick video showing how {business_name} could get more customers. Want me to send it over?" },
    { name: "Direct Pitch", body: "Hi! I help {industry} businesses generate 10-20 extra leads per month. Would that interest you?" },
  ],
  sms: [
    { name: "Quick Text", body: "Hi {name}, this is {my_name}. I help {industry} businesses like {business_name} get more clients. Would you be open to a quick chat?" },
    { name: "Follow-up", body: "Hi {name}, just following up on my earlier message. Would love to show you how we can help {business_name} grow. Available for a 5-min call?" },
  ],
  call: [
    { name: "AI Cold Call", body: "Introduction: Mention you noticed their {industry} business. Pitch: Explain how you help similar businesses get more leads. Ask: Would they be open to learning more? Close: Book a call." },
  ],
};

export default function ClientOutreachPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const [channel, setChannel] = useState<Channel>("email");
  const [tab, setTab] = useState<Tab>("compose");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<OutreachLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Compose state
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [batchSize, setBatchSize] = useState(20);
  const [useAI, setUseAI] = useState(true);
  const [targetTier, setTargetTier] = useState<"all" | "hot" | "warm" | "cold">("cold");

  // Stats
  const [stats, setStats] = useState({ sent: 0, replied: 0, pending: 0, failed: 0 });

  useEffect(() => {
    loadTemplate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, selectedTemplate]);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadTemplate() {
    const templates = MESSAGE_TEMPLATES[channel];
    if (templates[selectedTemplate]) {
      setBody(templates[selectedTemplate].body);
      if ("subject" in templates[selectedTemplate]) {
        setSubject(templates[selectedTemplate].subject || "");
      }
    }
  }

  async function fetchStats() {
    try {
      const [
        { count: sent },
        { count: replied },
        { count: pending },
        { count: failed },
      ] = await Promise.all([
        supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "sent"),
        supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "replied"),
        supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("outreach_log").select("*", { count: "exact", head: true }).in("status", ["bounced", "failed"]),
      ]);
      setStats({ sent: sent || 0, replied: replied || 0, pending: pending || 0, failed: failed || 0 });
    } catch {
      // Stats will remain at default 0 values
    }
  }

  async function fetchHistory() {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("outreach_log")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setHistory((data || []) as OutreachLog[]);
    } catch {
      toast.error("Failed to load outreach history");
    } finally {
      setLoadingHistory(false);
    }
  }

  async function sendCampaign() {
    setSending(true);
    try {
      const endpoints: Record<Channel, string> = {
        email: "/api/outreach/email",
        dm: "/api/dm/browser-send",
        sms: "/api/outreach/bulk",
        call: "/api/outreach/bulk",
      };

      const payload: Record<string, unknown> = {
        batch_size: batchSize,
        action: channel,
        tier: targetTier,
        use_ai: useAI,
      };

      if (channel === "email") {
        payload.subject_template = subject;
        payload.body_template = body;
        payload.from_name = profile?.nickname || profile?.full_name || "Your Agency";
      } else if (channel === "dm") {
        payload.message_template = body;
        payload.platforms = ["instagram", "facebook", "linkedin"];
      } else if (channel === "sms") {
        payload.message_template = body;
        payload.action = "sms";
      } else {
        payload.action = "call";
        payload.script = body;
      }

      const res = await fetch(endpoints[channel], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast.success(`Campaign launched! ${data.sent || data.queued || batchSize} ${channel === "email" ? "emails" : channel === "dm" ? "DMs" : channel === "sms" ? "texts" : "calls"} queued.`);
      await fetchStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Campaign failed");
    } finally {
      setSending(false);
    }
  }

  const channels: Array<{ id: Channel; label: string; icon: React.ReactNode; color: string }> = [
    { id: "email", label: "Email", icon: <Mail size={14} />, color: "text-info" },
    { id: "dm", label: "Social DMs", icon: <MessageSquare size={14} />, color: "text-gold" },
    { id: "sms", label: "SMS", icon: <Smartphone size={14} />, color: "text-success" },
    { id: "call", label: "AI Call", icon: <Phone size={14} />, color: "text-gold" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Send size={20} className="text-gold" />
          Outreach Center
        </h1>
        <p className="text-xs text-muted mt-1">Launch multi-channel campaigns with AI-personalized messages</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Sent", value: stats.sent, icon: <CheckCircle size={14} />, color: "text-info" },
          { label: "Replied", value: stats.replied, icon: <MessageSquare size={14} />, color: "text-success" },
          { label: "Pending", value: stats.pending, icon: <Clock size={14} />, color: "text-gold" },
          { label: "Failed", value: stats.failed, icon: <XCircle size={14} />, color: "text-danger" },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-3 py-3">
            <div className={s.color}>{s.icon}</div>
            <div>
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-[9px] text-muted uppercase tracking-wider">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Channel Selector */}
      <div className="flex gap-2">
        {channels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => { setChannel(ch.id); setSelectedTemplate(0); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
              channel === ch.id
                ? "bg-gold/10 text-gold border border-gold/20"
                : "bg-surface-light text-muted hover:text-foreground border border-transparent"
            }`}
          >
            {ch.icon} {ch.label}
          </button>
        ))}
      </div>

      {/* Tab nav */}
      <div className="flex gap-4 border-b border-border">
        {(["compose", "history", "templates"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-xs font-medium capitalize transition-colors border-b-2 ${
              tab === t ? "text-gold border-gold" : "text-muted border-transparent hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Compose Tab */}
      {tab === "compose" && (
        <div className="grid grid-cols-3 gap-4">
          {/* Main compose area */}
          <div className="col-span-2 space-y-3">
            {channel === "email" && (
              <div>
                <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Subject Line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input w-full text-xs"
                  placeholder="Quick question about {business_name}"
                />
              </div>
            )}
            <div>
              <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">
                {channel === "call" ? "Call Script" : "Message Body"}
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={channel === "call" ? 6 : 8}
                className="input w-full text-xs resize-none"
                placeholder="Type your message..."
              />
              <p className="text-[9px] text-muted mt-1">
                Variables: {"{business_name}"}, {"{name}"}, {"{industry}"}, {"{my_name}"}
              </p>
            </div>

            {/* Launch button */}
            <button
              onClick={sendCampaign}
              disabled={sending}
              className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
            >
              {sending ? <Loader size={14} className="animate-spin" /> : <Zap size={14} />}
              {sending ? "Launching..." : `Launch ${channel === "email" ? "Email" : channel === "dm" ? "DM" : channel === "sms" ? "SMS" : "Call"} Campaign`}
            </button>
          </div>

          {/* Config sidebar */}
          <div className="space-y-3">
            <div className="card">
              <h3 className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-2">Campaign Settings</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] text-muted uppercase block mb-1">Batch Size</label>
                  <input type="number" value={batchSize} onChange={(e) => setBatchSize(+e.target.value)}
                    className="input w-full text-xs" min={1} max={100} />
                </div>
                <div>
                  <label className="text-[9px] text-muted uppercase block mb-1">Target Leads</label>
                  <select value={targetTier} onChange={(e) => setTargetTier(e.target.value as typeof targetTier)}
                    className="input w-full text-xs">
                    <option value="cold">Cold (New leads)</option>
                    <option value="warm">Warm (Contacted)</option>
                    <option value="hot">Hot (Replied)</option>
                    <option value="all">All Leads</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-border" />
                  <span className="text-[10px] flex items-center gap-1">
                    <Sparkles size={10} className="text-gold" /> AI Personalization
                  </span>
                </label>
              </div>
            </div>

            {/* Template picker */}
            <div className="card">
              <h3 className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-2">Quick Templates</h3>
              <div className="space-y-1.5">
                {MESSAGE_TEMPLATES[channel].map((tpl, i) => (
                  <button
                    key={tpl.name}
                    onClick={() => setSelectedTemplate(i)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-[10px] transition-colors ${
                      selectedTemplate === i
                        ? "bg-gold/10 text-gold border border-gold/15"
                        : "bg-surface-light text-muted hover:text-foreground"
                    }`}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            {channel === "dm" && (
              <div className="card bg-gold/5 border-gold/15">
                <p className="text-[10px] text-gold flex items-center gap-1 mb-1">
                  <Globe size={10} /> Chrome Extension Required
                </p>
                <p className="text-[9px] text-muted">
                  Social DMs are sent through the browser extension. Make sure it is installed and your accounts are logged in.
                </p>
              </div>
            )}

            {channel === "call" && (
              <div className="card bg-gold/5 border-gold/15">
                <p className="text-[10px] text-gold flex items-center gap-1 mb-1">
                  <Bot size={10} /> AI-Powered Calls
                </p>
                <p className="text-[9px] text-muted">
                  Calls use AI voice agents. Each lead will receive a natural conversation following your script.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div className="card p-0 overflow-hidden">
          {loadingHistory ? (
            <div className="text-center py-12 text-muted">
              <Loader size={16} className="animate-spin mx-auto mb-2" /> Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <Send size={20} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">No outreach history yet. Launch your first campaign above.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-light">
                  <th className="px-3 py-2.5 text-left text-[9px] uppercase tracking-wider text-muted font-semibold">Business</th>
                  <th className="px-3 py-2.5 text-left text-[9px] uppercase tracking-wider text-muted font-semibold">Channel</th>
                  <th className="px-3 py-2.5 text-left text-[9px] uppercase tracking-wider text-muted font-semibold">Message</th>
                  <th className="px-3 py-2.5 text-center text-[9px] uppercase tracking-wider text-muted font-semibold">Status</th>
                  <th className="px-3 py-2.5 text-right text-[9px] uppercase tracking-wider text-muted font-semibold">Sent</th>
                </tr>
              </thead>
              <tbody>
                {history.map((log) => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-surface-light/50">
                    <td className="px-3 py-2.5 font-medium">{log.business_name}</td>
                    <td className="px-3 py-2.5 capitalize text-muted">{log.platform}</td>
                    <td className="px-3 py-2.5 text-muted max-w-[200px] truncate">{log.message_text}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                        log.status === "sent" ? "bg-info/10 text-info" :
                        log.status === "replied" ? "bg-success/10 text-success" :
                        log.status === "pending" ? "bg-gold/10 text-gold" :
                        "bg-danger/10 text-danger"
                      }`}>{log.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted text-[10px]">
                      {new Date(log.sent_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {tab === "templates" && (
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(MESSAGE_TEMPLATES).map(([ch, templates]) => (
            <div key={ch} className="card">
              <h3 className="text-xs font-semibold capitalize flex items-center gap-2 mb-3">
                {ch === "email" && <Mail size={13} className="text-info" />}
                {ch === "dm" && <MessageSquare size={13} className="text-gold" />}
                {ch === "sms" && <Smartphone size={13} className="text-success" />}
                {ch === "call" && <Phone size={13} className="text-gold" />}
                {ch} Templates
              </h3>
              <div className="space-y-2">
                {templates.map((tpl) => (
                  <div key={tpl.name} className="p-2.5 rounded-lg bg-surface-light border border-border">
                    <p className="text-[10px] font-medium mb-1">{tpl.name}</p>
                    <p className="text-[9px] text-muted line-clamp-3">{tpl.body}</p>
                    <button
                      onClick={() => { setChannel(ch as Channel); setBody(tpl.body); if ("subject" in tpl) setSubject(tpl.subject || ""); setTab("compose"); }}
                      className="text-[9px] text-gold hover:text-gold-light mt-1.5 flex items-center gap-0.5"
                    >
                      Use template <ArrowRight size={8} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
