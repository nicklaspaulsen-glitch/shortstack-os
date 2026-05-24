"use client";
import { ArrowRight, Chat, CheckCircle, CircleNotch, Clock, DeviceMobile, Envelope, Globe, Lightning, PaperPlaneTilt, Phone, Robot, Sparkle, Target, XCircle } from "@phosphor-icons/react";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { MotionPage } from "@/components/motion/motion-page";

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
    { id: "email", label: "Email", icon: <Envelope size={14} />, color: "text-indigo-400" },
    { id: "dm", label: "Social DMs", icon: <Chat size={14} />, color: "text-indigo-400" },
    { id: "sms", label: "SMS", icon: <DeviceMobile size={14} />, color: "text-emerald-400" },
    { id: "call", label: "AI Call", icon: <Phone size={14} />, color: "text-indigo-400" },
  ];

  return (
    <MotionPage className="space-y-6">{/* Header */}<div>
              <h1 className="text-xl font-bold flex items-center gap-2 text-text-primary">
                <PaperPlaneTilt size={20} className="text-indigo-400" />
                Outreach Center
              </h1>
              <p className="text-xs text-text-muted mt-1">Launch multi-channel campaigns with AI-personalized messages</p>
            </div>{/* Stats */}<div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4">
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-start gap-3 bg-white/[0.06] border border-border-subtle rounded-2xl p-5 shadow-[0_2px_16px_rgba(0,0,0,0.35)]">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Sent</p>
                  <p className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary tabular-nums">{stats.sent}</p>
                  <p className="text-[11px] text-text-muted mt-1.5">messages delivered</p>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="bg-white/[0.06] border border-border-subtle rounded-2xl p-5 shadow-[0_2px_16px_rgba(0,0,0,0.35)]">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Replied</p>
                <p className="font-display text-2xl font-bold tracking-[-0.02em] text-emerald-400 tabular-nums">{stats.replied}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="bg-white/[0.06] border border-border-subtle rounded-2xl p-5 shadow-[0_2px_16px_rgba(0,0,0,0.35)]">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Pending</p>
                <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{stats.pending}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="bg-white/[0.06] border border-border-subtle rounded-2xl p-5 shadow-[0_2px_16px_rgba(0,0,0,0.35)]">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Failed</p>
                <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{stats.failed}</p>
              </motion.div>
            </div>{/* Channel Selector */}<div className="flex flex-wrap gap-2">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => { setChannel(ch.id); setSelectedTemplate(0); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    channel === ch.id
                      ? "bg-indigo-500/[0.10] text-indigo-400 border border-indigo-500/[0.20]"
                      : "bg-white/[0.06] text-text-muted hover:text-text-primary border border-border-subtle"
                  }`}
                >
                  {ch.icon} {ch.label}
                </button>
              ))}
            </div>{/* Tab nav */}<div className="flex gap-4 border-b border-border-subtle">
              {(["compose", "history", "templates"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`pb-2 text-xs font-medium capitalize transition-colors border-b-2 ${
                    tab === t ? "text-indigo-400 border-indigo-400" : "text-text-muted border-transparent hover:text-text-primary"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>{/* Compose Tab */}{tab === "compose" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main compose area */}
                <div className="col-span-2 space-y-3">
                  {channel === "email" && (
                    <div>
                      <label className="text-[9px] text-text-muted uppercase tracking-wider block mb-1">Subject Line</label>
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
                    <label className="text-[9px] text-text-muted uppercase tracking-wider block mb-1">
                      {channel === "call" ? "Call Script" : "Message Body"}
                    </label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={channel === "call" ? 6 : 8}
                      className="input w-full text-xs resize-none"
                      placeholder="Type your message..."
                    />
                    <p className="text-[9px] text-text-muted mt-1">
                      Variables: {"{business_name}"}, {"{name}"}, {"{industry}"}, {"{my_name}"}
                    </p>
                  </div>

                  {/* Launch button */}
                  <button
                    onClick={sendCampaign}
                    disabled={sending}
                    className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
                  >
                    {sending ? <CircleNotch size={14} className="animate-spin" /> : <Lightning size={14} />}
                    {sending ? "Launching..." : `Launch ${channel === "email" ? "Email" : channel === "dm" ? "DM" : channel === "sms" ? "SMS" : "Call"} Campaign`}
                  </button>
                </div>

                {/* Config sidebar */}
                <div className="space-y-3">
                  <div className="glass rounded-xl p-4">
                    <h3 className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Campaign Settings</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[9px] text-text-muted uppercase block mb-1">Batch Size</label>
                        <input type="number" value={batchSize} onChange={(e) => setBatchSize(+e.target.value)}
                          className="input w-full text-xs" min={1} max={100} />
                      </div>
                      <div>
                        <label className="text-[9px] text-text-muted uppercase block mb-1">Target Leads</label>
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
                          className="w-3.5 h-3.5 rounded border-border-subtle" />
                        <span className="text-[10px] flex items-center gap-1">
                          <Sparkle size={10} className="text-indigo-400" /> AI Personalization
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Template picker */}
                  <div className="glass rounded-xl p-4">
                    <h3 className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Quick Templates</h3>
                    <div className="space-y-1.5">
                      {MESSAGE_TEMPLATES[channel].map((tpl, i) => (
                        <button
                          key={tpl.name}
                          onClick={() => setSelectedTemplate(i)}
                          className={`w-full text-left px-2.5 py-2 rounded-lg text-[10px] transition-colors ${
                            selectedTemplate === i
                              ? "bg-indigo-500/[0.10] text-indigo-400 border border-indigo-500/[0.20]"
                              : "bg-white/[0.06] text-text-muted hover:text-text-primary"
                          }`}
                        >
                          {tpl.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {channel === "dm" && (
                    <div className="glass rounded-xl p-4 bg-indigo-500/[0.10] border-indigo-500/[0.20]">
                      <p className="text-[10px] text-indigo-400 flex items-center gap-1 mb-1">
                        <Globe size={10} /> Chrome Extension Required
                      </p>
                      <p className="text-[9px] text-text-muted">
                        Social DMs are sent through the browser extension. Make sure it is installed and your accounts are logged in.
                      </p>
                    </div>
                  )}

                  {channel === "call" && (
                    <div className="glass rounded-xl p-4 bg-indigo-500/[0.10] border-indigo-500/[0.20]">
                      <p className="text-[10px] text-indigo-400 flex items-center gap-1 mb-1">
                        <Robot size={10} /> AI-Powered Calls
                      </p>
                      <p className="text-[9px] text-text-muted">
                        Calls use AI voice agents. Each lead will receive a natural conversation following your script.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}{/* History Tab */}{tab === "history" && (
              <div className="glass rounded-xl overflow-hidden">
                {loadingHistory ? (
                  <div className="text-center py-12 text-text-muted">
                    <CircleNotch size={16} className="animate-spin mx-auto mb-2" /> Loading history...
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-12 text-text-muted">
                    <PaperPlaneTilt size={20} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No outreach history yet. Launch your first campaign above.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border-subtle bg-white/[0.06]">
                        <th className="px-3 py-2.5 text-left text-[9px] uppercase tracking-wider text-text-muted font-semibold">Business</th>
                        <th className="px-3 py-2.5 text-left text-[9px] uppercase tracking-wider text-text-muted font-semibold">Channel</th>
                        <th className="px-3 py-2.5 text-left text-[9px] uppercase tracking-wider text-text-muted font-semibold">Message</th>
                        <th className="px-3 py-2.5 text-center text-[9px] uppercase tracking-wider text-text-muted font-semibold">Status</th>
                        <th className="px-3 py-2.5 text-right text-[9px] uppercase tracking-wider text-text-muted font-semibold">Sent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((log) => (
                        <tr key={log.id} className="border-b border-border-subtle hover:bg-white/[0.06]">
                          <td className="px-3 py-2.5 font-medium text-text-primary">{log.business_name}</td>
                          <td className="px-3 py-2.5 capitalize text-text-muted">{log.platform}</td>
                          <td className="px-3 py-2.5 text-text-muted max-w-[200px] truncate">{log.message_text}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                              log.status === "sent" ? "bg-indigo-500/[0.10] text-indigo-400" :
                              log.status === "replied" ? "bg-emerald-500/[0.10] text-emerald-400" :
                              log.status === "pending" ? "bg-amber-500/[0.10] text-amber-400" :
                              "bg-red-500/[0.10] text-red-400"
                            }`}>{log.status}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-text-muted text-[10px]">
                            {new Date(log.sent_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            )}{/* Templates Tab */}{tab === "templates" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(MESSAGE_TEMPLATES).map(([ch, templates]) => (
                  <div key={ch} className="glass rounded-xl p-4">
                    <h3 className="text-xs font-semibold capitalize flex items-center gap-2 mb-3 text-text-primary">
                      {ch === "email" && <Envelope size={13} className="text-indigo-400" />}
                      {ch === "dm" && <Chat size={13} className="text-indigo-400" />}
                      {ch === "sms" && <DeviceMobile size={13} className="text-emerald-400" />}
                      {ch === "call" && <Phone size={13} className="text-indigo-400" />}
                      {ch} Templates
                    </h3>
                    <div className="space-y-2">
                      {templates.map((tpl) => (
                        <div key={tpl.name} className="p-2.5 rounded-lg bg-white/[0.06] border border-border-subtle">
                          <p className="text-[10px] font-medium mb-1 text-text-primary">{tpl.name}</p>
                          <p className="text-[11px] text-text-muted line-clamp-3">{tpl.body}</p>
                          <button
                            onClick={() => { setChannel(ch as Channel); setBody(tpl.body); if ("subject" in tpl) setSubject(tpl.subject || ""); setTab("compose"); }}
                            className="text-[9px] text-indigo-400 hover:text-indigo-400 mt-1.5 flex items-center gap-0.5"
                          >
                            Use template <ArrowRight size={8} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}</MotionPage>
  );
}
