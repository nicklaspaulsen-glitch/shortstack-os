"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  MessageSquare, Send, Search, Phone, Mail,
  Sparkles, Loader, User
} from "lucide-react";
import toast from "react-hot-toast";

interface Conversation {
  lead_id: string;
  business_name: string;
  phone: string | null;
  email: string | null;
  last_message: string;
  last_date: string;
  unread: number;
  messages: Message[];
}

interface Message {
  id: string;
  direction: "outbound" | "inbound";
  platform: string;
  text: string;
  status: string;
  date: string;
}

export default function ConversationsPage() {
  useAuth();
  const supabase = createClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [channelFilter, setChannelFilter] = useState<"all" | "sms" | "email" | "dm">("all");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchConversations(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [selected]);

  async function fetchConversations() {
    setLoading(true);

    // Get all outreach logs grouped by lead
    const { data: logs } = await supabase
      .from("outreach_log")
      .select("id, lead_id, platform, message_text, reply_text, status, sent_at, replied_at, business_name")
      .order("sent_at", { ascending: false })
      .limit(500);

    // Group by lead
    const byLead: Record<string, { name: string; phone: string | null; email: string | null; messages: Message[] }> = {};

    (logs || []).forEach(log => {
      const lid = log.lead_id || log.business_name || "unknown";
      if (!byLead[lid]) {
        byLead[lid] = { name: log.business_name || "Unknown", phone: null, email: null, messages: [] };
      }

      // Outbound message
      if (log.message_text) {
        byLead[lid].messages.push({
          id: log.id + "_out",
          direction: "outbound",
          platform: log.platform || "email",
          text: log.message_text,
          status: log.status,
          date: log.sent_at,
        });
      }

      // Inbound reply
      if (log.reply_text) {
        byLead[lid].messages.push({
          id: log.id + "_in",
          direction: "inbound",
          platform: log.platform || "email",
          text: log.reply_text,
          status: "replied",
          date: log.replied_at || log.sent_at,
        });
      }
    });

    const convos: Conversation[] = Object.entries(byLead)
      .map(([leadId, data]) => {
        const sorted = data.messages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const last = sorted[sorted.length - 1];
        return {
          lead_id: leadId,
          business_name: data.name,
          phone: data.phone,
          email: data.email,
          last_message: last?.text?.substring(0, 80) || "",
          last_date: last?.date || "",
          unread: sorted.filter(m => m.direction === "inbound" && m.status !== "read").length,
          messages: sorted,
        };
      })
      .filter(c => c.messages.length > 0)
      .sort((a, b) => new Date(b.last_date).getTime() - new Date(a.last_date).getTime());

    setConversations(convos);
    setLoading(false);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selected) return;
    setSending(true);

    await supabase.from("outreach_log").insert({
      business_name: selected.business_name,
      lead_id: selected.lead_id,
      platform: "sms",
      message_text: newMessage,
      status: "sent",
    });

    toast.success("Message sent!");
    setNewMessage("");
    fetchConversations();
    setSending(false);
  }

  async function generateAIReply() {
    if (!selected || selected.messages.length === 0) return;
    setAiGenerating(true);

    try {
      const lastInbound = [...selected.messages].reverse().find(m => m.direction === "inbound");
      const res = await fetch("/api/agents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Write a short, professional follow-up reply to this message from ${selected.business_name}: "${lastInbound?.text || selected.messages[selected.messages.length - 1].text}". Keep it under 50 words, conversational, and end with a clear next step.`,
          agent_name: "Outreach Agent",
        }),
      });
      const data = await res.json();
      setNewMessage(data.result || "");
    } catch { toast.error("Failed to generate"); }
    setAiGenerating(false);
  }

  function formatTime(date: string) {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const filtered = conversations.filter(c => {
    if (!c.business_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (channelFilter === "all") return true;
    if (channelFilter === "dm") return c.messages.some(m => ["instagram", "facebook", "linkedin", "tiktok"].includes(m.platform));
    return c.messages.some(m => m.platform === channelFilter);
  });

  return (
    <div className="fade-in flex h-[calc(100vh-120px)]">
      {/* Conversation list */}
      <div className="w-80 shrink-0 border-r border-white/[0.04] flex flex-col">
        <div className="p-3 border-b border-white/[0.04]">
          <h1 className="text-sm font-bold mb-2 flex items-center gap-2">
            <MessageSquare size={16} className="text-gold" /> Conversations
          </h1>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/50" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="input w-full text-xs pl-8 py-1.5" placeholder="Search..." />
          </div>
          <div className="flex gap-1 px-3 pt-2">
            {(["all", "sms", "email", "dm"] as const).map(ch => (
              <button key={ch} onClick={() => setChannelFilter(ch)}
                className={`text-[8px] px-2 py-1 rounded capitalize transition-all ${
                  channelFilter === ch ? "bg-gold/10 text-gold" : "text-muted"
                }`}>{ch === "dm" ? "Social DMs" : ch}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader size={16} className="animate-spin text-gold" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[10px] text-muted">No conversations yet</div>
          ) : (
            filtered.map(convo => (
              <button key={convo.lead_id} onClick={() => setSelected(convo)}
                className={`w-full text-left px-3 py-3 border-b border-white/[0.03] transition-colors ${
                  selected?.lead_id === convo.lead_id ? "bg-gold/[0.04]" : "hover:bg-white/[0.02]"
                }`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold truncate">{convo.business_name}</span>
                  <span className="text-[9px] text-muted shrink-0">{formatTime(convo.last_date)}</span>
                </div>
                <p className="text-[10px] text-muted truncate">{convo.last_message}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[8px] text-muted">{convo.messages.length} msgs</span>
                  {convo.unread > 0 && (
                    <span className="text-[7px] bg-gold text-black px-1.5 py-0.5 rounded-full font-bold">{convo.unread}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat view */}
      <div className="flex-1 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={32} className="mx-auto mb-3 text-muted/20" />
              <p className="text-sm text-muted">Select a conversation</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(184,152,64,0.1)" }}>
                  <User size={16} className="text-gold" />
                </div>
                <div>
                  <p className="text-sm font-bold">{selected.business_name}</p>
                  <p className="text-[10px] text-muted">{selected.messages.length} messages · {selected.phone || selected.email || "No contact"}</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                {selected.phone && (
                  <a href={`tel:${selected.phone}`} className="btn-ghost p-2"><Phone size={14} /></a>
                )}
                {selected.email && (
                  <a href={`mailto:${selected.email}`} className="btn-ghost p-2"><Mail size={14} /></a>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {selected.messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-xl px-3.5 py-2.5 ${
                    msg.direction === "outbound"
                      ? "bg-gold/10 border border-gold/15"
                      : "border border-white/[0.06]"
                  }`} style={msg.direction === "inbound" ? { background: "rgba(255,255,255,0.03)" } : {}}>
                    <p className="text-[11px] leading-relaxed">{msg.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[8px] text-muted">{formatTime(msg.date)}</span>
                      <span className="text-[8px] text-muted capitalize">{msg.platform}</span>
                      {msg.direction === "outbound" && (
                        <span className={`text-[8px] ${msg.status === "replied" ? "text-success" : msg.status === "sent" ? "text-blue-400" : "text-muted"}`}>
                          {msg.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-white/[0.04]">
              <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                <button type="button" onClick={generateAIReply} disabled={aiGenerating}
                  className="btn-ghost p-2 shrink-0" title="AI suggest reply">
                  {aiGenerating ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} className="text-gold" />}
                </button>
                <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                  className="input flex-1 text-xs" placeholder="Type a message..." disabled={sending} />
                <button type="submit" disabled={!newMessage.trim() || sending}
                  className="btn-primary p-2.5 disabled:opacity-30">
                  <Send size={14} />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
