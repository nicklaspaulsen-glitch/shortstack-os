"use client";

/**
 * Unified Conversations Inbox
 *
 * Three-pane Gmail/Front-style inbox aggregating every messaging channel:
 *   email · sms · whatsapp · telegram · instagram · slack · discord · web_chat
 *
 * Left  (320px): filter tabs + searchable conversation list
 * Middle(flex):  selected thread + composer
 * Right (280px): contact details + quick actions
 *
 * Realtime: subscribes to INSERTs on conversations and
 * conversation_messages — no polling.
 *
 * Keyboard shortcuts (focus NOT in a textbox):
 *   j/k  prev/next conversation
 *   r    focus composer (reply)
 *   e    archive
 *   s    snooze
 *   c    close
 *   #1-9 jump to filter tab
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Send,
  Camera,
  Hash,
  Inbox,
  Search,
  Archive,
  Clock,
  CheckCircle2,
  X,
  Paperclip,
  Smile,
  UserPlus,
  Tag,
  MoreHorizontal,
  Phone,
  Globe,
  Loader2,
  Circle,
  ChevronLeft,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────
type Channel =
  | "email"
  | "sms"
  | "whatsapp"
  | "telegram"
  | "instagram"
  | "slack"
  | "discord"
  | "web_chat";
type Status = "open" | "snoozed" | "closed" | "archived";
type FilterKey = "all" | "unread" | "email" | "sms" | "chat" | "snoozed" | "closed";

interface Conversation {
  id: string;
  channel: Channel;
  external_thread_id: string;
  subject: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  status: Status;
  assigned_to_user_id: string | null;
  tags: string[] | null;
  contact_id: string | null;
  contact: {
    business_name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  from_identifier: string;
  to_identifier: string | null;
  body: string | null;
  attachments: unknown[];
  sent_at: string;
  read_at: string | null;
  external_message_id: string | null;
}

// ── Channel chrome ───────────────────────────────────────────────────
const CHANNEL_META: Record<Channel, { label: string; icon: React.ReactNode; tone: string }> = {
  email: { label: "Email", icon: <Mail size={14} />, tone: "text-sky-300 bg-sky-500/10 border-sky-500/30" },
  sms: { label: "SMS", icon: <MessageSquare size={14} />, tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" },
  whatsapp: { label: "WhatsApp", icon: <MessageCircle size={14} />, tone: "text-green-300 bg-green-500/10 border-green-500/30" },
  telegram: { label: "Telegram", icon: <Send size={14} />, tone: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30" },
  instagram: { label: "Instagram", icon: <Camera size={14} />, tone: "text-pink-300 bg-pink-500/10 border-pink-500/30" },
  slack: { label: "Slack", icon: <Hash size={14} />, tone: "text-violet-300 bg-violet-500/10 border-violet-500/30" },
  discord: { label: "Discord", icon: <Hash size={14} />, tone: "text-indigo-300 bg-indigo-500/10 border-indigo-500/30" },
  web_chat: { label: "Web Chat", icon: <Globe size={14} />, tone: "text-amber-300 bg-amber-500/10 border-amber-500/30" },
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "chat", label: "Chat" },
  { key: "snoozed", label: "Snoozed" },
  { key: "closed", label: "Closed" },
];

// Channel groups for "Chat" filter (anything that isn't email/sms).
const CHAT_CHANNELS: Channel[] = ["telegram", "instagram", "slack", "discord", "web_chat", "whatsapp"];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Main component ───────────────────────────────────────────────────
export default function ConversationsPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /*
   * codex round-1: mobile single-pane stacked layout.
   * On md- screens only one of "list" or "thread" is shown at a time.
   * Selecting a conversation flips to "thread"; back button flips to "list".
   * On md+ the original 3-pane flex layout is preserved via Tailwind responsive classes.
   */
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [contact, setContact] = useState<Conversation["contact"] | null>(null);

  const composerRef = useRef<HTMLTextAreaElement>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);

  // ── Fetch conversation list ────────────────────────────────────────
  const fetchList = useCallback(async (signal?: AbortSignal) => {
    try {
      const params = new URLSearchParams();
      if (filter === "unread") params.set("unread_only", "1");
      else if (filter === "email") params.set("channel", "email");
      else if (filter === "sms") params.set("channel", "sms");
      else if (filter === "snoozed") params.set("status", "snoozed");
      else if (filter === "closed") params.set("status", "closed");
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/conversations?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      let list: Conversation[] = data.conversations || [];
      // Client-side filter for "chat" (union of non-email/sms channels).
      if (filter === "chat") list = list.filter((c) => CHAT_CHANNELS.includes(c.channel));
      setConversations(list);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return; // expected on cleanup
      console.error("[conversations] list fetch failed:", err);
      toast.error("Could not load conversations");
    } finally {
      // codex round-1: only clear loading when this request was not the one aborted;
      // an aborted request must not hide the newer in-flight loading indicator.
      if (!signal?.aborted) setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    if (!user) return;
    // AbortController prevents stale-response setState on rapid filter/search changes.
    const ctrl = new AbortController();
    setLoading(true);
    fetchList(ctrl.signal);
    return () => ctrl.abort();
  }, [user, fetchList]);

  // ── Fetch messages when selection changes ──────────────────────────
  const fetchMessages = useCallback(
    async (conversationId: string) => {
      setLoadingThread(true);
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        setMessages(data.messages || []);
        setContact(data.conversation?.contact ?? null);
        // Mark read
        fetch(`/api/conversations/${conversationId}/mark-read`, { method: "POST" })
          .then(() => {
            setConversations((prev) =>
              prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)),
            );
          })
          .catch(() => {});
      } catch (err) {
        console.error("[conversations] thread fetch failed:", err);
        toast.error("Could not load thread");
      } finally {
        setLoadingThread(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (selectedId) fetchMessages(selectedId);
    else setMessages([]);
  }, [selectedId, fetchMessages]);

  // Scroll to bottom on new messages.
  useEffect(() => {
    if (threadScrollRef.current) {
      threadScrollRef.current.scrollTop = threadScrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // ── Realtime subscriptions ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("conversations-inbox")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Simpler than per-row merging — refetch the whole list.
          fetchList();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
        },
        (payload: { new: Message & { conversation_id: string } }) => {
          const row = payload.new;
          // If it's the open thread, append.
          if (selectedId && row.conversation_id === selectedId) {
            setMessages((prev) => [...prev, row]);
          }
          // List re-fetches on the conversations UPDATE that follows.
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedId]);

  // ── Send outbound reply ────────────────────────────────────────────
  async function handleSend() {
    if (!selectedId || !composerText.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${selectedId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: composerText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setComposerText("");
      // Realtime will append the new message, but optimistically append too.
      setMessages((prev) => [
        ...prev,
        {
          id: data.messageId || `optimistic-${Date.now()}`,
          direction: "outbound",
          from_identifier: "me",
          to_identifier: null,
          body: composerText.trim(),
          attachments: [],
          sent_at: new Date().toISOString(),
          read_at: null,
          external_message_id: null,
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  // ── Status / assignment helpers ────────────────────────────────────
  async function setStatus(id: string, status: Status) {
    try {
      const res = await fetch(`/api/conversations/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Marked ${status}`);
      if (status !== "open" && id === selectedId) setSelectedId(null);
      fetchList();
    } catch {
      toast.error("Status update failed");
    }
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      // Number keys always jump filters (even while typing in search? no — only if not typing).
      if (!isTyping && /^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        if (FILTERS[idx]) {
          e.preventDefault();
          setFilter(FILTERS[idx].key);
        }
        return;
      }

      if (isTyping) return;

      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const list = conversations;
        if (list.length === 0) return;
        const currentIdx = selectedId ? list.findIndex((c) => c.id === selectedId) : -1;
        const nextIdx =
          e.key === "j"
            ? Math.min(list.length - 1, currentIdx + 1)
            : Math.max(0, currentIdx - 1);
        setSelectedId(list[nextIdx]?.id ?? null);
      } else if (e.key === "r" && selectedId) {
        e.preventDefault();
        composerRef.current?.focus();
      } else if (e.key === "e" && selectedId) {
        e.preventDefault();
        setStatus(selectedId, "archived");
      } else if (e.key === "s" && selectedId) {
        e.preventDefault();
        setStatus(selectedId, "snoozed");
      } else if (e.key === "c" && selectedId) {
        e.preventDefault();
        setStatus(selectedId, "closed");
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, selectedId]);

  // ── Render ─────────────────────────────────────────────────────────
  const selected = conversations.find((c) => c.id === selectedId) || null;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[#0b0d12] text-white">
      {/* ── LEFT: conversation list — hidden on mobile when viewing a thread ── */}
      <aside className={`${mobileView === "thread" ? "hidden" : "flex"} md:flex w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-white/5 flex-col`}>
        <div className="p-4 border-b border-white/5">
          <h1 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Inbox size={18} className="text-amber-400" />
            Conversations
          </h1>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full bg-white/5 border border-white/10 rounded-md pl-9 pr-3 py-2 text-sm placeholder-white/40 focus:outline-none focus:border-amber-400/50"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-white/5">
          {FILTERS.map((f, i) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-2.5 py-1 rounded-md transition ${
                filter === f.key
                  ? "bg-amber-400/20 text-amber-200 border border-amber-400/30"
                  : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
              title={`Shortcut: ${i + 1}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-white/40 text-sm">
              <Loader2 className="animate-spin mx-auto mb-2" size={18} />
              Loading…
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">
              No conversations yet.
              <div className="text-xs mt-2 text-white/30">
                Inbound messages from any channel will appear here.
              </div>
            </div>
          ) : (
            conversations.map((c) => (
              <ConversationRow
                key={c.id}
                c={c}
                active={c.id === selectedId}
                onClick={() => {
                  setSelectedId(c.id);
                  setMobileView("thread");
                }}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── MIDDLE: thread — hidden on mobile when showing the list ── */}
      <main className={`${mobileView === "list" ? "hidden" : "flex"} md:flex flex-1 flex-col min-w-0`}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-white/40 text-sm">
            Select a conversation to view
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="px-5 py-3 border-b border-white/5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {/* Back button — mobile only */}
                  <button
                    className="flex md:hidden items-center gap-1 text-white/60 hover:text-white mr-1"
                    onClick={() => setMobileView("list")}
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <ChannelPill channel={selected.channel} />
                  <span className="font-medium truncate">
                    {selected.contact?.business_name ||
                      selected.contact?.contact_name ||
                      selected.external_thread_id}
                  </span>
                </div>
                {selected.subject && (
                  <div className="text-xs text-white/40 mt-0.5 truncate">{selected.subject}</div>
                )}
              </div>
              <div className="flex items-center gap-1 text-white/60">
                <button
                  onClick={() => setStatus(selected.id, "snoozed")}
                  className="p-1.5 rounded hover:bg-white/5"
                  title="Snooze (s)"
                >
                  <Clock size={15} />
                </button>
                <button
                  onClick={() => setStatus(selected.id, "archived")}
                  className="p-1.5 rounded hover:bg-white/5"
                  title="Archive (e)"
                >
                  <Archive size={15} />
                </button>
                <button
                  onClick={() => setStatus(selected.id, "closed")}
                  className="p-1.5 rounded hover:bg-white/5"
                  title="Close (c)"
                >
                  <CheckCircle2 size={15} />
                </button>
              </div>
            </header>

            {/* Messages */}
            <div
              ref={threadScrollRef}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
            >
              {loadingThread ? (
                <div className="text-center text-white/40 text-sm py-8">
                  <Loader2 className="animate-spin mx-auto mb-2" size={18} />
                  Loading thread…
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-white/40 text-sm py-8">No messages yet.</div>
              ) : (
                messages.map((m) => <MessageBubble key={m.id} m={m} />)
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-white/5 p-3">
              <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-lg p-2">
                <button
                  type="button"
                  className="p-1.5 text-white/40 hover:text-white rounded"
                  title="Attach"
                >
                  <Paperclip size={16} />
                </button>
                <button
                  type="button"
                  className="p-1.5 text-white/40 hover:text-white rounded"
                  title="Emoji"
                >
                  <Smile size={16} />
                </button>
                <textarea
                  ref={composerRef}
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Reply via ${CHANNEL_META[selected.channel].label}… (Cmd/Ctrl+Enter to send)`}
                  rows={2}
                  className="flex-1 bg-transparent outline-none resize-none text-sm placeholder-white/30"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !composerText.trim()}
                  className="px-3 py-1.5 rounded bg-amber-400 text-black text-sm font-medium disabled:opacity-40 hover:bg-amber-300 flex items-center gap-1.5"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Send
                </button>
              </div>
              <div className="text-[11px] text-white/30 mt-1.5 pl-2">
                Sending as {CHANNEL_META[selected.channel].label}
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── RIGHT: contact + actions — desktop only ── */}
      {selected && (
        <aside className="hidden md:block w-[280px] flex-shrink-0 border-l border-white/5 overflow-y-auto">
          <ContactPanel conversation={selected} contact={contact} onStatus={(s) => setStatus(selected.id, s)} />
        </aside>
      )}
    </div>
  );
}

// ── Conversation row ─────────────────────────────────────────────────
function ConversationRow({
  c,
  active,
  onClick,
}: {
  c: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  const meta = CHANNEL_META[c.channel];
  const name =
    c.contact?.business_name || c.contact?.contact_name || c.external_thread_id;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-white/5 transition ${
        active ? "bg-amber-400/10" : "hover:bg-white/3"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${meta.tone}`}>
            {meta.icon}
          </span>
          <span className={`text-sm truncate ${c.unread_count > 0 ? "font-semibold text-white" : "text-white/80"}`}>
            {name}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {c.unread_count > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          )}
          <span className="text-[11px] text-white/40">{fmtTime(c.last_message_at)}</span>
        </div>
      </div>
      <div className="text-xs text-white/50 truncate pl-0.5">
        {c.last_message_preview || <em className="text-white/30">No preview</em>}
      </div>
      {c.status !== "open" && (
        <div className="mt-1 text-[10px] uppercase tracking-wider text-white/40">
          {c.status}
        </div>
      )}
    </button>
  );
}

// ── Channel pill ─────────────────────────────────────────────────────
function ChannelPill({ channel }: { channel: Channel }) {
  const meta = CHANNEL_META[channel];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border ${meta.tone}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

// ── Message bubble ───────────────────────────────────────────────────
function MessageBubble({ m }: { m: Message }) {
  const inbound = m.direction === "inbound";
  return (
    <div className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          inbound
            ? "bg-white/5 text-white/90 border border-white/5"
            : "bg-amber-400/90 text-black"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{m.body || <em className="opacity-60">No content</em>}</div>
        <div className={`text-[10px] mt-1 ${inbound ? "text-white/40" : "text-black/50"}`}>
          {fmtTime(m.sent_at)}
        </div>
      </div>
    </div>
  );
}

// ── Contact panel ────────────────────────────────────────────────────
function ContactPanel({
  conversation,
  contact,
  onStatus,
}: {
  conversation: Conversation;
  contact: Conversation["contact"];
  onStatus: (s: Status) => void;
}) {
  return (
    <div className="p-4 space-y-4">
      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Contact</h3>
        {contact ? (
          <div className="space-y-1 text-sm">
            <div className="font-medium">{contact.business_name}</div>
            {contact.contact_name && (
              <div className="text-white/60 text-xs">{contact.contact_name}</div>
            )}
            {contact.email && (
              <div className="text-white/60 text-xs flex items-center gap-1.5">
                <Mail size={11} /> {contact.email}
              </div>
            )}
            {contact.phone && (
              <div className="text-white/60 text-xs flex items-center gap-1.5">
                <Phone size={11} /> {contact.phone}
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-white/40 space-y-1">
            <div>Unknown sender</div>
            <div className="font-mono text-[11px] text-white/30">
              {conversation.external_thread_id}
            </div>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Thread</h3>
        <div className="text-xs space-y-1.5 text-white/60">
          <div className="flex items-center gap-2">
            <Circle size={8} className={conversation.status === "open" ? "text-emerald-400 fill-emerald-400" : "text-white/30 fill-white/30"} />
            <span className="capitalize">{conversation.status}</span>
          </div>
          {conversation.tags && conversation.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {conversation.tags.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Actions</h3>
        <div className="space-y-1">
          <button
            onClick={() => onStatus("snoozed")}
            className="w-full text-left px-2.5 py-1.5 rounded text-xs hover:bg-white/5 flex items-center gap-2"
          >
            <Clock size={12} /> Snooze thread
          </button>
          <button
            onClick={() => onStatus("closed")}
            className="w-full text-left px-2.5 py-1.5 rounded text-xs hover:bg-white/5 flex items-center gap-2"
          >
            <CheckCircle2 size={12} /> Mark closed
          </button>
          <button
            onClick={() => onStatus("archived")}
            className="w-full text-left px-2.5 py-1.5 rounded text-xs hover:bg-white/5 flex items-center gap-2"
          >
            <Archive size={12} /> Archive
          </button>
          <button
            disabled
            className="w-full text-left px-2.5 py-1.5 rounded text-xs text-white/40 flex items-center gap-2 cursor-not-allowed"
            title="Coming soon"
          >
            <UserPlus size={12} /> Assign to teammate
          </button>
          <button
            disabled
            className="w-full text-left px-2.5 py-1.5 rounded text-xs text-white/40 flex items-center gap-2 cursor-not-allowed"
            title="Coming soon"
          >
            <Tag size={12} /> Add tag
          </button>
        </div>
      </section>

      {contact && (
        <section>
          <h3 className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Jump to</h3>
          <div className="space-y-1">
            <Link
              href={`/dashboard/clients`}
              className="block text-xs px-2.5 py-1.5 rounded hover:bg-white/5 text-white/70"
            >
              Client record →
            </Link>
            <Link
              href={`/dashboard/deals`}
              className="block text-xs px-2.5 py-1.5 rounded hover:bg-white/5 text-white/70"
            >
              Create deal →
            </Link>
          </div>
        </section>
      )}

      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Shortcuts</h3>
        <div className="text-[11px] text-white/40 space-y-0.5">
          <div>
            <kbd className="px-1 rounded bg-white/5">j</kbd> / <kbd className="px-1 rounded bg-white/5">k</kbd> next / prev
          </div>
          <div><kbd className="px-1 rounded bg-white/5">r</kbd> reply</div>
          <div><kbd className="px-1 rounded bg-white/5">e</kbd> archive</div>
          <div><kbd className="px-1 rounded bg-white/5">s</kbd> snooze</div>
          <div><kbd className="px-1 rounded bg-white/5">c</kbd> close</div>
          <div><kbd className="px-1 rounded bg-white/5">1</kbd>–<kbd className="px-1 rounded bg-white/5">9</kbd> jump filter</div>
        </div>
      </section>
    </div>
  );
}
