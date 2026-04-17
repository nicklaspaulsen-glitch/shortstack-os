"use client";

import { useState } from "react";
import {
  MessageSquare, Send, FileText, RefreshCw, Inbox,
  ArrowUpRight, ArrowDownLeft, Users, Clock, Image,
  CheckCircle, Plus, Bot, BarChart3,
  Calendar, Zap, Search, Eye
} from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/platform-icons";

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

interface WMessage {
  id: string;
  to: string;
  from: string;
  body: string;
  status: string;
  direction: string;
  date_sent: string;
  media_type?: string;
}

interface WTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  body: string;
}

const MOCK_MESSAGES: WMessage[] = [];

const MOCK_TEMPLATES: WTemplate[] = [];

const CONTACT_LABELS = [
  { label: "Active Client", count: 0, color: "bg-green-400" },
  { label: "Prospect", count: 0, color: "bg-blue-400" },
  { label: "Hot Lead", count: 0, color: "bg-red-400" },
  { label: "VIP", count: 0, color: "bg-gold" },
  { label: "Inactive", count: 0, color: "bg-gray-400" },
];

const BROADCAST_LISTS: { id: string; name: string; contacts: number; lastSent: string }[] = [];

const AUTO_RESPONDER_RULES: { id: string; trigger: string; response: string; enabled: boolean }[] = [];

const SCHEDULED_MESSAGES: { id: string; to: string; message: string; scheduledAt: string; status: string }[] = [];

const CHAT_ANALYTICS = {
  totalSent: 0, totalReceived: 0, responseRate: "0%",
  avgResponseTime: "--", readRate: "0%", deliveryRate: "0%",
  byDay: [0, 0, 0, 0, 0, 0, 0],
};

const QUICK_REPLIES: { id: string; label: string; text: string }[] = [];

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function WhatsAppPage() {
  const [activeTab, setActiveTab] = useState<"inbox" | "send" | "templates" | "broadcast" | "automation" | "analytics">("inbox");
  const [sendTo, setSendTo] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaType, setMediaType] = useState<"text" | "image" | "document">("text");
  const [selectedBroadcast, setSelectedBroadcast] = useState("");

  const filteredMessages = MOCK_MESSAGES.filter(m =>
    !searchQuery || m.body.toLowerCase().includes(searchQuery.toLowerCase()) || m.from.includes(searchQuery) || m.to.includes(searchQuery)
  );

  const tabs = [
    { id: "inbox" as const, label: "Inbox", icon: Inbox },
    { id: "send" as const, label: "Send", icon: Send },
    { id: "templates" as const, label: "Templates", icon: FileText },
    { id: "broadcast" as const, label: "Broadcast", icon: Users },
    { id: "automation" as const, label: "Automation", icon: Bot },
    { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden">
            <WhatsAppIcon size={40} />
          </div>
          <div>
            <h1 className="text-lg font-bold">WhatsApp Business</h1>
            <p className="text-xs text-muted">Messages, templates, broadcasts & automation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-lg bg-green-400/10 text-green-400 border border-green-400/15">
            <CheckCircle size={10} /> API Connected
          </span>
          <button className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted flex items-center gap-1.5">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <div className="card p-2 text-center">
          <p className="text-lg font-bold font-mono">{CHAT_ANALYTICS.totalSent}</p>
          <p className="text-[9px] text-muted">Sent</p>
        </div>
        <div className="card p-2 text-center">
          <p className="text-lg font-bold font-mono">{CHAT_ANALYTICS.totalReceived}</p>
          <p className="text-[9px] text-muted">Received</p>
        </div>
        <div className="card p-2 text-center">
          <p className="text-lg font-bold font-mono text-green-400">{CHAT_ANALYTICS.responseRate}</p>
          <p className="text-[9px] text-muted">Response Rate</p>
        </div>
        <div className="card p-2 text-center">
          <p className="text-lg font-bold font-mono">{CHAT_ANALYTICS.avgResponseTime}</p>
          <p className="text-[9px] text-muted">Avg Response</p>
        </div>
        <div className="card p-2 text-center">
          <p className="text-lg font-bold font-mono text-blue-400">{CHAT_ANALYTICS.readRate}</p>
          <p className="text-[9px] text-muted">Read Rate</p>
        </div>
        <div className="card p-2 text-center">
          <p className="text-lg font-bold font-mono text-gold">{CHAT_ANALYTICS.deliveryRate}</p>
          <p className="text-[9px] text-muted">Delivery Rate</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all border ${
              activeTab === t.id ? "bg-[#25D366]/10 border-[#25D366]/20 text-[#25D366] font-medium" : "border-border text-muted hover:text-foreground"
            }`}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* ---- TAB: Inbox ---- */}
      {activeTab === "inbox" && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 pl-8 text-xs text-foreground" placeholder="Search messages..." />
          </div>
          {/* Contact labels */}
          <div className="flex gap-2 overflow-x-auto">
            {CONTACT_LABELS.map(l => (
              <div key={l.label} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border text-[9px] whitespace-nowrap shrink-0">
                <div className={`w-2 h-2 rounded-full ${l.color}`} />
                <span>{l.label}</span>
                <span className="text-muted">({l.count})</span>
              </div>
            ))}
          </div>
          {filteredMessages.map(msg => (
            <div key={msg.id} className="card p-3 flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                msg.direction === "inbound" ? "bg-[#25D366]/10 text-[#25D366]" : "bg-blue-400/10 text-blue-400"
              }`}>
                {msg.direction === "inbound" ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[10px] text-muted">
                  <span className="font-medium text-foreground">{msg.direction === "inbound" ? msg.from : msg.to}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] ${
                    msg.status === "read" ? "bg-blue-400/10 text-blue-400" :
                    msg.status === "delivered" ? "bg-green-400/10 text-green-400" :
                    "bg-white/5 text-muted"
                  }`}>{msg.status} {msg.status === "read" && <Eye size={7} className="inline" />}</span>
                  <span>{new Date(msg.date_sent).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="text-xs mt-1 text-muted">{msg.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- TAB: Send ---- */}
      {activeTab === "send" && (
        <div className="space-y-4">
          <div className="card p-4 space-y-4">
            <h2 className="text-xs font-semibold">Send WhatsApp Message</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Recipient Phone *</label>
                <input value={sendTo} onChange={e => setSendTo(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" placeholder="+1234567890" />
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Message Type</label>
                <div className="flex gap-1.5">
                  {(["text", "image", "document"] as const).map(t => (
                    <button key={t} onClick={() => setMediaType(t)}
                      className={`flex-1 text-[10px] py-1.5 rounded-lg border capitalize transition-all flex items-center justify-center gap-1 ${
                        mediaType === t ? "border-[#25D366]/30 bg-[#25D366]/10 text-[#25D366]" : "border-border text-muted"
                      }`}>
                      {t === "image" ? <Image size={10} /> : t === "document" ? <FileText size={10} /> : <MessageSquare size={10} />}
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Message *</label>
              <textarea value={sendMessage} onChange={e => setSendMessage(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground h-24" placeholder="Type your message..." />
            </div>
            {/* Quick Reply Buttons */}
            <div>
              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Quick Replies</label>
              <div className="flex gap-1.5 flex-wrap">
                {QUICK_REPLIES.map(qr => (
                  <button key={qr.id} onClick={() => setSendMessage(qr.text)}
                    className="text-[10px] px-2.5 py-1 rounded-lg border border-border text-muted hover:text-[#25D366] hover:border-[#25D366]/20 transition-all">
                    {qr.label}
                  </button>
                ))}
              </div>
            </div>
            <button disabled={!sendTo || !sendMessage}
              className="px-4 py-2 rounded-lg bg-[#25D366] text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5">
              <Send size={12} /> Send Message
            </button>
          </div>

          {/* Message Scheduling */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Calendar size={12} className="text-[#25D366]" /> Scheduled Messages</h3>
            <div className="space-y-2">
              {SCHEDULED_MESSAGES.map(sm => (
                <div key={sm.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-xs font-medium">To: {sm.to}</p>
                    <p className="text-[10px] text-muted truncate max-w-[300px]">{sm.message}</p>
                    <p className="text-[9px] text-muted flex items-center gap-1 mt-0.5"><Clock size={8} /> {new Date(sm.scheduledAt).toLocaleString()}</p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded ${
                    sm.status === "scheduled" ? "bg-green-400/10 text-green-400" : "bg-yellow-400/10 text-yellow-400"
                  }`}>{sm.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Templates ---- */}
      {activeTab === "templates" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold flex items-center gap-2"><FileText size={12} className="text-[#25D366]" /> WhatsApp Templates</h2>
            <button className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-[10px] font-semibold flex items-center gap-1"><Plus size={10} /> New Template</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {MOCK_TEMPLATES.map(t => (
              <div key={t.id} className="card p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium">{t.name}</p>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                    t.status === "APPROVED" ? "bg-green-400/10 text-green-400" : "bg-yellow-400/10 text-yellow-400"
                  }`}>{t.status}</span>
                </div>
                <p className="text-[10px] text-muted mb-1">{t.body}</p>
                <div className="flex items-center gap-2 text-[9px] text-muted">
                  <span>{t.category}</span>
                  <span>&middot;</span>
                  <span>{t.language}</span>
                </div>
                <button className="mt-2 text-[10px] px-2 py-1 rounded border border-border text-muted hover:text-[#25D366] flex items-center gap-1">
                  <Send size={8} /> Use Template
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- TAB: Broadcast ---- */}
      {activeTab === "broadcast" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Users size={12} className="text-[#25D366]" /> Broadcast Lists</h3>
            <div className="space-y-2">
              {BROADCAST_LISTS.map(bl => (
                <div key={bl.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                  selectedBroadcast === bl.id ? "border-[#25D366]/30 bg-[#25D366]/[0.03]" : "border-border"
                }`} onClick={() => setSelectedBroadcast(bl.id)}>
                  <div>
                    <p className="text-xs font-medium">{bl.name}</p>
                    <p className="text-[10px] text-muted">{bl.contacts} contacts &middot; Last sent: {bl.lastSent}</p>
                  </div>
                  <button className="px-2 py-1 rounded-lg bg-[#25D366] text-white text-[10px] font-medium flex items-center gap-1"><Send size={8} /> Send</button>
                </div>
              ))}
            </div>
          </div>

          {/* Bulk Messaging */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Zap size={12} className="text-[#25D366]" /> Bulk Messaging</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Select List</label>
                <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                  <option value="">Choose a broadcast list...</option>
                  {BROADCAST_LISTS.map(bl => <option key={bl.id} value={bl.id}>{bl.name} ({bl.contacts} contacts)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Template</label>
                <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                  <option value="">Choose a template...</option>
                  {MOCK_TEMPLATES.filter(t => t.status === "APPROVED").map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <button className="px-4 py-2 rounded-lg bg-[#25D366] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
                <Send size={12} /> Send to List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Automation ---- */}
      {activeTab === "automation" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Bot size={12} className="text-[#25D366]" /> Auto-Responder Rules</h3>
            <div className="space-y-2">
              {AUTO_RESPONDER_RULES.map(rule => (
                <div key={rule.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className={`w-2 h-2 rounded-full ${rule.enabled ? "bg-green-400" : "bg-white/20"}`} />
                  <div className="flex-1">
                    <p className="text-xs font-medium">{rule.trigger}</p>
                    <p className="text-[10px] text-muted">{rule.response}</p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded ${rule.enabled ? "bg-green-400/10 text-green-400" : "bg-white/5 text-muted"}`}>
                    {rule.enabled ? "Active" : "Off"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Assignment */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Users size={12} className="text-[#25D366]" /> Chat Assignment Rules</h3>
            <div className="space-y-2">
              {[
                { label: "New leads", assignee: "Sales Team", rule: "Round-robin" },
                { label: "Existing clients", assignee: "Account Manager", rule: "Assigned client rep" },
                { label: "Support queries", assignee: "Support Team", rule: "First available" },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between p-2 rounded-lg border border-border">
                  <span className="text-[10px] font-medium">{r.label}</span>
                  <span className="text-[10px] text-muted">{r.assignee} ({r.rule})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Analytics ---- */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><BarChart3 size={12} className="text-[#25D366]" /> Messages by Day</h3>
            <div className="flex items-end gap-2 h-24">
              {CHAT_ANALYTICS.byDay.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[8px] text-muted">{v}</span>
                  <div className="w-full rounded-t bg-[#25D366]/30" style={{ height: `${(v / Math.max(...CHAT_ANALYTICS.byDay)) * 100}%` }} />
                  <span className="text-[8px] text-muted">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Read receipts tracker */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Eye size={12} className="text-[#25D366]" /> Read Receipts Tracker</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-border text-center">
                <p className="text-lg font-bold text-green-400">{CHAT_ANALYTICS.deliveryRate}</p>
                <p className="text-[10px] text-muted">Delivered</p>
              </div>
              <div className="p-3 rounded-lg border border-border text-center">
                <p className="text-lg font-bold text-blue-400">{CHAT_ANALYTICS.readRate}</p>
                <p className="text-[10px] text-muted">Read</p>
              </div>
              <div className="p-3 rounded-lg border border-border text-center">
                <p className="text-lg font-bold text-gold">{CHAT_ANALYTICS.responseRate}</p>
                <p className="text-[10px] text-muted">Replied</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
