"use client";

import { useState, useRef } from "react";
import {
  MessageSquare, Send, Search, Phone, Mail, Sparkles,
  Tag, Flag, Clock, CheckCircle, AlertCircle, Users, Star,
  Smile, Frown, Meh, Archive, Pin, FileText,
  MessageCircle, X,
  Bold, Link2, Paperclip, Image, ChevronDown,
  Ticket, UserPlus, Globe, Zap,
  MessagesSquare,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface Message {
  id: string;
  direction: "outbound" | "inbound";
  channel: "email" | "whatsapp" | "sms" | "portal";
  text: string;
  status: "sent" | "delivered" | "read";
  timestamp: string;
  sender?: string;
  attachments?: string[];
}

interface Conversation {
  id: string;
  clientName: string;
  clientAvatar: string;
  email: string | null;
  phone: string | null;
  lastMessage: string;
  lastTimestamp: string;
  unread: number;
  messages: Message[];
  status: "open" | "resolved";
  priority: "high" | "medium" | "low";
  assignee: string;
  tags: string[];
  sentiment: "positive" | "neutral" | "negative";
  channel: "email" | "whatsapp" | "sms" | "portal";
}

/* ================================================================== */
/*  Mock Data                                                          */
/* ================================================================== */

const MOCK_CONVERSATIONS: Conversation[] = [];

const AI_SUGGESTIONS: Record<string, string[]> = {};

const AVAILABLE_TAGS = [
  "urgent", "follow-up", "content", "ads", "seo", "social",
  "video", "email", "budget", "approved", "review", "scheduling",
  "reporting", "onboarding", "billing", "support",
];

// TODO: Pull from real team table once available
const TEAM_MEMBERS = ["Unassigned"];

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [channelFilter, setChannelFilter] = useState<"all" | "email" | "whatsapp" | "sms" | "portal">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("all");
  const [activePanel, setActivePanel] = useState<"chat" | "templates" | "notes" | "ai">("chat");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [notes, setNotes] = useState<Record<string, string[]>>({});
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [sendChannel, setSendChannel] = useState<"email" | "whatsapp" | "sms" | "portal">("email");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find(c => c.id === selectedId) || null;

  // ── Helpers ─────────────────────────────────────────────
  function formatTime(date: string) {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatTimeFull(date: string) {
    return new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function getSentimentIcon(s: string) {
    if (s === "positive") return <Smile size={12} className="text-emerald-400" />;
    if (s === "negative") return <Frown size={12} className="text-red-400" />;
    return <Meh size={12} className="text-yellow-400" />;
  }

  function getChannelIcon(ch: string, size = 10) {
    if (ch === "email") return <Mail size={size} />;
    if (ch === "whatsapp") return <MessageCircle size={size} />;
    if (ch === "sms") return <Phone size={size} />;
    if (ch === "portal") return <Globe size={size} />;
    return <MessageSquare size={size} />;
  }

  function getChannelColor(ch: string) {
    if (ch === "email") return "text-blue-400";
    if (ch === "whatsapp") return "text-emerald-400";
    if (ch === "sms") return "text-purple-400";
    if (ch === "portal") return "text-gold";
    return "text-muted";
  }

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedId) return;
    const msg: Message = {
      id: `m${Date.now()}`,
      direction: "outbound",
      channel: sendChannel,
      text: newMessage,
      status: "sent",
      timestamp: new Date().toISOString(),
      sender: "You",
    };
    setConversations(prev => prev.map(c =>
      c.id === selectedId
        ? { ...c, messages: [...c.messages, msg], lastMessage: newMessage, lastTimestamp: msg.timestamp }
        : c
    ));
    setNewMessage("");
  };

  const addTag = (tag: string) => {
    if (!selectedId) return;
    setConversations(prev => prev.map(c =>
      c.id === selectedId && !c.tags.includes(tag) ? { ...c, tags: [...c.tags, tag] } : c
    ));
  };

  const removeTag = (tag: string) => {
    if (!selectedId) return;
    setConversations(prev => prev.map(c =>
      c.id === selectedId ? { ...c, tags: c.tags.filter(t => t !== tag) } : c
    ));
  };

  const assignTo = (name: string) => {
    if (!selectedId) return;
    setConversations(prev => prev.map(c =>
      c.id === selectedId ? { ...c, assignee: name } : c
    ));
    setShowAssignDropdown(false);
  };

  const toggleStatus = () => {
    if (!selectedId) return;
    setConversations(prev => prev.map(c =>
      c.id === selectedId ? { ...c, status: c.status === "open" ? "resolved" : "open" } : c
    ));
  };

  const addNote = () => {
    if (!newNote.trim() || !selectedId) return;
    setNotes(prev => ({ ...prev, [selectedId]: [...(prev[selectedId] || []), newNote] }));
    setNewNote("");
  };

  const applySuggestion = (text: string) => {
    setNewMessage(text);
    setActivePanel("chat");
  };

  // Filtering
  const filtered = conversations.filter(c => {
    if (!c.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (channelFilter !== "all" && c.channel !== channelFilter) return false;
    return true;
  });

  const openCount = conversations.filter(c => c.status === "open").length;
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);
  const currentNotes = selectedId ? (notes[selectedId] || []) : [];

  return (
    <div className="fade-in space-y-4">
      <PageHero
        icon={<MessagesSquare size={28} />}
        title="Conversations"
        subtitle={`Unified inbox · ${openCount} open · ${totalUnread} unread`}
        gradient="purple"
      />
    <div className="flex h-[calc(100vh-200px)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">

      {/* ── Left Sidebar: Conversation List ────────────────── */}
      <div className="w-80 shrink-0 border-r border-[var(--color-border)] flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-sm font-bold flex items-center gap-2">
              <MessageSquare size={16} className="text-gold" /> Conversations
            </h1>
            <div className="flex items-center gap-1.5">
              {totalUnread > 0 && (
                <span className="text-[8px] bg-gold text-black px-1.5 py-0.5 rounded-full font-bold">{totalUnread} new</span>
              )}
              <span className="text-[9px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full">{openCount} open</span>
            </div>
          </div>
          <p className="text-xs text-muted mb-1">Unified inbox for client chats, SMS, email, and social DMs</p>

          {/* Search */}
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/40" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white/[0.03] px-3 py-1.5 pl-8 text-xs text-foreground focus:outline-none focus:border-gold transition-colors" placeholder="Search conversations..." />
          </div>

          {/* Channel filter */}
          <div className="flex gap-0.5">
            {(["all", "email", "whatsapp", "sms", "portal"] as const).map(ch => (
              <button key={ch} onClick={() => setChannelFilter(ch)}
                className={`flex items-center gap-1 text-[8px] px-2 py-1 rounded-lg capitalize transition-all ${
                  channelFilter === ch ? "bg-gold/10 text-gold font-medium" : "text-muted hover:text-foreground"
                }`}>
                {ch !== "all" && getChannelIcon(ch, 8)}
                {ch === "all" ? "All" : ch === "whatsapp" ? "WhatsApp" : ch.charAt(0).toUpperCase() + ch.slice(1)}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex gap-0.5 mt-1">
            {(["all", "open", "resolved"] as const).map(st => (
              <button key={st} onClick={() => setStatusFilter(st)}
                className={`text-[8px] px-2 py-1 rounded-lg capitalize transition-all ${
                  statusFilter === st ? "bg-gold/10 text-gold font-medium" : "text-muted hover:text-foreground"
                }`}>
                {st === "all" ? `All (${conversations.length})` :
                 st === "open" ? `Open (${openCount})` :
                 `Resolved (${conversations.length - openCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-[10px] text-muted">No conversations match filters</div>
          ) : (
            filtered.map(convo => (
              <button key={convo.id} onClick={() => { setSelectedId(convo.id); setActivePanel("chat"); }}
                className={`w-full text-left px-3 py-3 border-b border-white/[0.03] transition-colors ${
                  selectedId === convo.id ? "bg-gold/[0.04]" : "hover:bg-white/[0.02]"
                }`}>
                <div className="flex items-start gap-2.5">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    convo.sentiment === "positive" ? "bg-emerald-500/10 text-emerald-400" :
                    convo.sentiment === "negative" ? "bg-red-500/10 text-red-400" :
                    "bg-gold/10 text-gold"
                  }`}>{convo.clientAvatar}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-semibold truncate">{convo.clientName}</span>
                        {getSentimentIcon(convo.sentiment)}
                      </div>
                      <span className="text-[9px] text-muted shrink-0 ml-1">{formatTime(convo.lastTimestamp)}</span>
                    </div>
                    <p className="text-[10px] text-muted truncate">{convo.lastMessage}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {/* Channel badge */}
                      <span className={`text-[7px] flex items-center gap-0.5 ${getChannelColor(convo.channel)}`}>
                        {getChannelIcon(convo.channel, 7)} {convo.channel}
                      </span>
                      {/* Status */}
                      <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-medium ${
                        convo.status === "open" ? "bg-emerald-400/10 text-emerald-400" : "bg-white/5 text-muted"
                      }`}>{convo.status}</span>
                      {/* Priority */}
                      {convo.priority === "high" && <Flag size={8} className="text-red-400" />}
                      {/* Unread */}
                      {convo.unread > 0 && (
                        <span className="text-[7px] bg-gold text-black px-1.5 py-0.5 rounded-full font-bold ml-auto">{convo.unread}</span>
                      )}
                      {/* Assignee */}
                      <span className="text-[8px] text-muted ml-auto">{convo.assignee}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right Panel: Chat Thread ───────────────────────── */}
      <div className="flex-1 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={36} className="mx-auto mb-3 text-muted/15" />
              <p className="text-sm font-medium text-muted">Select a conversation</p>
              <p className="text-[10px] text-muted/50 mt-1">Unified inbox for Email, WhatsApp, SMS, and Portal messages</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── Chat Header ────────────────────────────────── */}
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
                    selected.sentiment === "positive" ? "bg-emerald-500/10 text-emerald-400" :
                    selected.sentiment === "negative" ? "bg-red-500/10 text-red-400" :
                    "bg-gold/10 text-gold"
                  }`}>{selected.clientAvatar}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{selected.clientName}</p>
                      {getSentimentIcon(selected.sentiment)}
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                        selected.status === "open" ? "bg-emerald-400/10 text-emerald-400" : "bg-white/5 text-muted"
                      }`}>{selected.status}</span>
                      {selected.priority === "high" && (
                        <span className="text-[8px] bg-red-400/10 text-red-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Flag size={7} /> High</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted">
                      <span className={`flex items-center gap-0.5 ${getChannelColor(selected.channel)}`}>{getChannelIcon(selected.channel, 8)} {selected.channel}</span>
                      <span>&middot;</span>
                      <span>{selected.messages.length} messages</span>
                      <span>&middot;</span>
                      <span className="flex items-center gap-0.5"><Users size={8} /> {selected.assignee}</span>
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex gap-1.5">
                  {selected.phone && (
                    <button className="p-2 rounded-lg border border-[var(--color-border)] text-muted hover:text-foreground hover:border-gold/30 transition-all" title="Call">
                      <Phone size={14} />
                    </button>
                  )}
                  {selected.email && (
                    <button className="p-2 rounded-lg border border-[var(--color-border)] text-muted hover:text-foreground hover:border-gold/30 transition-all" title="Email">
                      <Mail size={14} />
                    </button>
                  )}

                  {/* Assign dropdown */}
                  <div className="relative">
                    <button onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                      className="p-2 rounded-lg border border-[var(--color-border)] text-muted hover:text-foreground hover:border-gold/30 transition-all" title="Assign">
                      <UserPlus size={14} />
                    </button>
                    {showAssignDropdown && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg z-10 py-1">
                        <p className="text-[9px] text-muted px-3 py-1">Assign to:</p>
                        {TEAM_MEMBERS.map(name => (
                          <button key={name} onClick={() => assignTo(name)}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.04] transition-colors ${
                              selected.assignee === name ? "text-gold" : "text-foreground"
                            }`}>{name}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button onClick={() => setShowTicketModal(true)}
                    className="p-2 rounded-lg border border-[var(--color-border)] text-muted hover:text-foreground hover:border-gold/30 transition-all" title="Create ticket">
                    <Ticket size={14} />
                  </button>
                  <button onClick={() => setShowTagPicker(!showTagPicker)}
                    className="p-2 rounded-lg border border-[var(--color-border)] text-muted hover:text-foreground hover:border-gold/30 transition-all" title="Tags">
                    <Tag size={14} />
                  </button>
                </div>
              </div>

              {/* Tags row */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {selected.tags.map(tag => (
                  <span key={tag} className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-red-400"><X size={7} /></button>
                  </span>
                ))}
                {showTagPicker && (
                  <div className="flex gap-1 flex-wrap">
                    {AVAILABLE_TAGS.filter(t => !selected.tags.includes(t)).slice(0, 8).map(t => (
                      <button key={t} onClick={() => addTag(t)}
                        className="text-[8px] border border-[var(--color-border)] text-muted px-1.5 py-0.5 rounded-full hover:text-gold hover:border-gold/20 transition-colors">
                        + {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Panel Tabs ─────────────────────────────────── */}
            <div className="flex gap-0.5 px-4 pt-2 border-b border-[var(--color-border)]">
              {([
                { id: "chat" as const, label: "Chat", icon: MessageSquare },
                { id: "ai" as const, label: "AI Replies", icon: Sparkles },
                { id: "templates" as const, label: "Templates", icon: FileText },
                { id: "notes" as const, label: "Notes", icon: Pin },
              ]).map(p => (
                <button key={p.id} onClick={() => setActivePanel(p.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-[10px] rounded-t-lg transition-all ${
                    activePanel === p.id ? "bg-gold/10 text-gold font-medium" : "text-muted hover:text-foreground"
                  }`}>
                  <p.icon size={10} /> {p.label}
                </button>
              ))}
            </div>

            {/* ── Message Area ────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {/* Chat messages */}
              {activePanel === "chat" && (
                <div className="space-y-3">
                  {selected.messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                        msg.direction === "outbound"
                          ? "bg-gold/10 border border-gold/15"
                          : "border border-white/[0.06] bg-white/[0.02]"
                      }`}>
                        {msg.sender && (
                          <p className={`text-[9px] font-semibold mb-1 ${msg.direction === "outbound" ? "text-gold" : "text-foreground"}`}>
                            {msg.sender}
                          </p>
                        )}
                        <p className="text-[11px] leading-relaxed">{msg.text}</p>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-1.5 flex gap-1">
                            {msg.attachments.map((att, i) => (
                              <span key={i} className="text-[8px] px-2 py-0.5 bg-white/[0.04] border border-[var(--color-border)] rounded-full flex items-center gap-1 text-muted">
                                <Paperclip size={7} /> {att}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[8px] text-muted">{formatTimeFull(msg.timestamp)}</span>
                          <span className={`text-[8px] flex items-center gap-0.5 ${getChannelColor(msg.channel)}`}>
                            {getChannelIcon(msg.channel, 7)} {msg.channel}
                          </span>
                          {msg.direction === "outbound" && (
                            <span className={`text-[8px] ${
                              msg.status === "read" ? "text-blue-400" : msg.status === "delivered" ? "text-emerald-400" : "text-muted"
                            }`}>{msg.status}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}

              {/* AI Suggested Replies */}
              {activePanel === "ai" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-gold" />
                    <h3 className="text-xs font-semibold">AI-Suggested Replies</h3>
                    <span className="text-[9px] text-muted">Based on conversation context</span>
                  </div>
                  {(AI_SUGGESTIONS[selected.id] || []).length > 0 ? (
                    (AI_SUGGESTIONS[selected.id] || []).map((suggestion, i) => (
                      <button key={i} onClick={() => applySuggestion(suggestion)}
                        className="w-full text-left p-4 rounded-xl border border-[var(--color-border)] hover:border-gold/20 hover:bg-gold/[0.02] transition-all group">
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Zap size={12} className="text-gold" />
                          </div>
                          <div>
                            <p className="text-[11px] leading-relaxed">{suggestion}</p>
                            <p className="text-[9px] text-gold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Click to use this reply</p>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Sparkles size={20} className="mx-auto mb-2 text-muted/20" />
                      <p className="text-[10px] text-muted">No AI suggestions available for this conversation yet.</p>
                      <p className="text-[9px] text-muted/50 mt-1">Suggestions appear for active conversations with recent messages.</p>
                    </div>
                  )}

                  {/* Tone options */}
                  <div className="p-3 rounded-xl border border-[var(--color-border)] bg-white/[0.01]">
                    <p className="text-[10px] text-muted mb-2">Generate custom reply with tone:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Professional", "Friendly", "Apologetic", "Urgent", "Casual"].map(tone => (
                        <button key={tone}
                          className="text-[9px] px-2.5 py-1 rounded-full border border-[var(--color-border)] text-muted hover:text-gold hover:border-gold/20 transition-colors">
                          {tone}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Templates */}
              {activePanel === "templates" && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold mb-2 flex items-center gap-2"><FileText size={12} className="text-gold" /> Quick Templates</h3>
                  {[
                    { name: "Acknowledge & Investigate", text: "Thank you for reaching out. I'm looking into this right now and will have an update for you within [timeframe]. I appreciate your patience." },
                    { name: "Update Ready", text: "Hi {name}! Your [deliverable] is ready for review. You can access it here: [link]. Let me know if you'd like any changes." },
                    { name: "Schedule a Call", text: "I'd love to hop on a quick call to discuss this in more detail. Here's my calendar: [calendar_link]. Pick a time that works for you!" },
                    { name: "Apology & Resolution", text: "I sincerely apologize for the inconvenience. Here's what I've done to resolve this: [resolution]. To make it right, we're also [goodwill gesture]." },
                    { name: "Monthly Check-in", text: "Hi {name}! Just checking in on how things are going. Here's a quick summary of what we accomplished this month: [summary]. Any feedback or priorities for next month?" },
                    { name: "Request Approval", text: "Hi {name}, the [deliverable] is ready for your review and approval. Please take a look at: [link]. Let me know if it's good to go or if you'd like changes." },
                  ].map((tpl, i) => (
                    <button key={i} onClick={() => { setNewMessage(tpl.text); setActivePanel("chat"); }}
                      className="w-full text-left p-3 rounded-xl border border-[var(--color-border)] hover:border-gold/20 transition-all">
                      <p className="text-xs font-medium">{tpl.name}</p>
                      <p className="text-[10px] text-muted mt-0.5 line-clamp-2">{tpl.text}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Notes */}
              {activePanel === "notes" && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold mb-2 flex items-center gap-2"><Pin size={12} className="text-gold" /> Internal Notes</h3>
                  <p className="text-[9px] text-muted">Notes are visible only to your team, not the client.</p>
                  {currentNotes.length === 0 && (
                    <div className="text-center py-6">
                      <Pin size={16} className="mx-auto mb-2 text-muted/20" />
                      <p className="text-[10px] text-muted">No notes yet for this conversation.</p>
                    </div>
                  )}
                  {currentNotes.map((note, i) => (
                    <div key={i} className="p-3 rounded-xl bg-yellow-400/5 border border-yellow-400/10">
                      <p className="text-[10px] text-muted">{note}</p>
                      <p className="text-[8px] text-muted/40 mt-1">Just now</p>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input value={newNote} onChange={e => setNewNote(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addNote()}
                      className="flex-1 rounded-lg border border-[var(--color-border)] bg-white/[0.03] px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold" placeholder="Add internal note..." />
                    <button onClick={addNote}
                      className="px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-semibold hover:bg-gold/90">Add</button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Status Bar ─────────────────────────────────── */}
            {activePanel === "chat" && (
              <div className="px-4 py-1.5 border-t border-[var(--color-border)] flex items-center gap-4 text-[9px] text-muted">
                <span className="flex items-center gap-1">
                  {selected.sentiment === "positive" ? <Smile size={8} className="text-emerald-400" /> :
                   selected.sentiment === "negative" ? <Frown size={8} className="text-red-400" /> :
                   <Meh size={8} className="text-yellow-400" />}
                  Sentiment: {selected.sentiment}
                </span>
                <span className="flex items-center gap-1"><Clock size={8} /> Last: {formatTime(selected.lastTimestamp)}</span>
                <div className="ml-auto flex items-center gap-3">
                  <button className="flex items-center gap-1 text-muted hover:text-foreground transition-colors"><Archive size={8} /> Archive</button>
                  <button onClick={toggleStatus} className="flex items-center gap-1 text-muted hover:text-emerald-400 transition-colors">
                    <CheckCircle size={8} /> {selected.status === "open" ? "Resolve" : "Reopen"}
                  </button>
                  <button className="flex items-center gap-1 text-muted hover:text-red-400 transition-colors"><AlertCircle size={8} /> Escalate</button>
                </div>
              </div>
            )}

            {/* ── Message Input ───────────────────────────────── */}
            <div className="px-4 py-3 border-t border-[var(--color-border)]">
              {/* Rich text toolbar */}
              <div className="flex items-center gap-1 mb-2">
                <button className="p-1.5 rounded text-muted hover:text-foreground hover:bg-white/[0.04] transition-colors" title="Bold">
                  <Bold size={12} />
                </button>
                <button className="p-1.5 rounded text-muted hover:text-foreground hover:bg-white/[0.04] transition-colors" title="Link">
                  <Link2 size={12} />
                </button>
                <button className="p-1.5 rounded text-muted hover:text-foreground hover:bg-white/[0.04] transition-colors" title="Attachment">
                  <Paperclip size={12} />
                </button>
                <button className="p-1.5 rounded text-muted hover:text-foreground hover:bg-white/[0.04] transition-colors" title="Image">
                  <Image size={12} />
                </button>
                <div className="h-4 w-px bg-[var(--color-border)] mx-1" />
                <button onClick={() => setActivePanel("ai")}
                  className="flex items-center gap-1 px-2 py-1 rounded text-gold hover:bg-gold/10 transition-colors text-[9px]">
                  <Sparkles size={10} /> AI Suggest
                </button>
                <button onClick={() => setActivePanel("templates")}
                  className="flex items-center gap-1 px-2 py-1 rounded text-muted hover:text-foreground hover:bg-white/[0.04] transition-colors text-[9px]">
                  <FileText size={10} /> Templates
                </button>
              </div>

              {/* Input row */}
              <div className="flex gap-2">
                <select value={sendChannel} onChange={e => setSendChannel(e.target.value as typeof sendChannel)}
                  className="rounded-lg border border-[var(--color-border)] bg-white/[0.03] px-2 py-1 text-[10px] text-foreground w-24 focus:outline-none focus:border-gold">
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="portal">Portal</option>
                </select>
                <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage()}
                  className="flex-1 rounded-lg border border-[var(--color-border)] bg-white/[0.03] px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold transition-colors" placeholder="Type a message..." />
                <button onClick={sendMessage} disabled={!newMessage.trim()}
                  className="px-4 py-2 rounded-lg bg-gold text-black font-semibold disabled:opacity-30 flex items-center gap-1.5 hover:bg-gold/90 transition-all">
                  <Send size={14} />
                </button>
              </div>

              {/* Quick actions row */}
              <div className="flex items-center gap-3 mt-2 text-[9px] text-muted">
                <span className="flex items-center gap-1"><Users size={8} /> Assigned to:</span>
                <div className="relative">
                  <button onClick={() => setShowAssignDropdown(!showAssignDropdown)} className="text-foreground font-medium flex items-center gap-0.5">
                    {selected.assignee} <ChevronDown size={8} />
                  </button>
                </div>
                <span className="flex items-center gap-1"><Flag size={8} /> Priority:</span>
                <span className={`font-medium ${
                  selected.priority === "high" ? "text-red-400" :
                  selected.priority === "medium" ? "text-yellow-400" : "text-muted"
                }`}>{selected.priority}</span>
                <span className="flex items-center gap-1"><Star size={8} /> Status:</span>
                <button onClick={toggleStatus} className={`font-medium ${selected.status === "open" ? "text-emerald-400" : "text-muted"}`}>
                  {selected.status}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Create Ticket Modal ────────────────────────────── */}
      {showTicketModal && selected && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowTicketModal(false)}>
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Ticket size={14} className="text-gold" /> Create Ticket</h3>
              <button onClick={() => setShowTicketModal(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1">Client</label>
              <input value={selected.clientName} readOnly className="w-full px-3 py-2 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-xs text-foreground" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1">Ticket Title</label>
              <input placeholder="Brief description of the issue..."
                className="w-full px-3 py-2 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-xs text-foreground focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1">Priority</label>
              <select defaultValue={selected.priority}
                className="w-full px-3 py-2 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-xs text-foreground focus:outline-none focus:border-gold">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1">Assign To</label>
              <select defaultValue={selected.assignee}
                className="w-full px-3 py-2 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-xs text-foreground focus:outline-none focus:border-gold">
                {TEAM_MEMBERS.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <button onClick={() => setShowTicketModal(false)} className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-muted hover:text-foreground transition-colors">Cancel</button>
              <button onClick={() => setShowTicketModal(false)} className="flex items-center gap-1 px-4 py-1.5 text-xs rounded-lg bg-gold text-black font-semibold hover:bg-gold/90 transition-colors">
                <Ticket size={12} /> Create Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
