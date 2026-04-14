"use client";

import { useState, useRef } from "react";
import {
  MessageSquare, Send, Search, Phone, Mail, Sparkles, User,
  Tag, Flag, Clock, CheckCircle, AlertCircle, Users, Star,
  Smile, Frown, Meh, Archive, Pin, FileText,
  Hash, AtSign, MessageCircle
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

interface Message {
  id: string;
  direction: "outbound" | "inbound";
  platform: string;
  text: string;
  status: string;
  date: string;
  sender?: string;
}

interface Conversation {
  lead_id: string;
  business_name: string;
  phone: string | null;
  email: string | null;
  last_message: string;
  last_date: string;
  unread: number;
  messages: Message[];
  status: "open" | "pending" | "resolved";
  priority: "high" | "medium" | "low";
  assignee: string;
  tags: string[];
  sentiment: "positive" | "neutral" | "negative";
  avgResponseTime: string;
  internalNotes: string[];
}

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    lead_id: "l1", business_name: "Sunrise Bakery", phone: "+1 555-0123", email: "emma@sunrise.com",
    last_message: "That sounds great! When can we start?", last_date: "2026-04-14T10:30:00Z", unread: 2,
    status: "open", priority: "high", assignee: "Alex M.", tags: ["hot-lead", "content"], sentiment: "positive", avgResponseTime: "12m",
    internalNotes: ["Very interested in content package", "Budget: $3k/mo"],
    messages: [
      { id: "m1", direction: "outbound", platform: "email", text: "Hi Emma! I wanted to follow up on our conversation about social media management for Sunrise Bakery.", status: "delivered", date: "2026-04-13T09:00:00Z" },
      { id: "m2", direction: "inbound", platform: "email", text: "Hi! Yes, I've been thinking about it. What packages do you offer?", status: "read", date: "2026-04-13T14:22:00Z", sender: "Emma Liu" },
      { id: "m3", direction: "outbound", platform: "email", text: "Great question! We have three tiers: Starter ($1,200/mo), Growth ($2,500/mo), and Scale ($4,000/mo). Based on your goals, I'd recommend Growth.", status: "delivered", date: "2026-04-13T14:45:00Z" },
      { id: "m4", direction: "inbound", platform: "email", text: "The Growth package sounds perfect. Can you send me a proposal?", status: "read", date: "2026-04-14T08:15:00Z", sender: "Emma Liu" },
      { id: "m5", direction: "outbound", platform: "email", text: "Absolutely! I'll have a custom proposal ready by end of day. It'll include content calendar, strategy overview, and expected results.", status: "sent", date: "2026-04-14T09:00:00Z" },
      { id: "m6", direction: "inbound", platform: "email", text: "That sounds great! When can we start?", status: "unread", date: "2026-04-14T10:30:00Z", sender: "Emma Liu" },
    ],
  },
  {
    lead_id: "l2", business_name: "Metro Legal Group", phone: "+1 555-0456", email: "james@metrolegal.com",
    last_message: "I need to discuss this with my partner first", last_date: "2026-04-12T16:00:00Z", unread: 0,
    status: "pending", priority: "medium", assignee: "Sarah K.", tags: ["follow-up", "legal"], sentiment: "neutral", avgResponseTime: "2h 15m",
    internalNotes: ["Decision maker is the senior partner", "Needs case studies for legal industry"],
    messages: [
      { id: "m7", direction: "outbound", platform: "sms", text: "Hi James, just checking in on the marketing proposal we sent last week.", status: "delivered", date: "2026-04-12T10:00:00Z" },
      { id: "m8", direction: "inbound", platform: "sms", text: "I need to discuss this with my partner first", status: "read", date: "2026-04-12T16:00:00Z", sender: "James Park" },
    ],
  },
  {
    lead_id: "l3", business_name: "FreshCuts Barbershop", phone: "+1 555-0789", email: "jamal@freshcuts.com",
    last_message: "Your prices are too high for us right now", last_date: "2026-04-11T11:30:00Z", unread: 0,
    status: "open", priority: "low", assignee: "Alex M.", tags: ["price-sensitive"], sentiment: "negative", avgResponseTime: "45m",
    internalNotes: ["Offered 15% discount - declined", "May revisit in Q3"],
    messages: [
      { id: "m9", direction: "outbound", platform: "instagram", text: "Hey Jamal! Love the content you've been posting. We could help amplify your reach.", status: "delivered", date: "2026-04-10T15:00:00Z" },
      { id: "m10", direction: "inbound", platform: "instagram", text: "Thanks! What would that cost?", status: "read", date: "2026-04-10T17:30:00Z", sender: "Jamal Brooks" },
      { id: "m11", direction: "outbound", platform: "instagram", text: "Our starter package is $1,200/mo and includes social management, content creation, and basic ads.", status: "delivered", date: "2026-04-11T09:00:00Z" },
      { id: "m12", direction: "inbound", platform: "instagram", text: "Your prices are too high for us right now", status: "read", date: "2026-04-11T11:30:00Z", sender: "Jamal Brooks" },
    ],
  },
  {
    lead_id: "l4", business_name: "Elite Auto Detailing", phone: "+1 555-1234", email: "carlos@eliteauto.com",
    last_message: "Can you schedule a call for Thursday?", last_date: "2026-04-14T08:00:00Z", unread: 1,
    status: "open", priority: "high", assignee: "Sarah K.", tags: ["upsell", "existing-client"], sentiment: "positive", avgResponseTime: "8m",
    internalNotes: ["Current Growth client", "Interested in adding paid ads"],
    messages: [
      { id: "m13", direction: "inbound", platform: "sms", text: "Hey, I wanted to talk about adding paid ads to our package.", status: "read", date: "2026-04-13T16:00:00Z", sender: "Carlos Reyes" },
      { id: "m14", direction: "outbound", platform: "sms", text: "That's great to hear Carlos! Paid ads would be a perfect addition. Want to hop on a call to discuss?", status: "delivered", date: "2026-04-13T16:15:00Z" },
      { id: "m15", direction: "inbound", platform: "sms", text: "Can you schedule a call for Thursday?", status: "unread", date: "2026-04-14T08:00:00Z", sender: "Carlos Reyes" },
    ],
  },
  {
    lead_id: "l5", business_name: "CloudTech Solutions", phone: null, email: "priya@cloudtech.io",
    last_message: "We'll pass for now, thanks", last_date: "2026-04-08T09:00:00Z", unread: 0,
    status: "resolved", priority: "low", assignee: "Alex M.", tags: ["lost", "tech"], sentiment: "negative", avgResponseTime: "1h 30m",
    internalNotes: ["Lost to competitor", "Re-engage in 3 months"],
    messages: [
      { id: "m16", direction: "outbound", platform: "linkedin", text: "Hi Priya, I noticed CloudTech has been growing fast. We help tech companies scale their marketing.", status: "delivered", date: "2026-04-07T10:00:00Z" },
      { id: "m17", direction: "inbound", platform: "linkedin", text: "We'll pass for now, thanks", status: "read", date: "2026-04-08T09:00:00Z", sender: "Priya Sharma" },
    ],
  },
];

const CANNED_RESPONSES = [
  { id: "cr1", name: "Introduction", text: "Hi {name}! I'm {agent} from ShortStack Digital. I noticed {business} and thought we could help you grow your online presence." },
  { id: "cr2", name: "Follow Up", text: "Hey {name}, just circling back on my last message. I'd love to show you how we've helped similar businesses increase their leads by 40%+." },
  { id: "cr3", name: "Pricing", text: "Great question! Our packages start at $1,200/mo for Starter, $2,500/mo for Growth, and $4,000/mo for Scale. Happy to walk through which fits best." },
  { id: "cr4", name: "Case Study", text: "Absolutely! Let me send you a case study from a {industry} business we helped go from 10 leads/mo to 50+ in just 3 months." },
  { id: "cr5", name: "Schedule Call", text: "I'd love to hop on a quick 15-min call to discuss your goals. Here's my calendar link: [calendar_link]" },
  { id: "cr6", name: "Thank You", text: "Thanks so much for your time, {name}! I'll send over the proposal by end of day. Looking forward to working together!" },
  { id: "cr7", name: "Re-engage", text: "Hi {name}! It's been a while since we last chatted. I wanted to share some new results we've been getting for {industry} businesses." },
  { id: "cr8", name: "Objection - Price", text: "I totally understand budget considerations. We also offer a lighter package at $800/mo that covers the essentials. Want to hear more?" },
];

const CONVERSATION_TAGS = [
  "hot-lead", "warm-lead", "cold-lead", "follow-up", "upsell", "existing-client",
  "price-sensitive", "decision-maker", "content", "ads", "seo", "lost", "legal", "tech",
];

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function ConversationsPage() {
  const [conversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [search, setSearch] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [channelFilter, setChannelFilter] = useState<"all" | "sms" | "email" | "dm">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "pending" | "resolved">("all");
  const [activePanel, setActivePanel] = useState<"chat" | "templates" | "notes">("chat");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newNote, setNewNote] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  function getSentimentIcon(s: string) {
    if (s === "positive") return <Smile size={12} className="text-green-400" />;
    if (s === "negative") return <Frown size={12} className="text-red-400" />;
    return <Meh size={12} className="text-yellow-400" />;
  }

  function getPlatformIcon(p: string) {
    if (p === "email") return <Mail size={10} />;
    if (p === "sms") return <Phone size={10} />;
    if (p === "instagram") return <Hash size={10} />;
    if (p === "linkedin") return <AtSign size={10} />;
    return <MessageCircle size={10} />;
  }

  const filtered = conversations.filter(c => {
    if (!c.business_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (channelFilter === "all") return true;
    if (channelFilter === "dm") return c.messages.some(m => ["instagram", "facebook", "linkedin", "tiktok"].includes(m.platform));
    return c.messages.some(m => m.platform === channelFilter);
  });

  const openCount = conversations.filter(c => c.status === "open").length;
  const pendingCount = conversations.filter(c => c.status === "pending").length;

  return (
    <div className="fade-in flex h-[calc(100vh-120px)]">
      {/* Conversation list */}
      <div className="w-80 shrink-0 border-r border-white/[0.04] flex flex-col">
        <div className="p-3 border-b border-white/[0.04]">
          <h1 className="text-sm font-bold mb-2 flex items-center gap-2">
            <MessageSquare size={16} className="text-gold" /> Conversations
            <span className="text-[9px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full">{openCount} open</span>
          </h1>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/50" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 pl-8 text-xs text-foreground" placeholder="Search conversations..." />
          </div>
          {/* Channel filter */}
          <div className="flex gap-1 pt-2">
            {(["all", "sms", "email", "dm"] as const).map(ch => (
              <button key={ch} onClick={() => setChannelFilter(ch)}
                className={`text-[8px] px-2 py-1 rounded capitalize transition-all ${
                  channelFilter === ch ? "bg-gold/10 text-gold" : "text-muted"
                }`}>{ch === "dm" ? "Social" : ch}</button>
            ))}
          </div>
          {/* Status filter */}
          <div className="flex gap-1 pt-1">
            {(["all", "open", "pending", "resolved"] as const).map(st => (
              <button key={st} onClick={() => setStatusFilter(st)}
                className={`text-[8px] px-2 py-1 rounded capitalize transition-all ${
                  statusFilter === st ? "bg-gold/10 text-gold" : "text-muted"
                }`}>
                {st === "all" ? `All (${conversations.length})` :
                 st === "open" ? `Open (${openCount})` :
                 st === "pending" ? `Pending (${pendingCount})` :
                 `Resolved (${conversations.filter(c => c.status === "resolved").length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-[10px] text-muted">No conversations match filters</div>
          ) : (
            filtered.map(convo => (
              <button key={convo.lead_id} onClick={() => setSelected(convo)}
                className={`w-full text-left px-3 py-3 border-b border-white/[0.03] transition-colors ${
                  selected?.lead_id === convo.lead_id ? "bg-gold/[0.04]" : "hover:bg-white/[0.02]"
                }`}>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold truncate">{convo.business_name}</span>
                    {getSentimentIcon(convo.sentiment)}
                  </div>
                  <span className="text-[9px] text-muted shrink-0">{formatTime(convo.last_date)}</span>
                </div>
                <p className="text-[10px] text-muted truncate">{convo.last_message}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {/* Status badge */}
                  <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-medium ${
                    convo.status === "open" ? "bg-green-400/10 text-green-400" :
                    convo.status === "pending" ? "bg-yellow-400/10 text-yellow-400" :
                    "bg-white/5 text-muted"
                  }`}>{convo.status}</span>
                  {/* Priority */}
                  {convo.priority === "high" && <Flag size={8} className="text-red-400" />}
                  {convo.priority === "medium" && <Flag size={8} className="text-yellow-400" />}
                  {/* Unread */}
                  {convo.unread > 0 && (
                    <span className="text-[7px] bg-gold text-black px-1.5 py-0.5 rounded-full font-bold">{convo.unread}</span>
                  )}
                  {/* Assignee */}
                  <span className="text-[8px] text-muted ml-auto">{convo.assignee}</span>
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
              <p className="text-[10px] text-muted/50 mt-1">Unified inbox for email, SMS, and social DMs</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.04]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center bg-gold/10">
                    <User size={16} className="text-gold" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{selected.business_name}</p>
                      {getSentimentIcon(selected.sentiment)}
                      <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                        selected.status === "open" ? "bg-green-400/10 text-green-400" :
                        selected.status === "pending" ? "bg-yellow-400/10 text-yellow-400" :
                        "bg-white/5 text-muted"
                      }`}>{selected.status}</span>
                      {selected.priority === "high" && <span className="text-[8px] bg-red-400/10 text-red-400 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Flag size={7} /> High</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted">
                      <span>{selected.messages.length} messages</span>
                      <span>&middot;</span>
                      <span className="flex items-center gap-0.5"><Clock size={8} /> Avg: {selected.avgResponseTime}</span>
                      <span>&middot;</span>
                      <span className="flex items-center gap-0.5"><Users size={8} /> {selected.assignee}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {selected.phone && <a href={`tel:${selected.phone}`} className="p-2 rounded-lg border border-border text-muted hover:text-foreground"><Phone size={14} /></a>}
                  {selected.email && <a href={`mailto:${selected.email}`} className="p-2 rounded-lg border border-border text-muted hover:text-foreground"><Mail size={14} /></a>}
                  <button onClick={() => setShowTagPicker(!showTagPicker)} className="p-2 rounded-lg border border-border text-muted hover:text-foreground"><Tag size={14} /></button>
                </div>
              </div>
              {/* Tags */}
              <div className="flex items-center gap-1.5 mt-2">
                {selected.tags.map(tag => (
                  <span key={tag} className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">{tag}</span>
                ))}
                {showTagPicker && (
                  <div className="flex gap-1 ml-2 flex-wrap">
                    {CONVERSATION_TAGS.filter(t => !selected.tags.includes(t)).slice(0, 5).map(t => (
                      <button key={t} className="text-[8px] border border-border text-muted px-1.5 py-0.5 rounded hover:text-gold hover:border-gold/20">{t}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Panel tabs */}
            <div className="flex gap-1 px-4 pt-2 border-b border-white/[0.04]">
              {([
                { id: "chat" as const, label: "Chat", icon: MessageSquare },
                { id: "templates" as const, label: "Templates", icon: FileText },
                { id: "notes" as const, label: "Notes", icon: Pin },
              ]).map(p => (
                <button key={p.id} onClick={() => setActivePanel(p.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-[10px] rounded-t-lg transition-all ${
                    activePanel === p.id ? "bg-gold/10 text-gold" : "text-muted hover:text-foreground"
                  }`}>
                  <p.icon size={10} /> {p.label}
                </button>
              ))}
            </div>

            {/* Messages / Templates / Notes */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {activePanel === "chat" && (
                <div className="space-y-3">
                  {selected.messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-xl px-3.5 py-2.5 ${
                        msg.direction === "outbound"
                          ? "bg-gold/10 border border-gold/15"
                          : "border border-white/[0.06] bg-white/[0.02]"
                      }`}>
                        {msg.sender && <p className="text-[9px] font-semibold text-gold mb-1">{msg.sender}</p>}
                        <p className="text-[11px] leading-relaxed">{msg.text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] text-muted">{formatTime(msg.date)}</span>
                          <span className="text-[8px] text-muted flex items-center gap-0.5">{getPlatformIcon(msg.platform)} {msg.platform}</span>
                          {msg.direction === "outbound" && (
                            <span className={`text-[8px] ${msg.status === "delivered" ? "text-green-400" : msg.status === "sent" ? "text-blue-400" : "text-muted"}`}>
                              {msg.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}

              {activePanel === "templates" && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold mb-2 flex items-center gap-2"><FileText size={12} className="text-gold" /> Canned Responses</h3>
                  {CANNED_RESPONSES.map(cr => (
                    <button key={cr.id} onClick={() => { setNewMessage(cr.text); setActivePanel("chat"); }}
                      className="w-full text-left p-3 rounded-lg border border-border hover:border-gold/20 transition-all">
                      <p className="text-xs font-medium">{cr.name}</p>
                      <p className="text-[10px] text-muted mt-0.5 line-clamp-2">{cr.text}</p>
                    </button>
                  ))}
                </div>
              )}

              {activePanel === "notes" && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold mb-2 flex items-center gap-2"><Pin size={12} className="text-gold" /> Internal Notes</h3>
                  {selected.internalNotes.map((note, i) => (
                    <div key={i} className="p-2 rounded-lg bg-yellow-400/5 border border-yellow-400/10">
                      <p className="text-[10px] text-muted">{note}</p>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input value={newNote} onChange={e => setNewNote(e.target.value)}
                      className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground" placeholder="Add a note..." />
                    <button onClick={() => setNewNote("")} className="px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-semibold">Add</button>
                  </div>
                </div>
              )}
            </div>

            {/* Response time tracker */}
            {activePanel === "chat" && (
              <div className="px-4 py-1 border-t border-white/[0.04] flex items-center gap-4 text-[9px] text-muted">
                <span className="flex items-center gap-1"><Clock size={8} /> Avg response: {selected.avgResponseTime}</span>
                <span className="flex items-center gap-1">
                  {selected.sentiment === "positive" ? <Smile size={8} className="text-green-400" /> :
                   selected.sentiment === "negative" ? <Frown size={8} className="text-red-400" /> :
                   <Meh size={8} className="text-yellow-400" />}
                  Sentiment: {selected.sentiment}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button className="flex items-center gap-1 text-muted hover:text-foreground"><Archive size={8} /> Archive</button>
                  <button className="flex items-center gap-1 text-muted hover:text-foreground"><CheckCircle size={8} /> Resolve</button>
                  <button className="flex items-center gap-1 text-muted hover:text-foreground"><AlertCircle size={8} /> Escalate</button>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 border-t border-white/[0.04]">
              <div className="flex gap-2">
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setActivePanel("templates")} className="p-2 rounded-lg border border-border text-muted hover:text-foreground" title="Quick templates">
                    <FileText size={14} />
                  </button>
                  <button className="p-2 rounded-lg border border-border text-muted hover:text-foreground" title="AI suggest reply">
                    <Sparkles size={14} className="text-gold" />
                  </button>
                </div>
                <div className="flex-1 flex gap-2">
                  <select className="rounded-lg border border-border bg-surface px-2 py-1 text-[10px] text-muted w-20">
                    <option>Email</option>
                    <option>SMS</option>
                    <option>DM</option>
                  </select>
                  <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground" placeholder="Type a message..." />
                </div>
                <button disabled={!newMessage.trim()}
                  className="px-3 py-1.5 rounded-lg bg-gold text-black disabled:opacity-30 flex items-center gap-1">
                  <Send size={14} />
                </button>
              </div>

              {/* Assignment row */}
              <div className="flex items-center gap-3 mt-2 text-[9px] text-muted">
                <span className="flex items-center gap-1"><Users size={8} /> Assigned to:</span>
                <select className="rounded border border-border bg-surface px-2 py-0.5 text-[9px] text-foreground">
                  <option>Alex M.</option>
                  <option>Sarah K.</option>
                  <option>Mike T.</option>
                  <option>Unassigned</option>
                </select>
                <span className="flex items-center gap-1"><Flag size={8} /> Priority:</span>
                <select className="rounded border border-border bg-surface px-2 py-0.5 text-[9px] text-foreground">
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
                <span className="flex items-center gap-1"><Star size={8} /> Status:</span>
                <select className="rounded border border-border bg-surface px-2 py-0.5 text-[9px] text-foreground">
                  <option>Open</option>
                  <option>Pending</option>
                  <option>Resolved</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
