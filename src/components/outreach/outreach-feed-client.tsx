"use client";

/**
 * Unified Outreach Feed — chat-bubble client.
 *
 * Two-pane Gmail-style layout:
 *   LEFT  : contact list with search + channel filter chips
 *   RIGHT : open thread with chat-bubble timeline + composer / call buttons
 *
 * The component is render-mode aware:
 *   mode="agency"  -> full feature set (reply, call, manual classify)
 *   mode="portal"  -> read-only by default; respects `clientCanReply`
 *                     to allow inline replies for white-label deployments
 *                     where the agency has enabled it.
 *
 * Data flow: every action goes through the /api/outreach/* endpoints — no
 * direct supabase queries from the client. That keeps RLS + portal scope
 * enforcement on the server.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronLeft,
  Loader2,
  Phone,
  PhoneCall,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import OutcomeChip from "./outcome-chip";
import ChannelIcon from "./channel-icon";
import type {
  ContactKind,
  OutreachChannel,
  OutreachConversation,
  OutreachEvent,
  OutreachOutcome,
  OutreachThreadSummary,
} from "@/lib/outreach/types";

interface OutreachFeedClientProps {
  mode: "agency" | "portal";
  /** Portal-only: scope conversations to this client's contacts. */
  clientId?: string | null;
  /** Portal-only: allow the client portal user to send replies. */
  clientCanReply?: boolean;
}

interface ThreadResponse {
  events: OutreachEvent[];
  contact: {
    id: string;
    kind: ContactKind;
    name: string;
    email?: string;
    phone?: string;
    client_id: string | null;
  } | null;
  summary: OutreachThreadSummary;
}

const CHANNEL_FILTERS: Array<{ key: OutreachChannel; label: string }> = [
  { key: "voice_call", label: "Calls" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "dm", label: "DMs" },
];

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function pickReplyChannel(
  events: OutreachEvent[],
  override: OutreachChannel | null,
): "email" | "sms" | "dm" {
  if (override && override !== "voice_call") return override;
  // Default: most recent non-call channel.
  for (let i = events.length - 1; i >= 0; i--) {
    const ch = events[i].channel;
    if (ch !== "voice_call") return ch;
  }
  return "email";
}

export default function OutreachFeedClient({
  mode,
  clientId = null,
  clientCanReply = false,
}: OutreachFeedClientProps) {
  const [conversations, setConversations] = useState<OutreachConversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadResponse | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<OutreachChannel | null>(null);
  const [composer, setComposer] = useState("");
  const [composerSubject, setComposerSubject] = useState("");
  const [composerChannel, setComposerChannel] = useState<OutreachChannel | null>(null);
  const [sending, setSending] = useState(false);
  const [calling, setCalling] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const canReply = mode === "agency" || clientCanReply;
  const canCall = mode === "agency";

  const fetchConversations = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("q", search.trim());
        if (channelFilter) params.set("channel", channelFilter);
        if (clientId) params.set("client_id", clientId);
        const res = await fetch(`/api/outreach/conversations?${params.toString()}`, {
          signal,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `${res.status}`);
        }
        const data = await res.json();
        setConversations(data.conversations || []);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        toast.error(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!signal?.aborted) setLoadingList(false);
      }
    },
    [search, channelFilter, clientId],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    setLoadingList(true);
    fetchConversations(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchConversations]);

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    return conversations.find((c) => `${c.contact_kind}:${c.contact_id}` === selectedKey) || null;
  }, [conversations, selectedKey]);

  const fetchThread = useCallback(async (key: string) => {
    setLoadingThread(true);
    setThread(null);
    try {
      const [kind, id] = key.split(":") as [ContactKind, string];
      const res = await fetch(`/api/outreach/conversations/${id}?kind=${kind}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `${res.status}`);
      }
      const data = (await res.json()) as ThreadResponse;
      setThread(data);
      // Fire-and-forget mark-read.
      fetch(`/api/outreach/conversations/${id}/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      })
        .then(() => {
          setConversations((prev) =>
            prev.map((c) =>
              `${c.contact_kind}:${c.contact_id}` === key ? { ...c, unread_count: 0 } : c,
            ),
          );
        })
        .catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Thread load failed");
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    if (selectedKey) fetchThread(selectedKey);
  }, [selectedKey, fetchThread]);

  // Auto-scroll to the latest bubble when the thread loads/grows.
  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [thread?.events.length]);

  const handleSendReply = useCallback(async () => {
    if (!thread || !thread.contact || !canReply) return;
    const text = composer.trim();
    if (!text) return;
    const channel = pickReplyChannel(thread.events, composerChannel);
    setSending(true);
    try {
      const res = await fetch("/api/outreach/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: thread.contact.id,
          contact_kind: thread.contact.kind,
          channel,
          body: text,
          subject: channel === "email" ? composerSubject || "Following up" : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      toast.success(`Sent via ${channel}`);
      setComposer("");
      setComposerSubject("");
      // Refresh thread.
      if (selectedKey) await fetchThread(selectedKey);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }, [thread, composer, composerSubject, composerChannel, canReply, selectedKey, fetchThread]);

  const handleCall = useCallback(
    async (callMode: "ai" | "human") => {
      if (!thread || !thread.contact || !canCall) return;
      setCalling(true);
      try {
        const res = await fetch("/api/outreach/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contact_id: thread.contact.id,
            contact_kind: thread.contact.kind,
            mode: callMode,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Call failed");
        toast.success(callMode === "ai" ? "AI agent dialing" : "Bridging your phone");
        if (selectedKey) await fetchThread(selectedKey);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Call failed");
      } finally {
        setCalling(false);
      }
    },
    [thread, canCall, selectedKey, fetchThread],
  );

  return (
    <div
      className="flex h-[calc(100vh-14rem)] min-h-[480px] rounded-xl border border-[rgba(0,0,0,0.08)] overflow-hidden"
      style={{ background: "rgba(255,255,255,0.88)" }}
    >
      {/* LEFT: contact list */}
      <aside className="w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-[rgba(0,0,0,0.06)] flex flex-col">
        <div className="p-4 border-b border-[rgba(0,0,0,0.06)] space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-[rgba(0,0,0,0.10)] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#D4FF00]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setChannelFilter(null)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                !channelFilter
                  ? "bg-[rgba(212,255,0,0.10)] text-[#D4FF00] border-[rgba(212,255,0,0.30)]"
                  : "bg-[rgba(0,0,0,0.04)] text-[#6B7280] border-[rgba(0,0,0,0.08)] hover:text-[#111827]"
              }`}
            >
              All
            </button>
            {CHANNEL_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setChannelFilter(f.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors flex items-center gap-1 ${
                  channelFilter === f.key
                    ? "bg-[rgba(212,255,0,0.10)] text-[#D4FF00] border-[rgba(212,255,0,0.30)]"
                    : "bg-[rgba(0,0,0,0.04)] text-[#6B7280] border-[rgba(0,0,0,0.08)] hover:text-[#111827]"
                }`}
              >
                <ChannelIcon channel={f.key} size={11} />
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="flex items-center justify-center h-32 text-text-muted text-xs">
              <Loader2 size={14} className="animate-spin mr-2" /> Loading…
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-text-muted text-xs px-6 py-8">
              No conversations yet. Outreach activity will appear here as soon as you start sending email, SMS, DMs, or making calls.
            </div>
          ) : (
            <ul>
              {conversations.map((c) => {
                const key = `${c.contact_kind}:${c.contact_id}`;
                const isActive = key === selectedKey;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      className={`w-full text-left px-4 py-3 border-b border-[rgba(0,0,0,0.06)] transition-colors ${
                        isActive ? "bg-[rgba(212,255,0,0.06)]" : "hover:bg-[rgba(0,0,0,0.03)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-[#111827] truncate">{c.contact_name}</span>
                        <span className="text-[10px] text-text-muted shrink-0">
                          {formatTimestamp(c.last_message.ts)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {c.channels_used.map((ch) => (
                          <ChannelIcon key={ch} channel={ch} size={11} />
                        ))}
                        <OutcomeChip outcome={c.last_outcome as OutreachOutcome} />
                        {c.unread_count > 0 && (
                          <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#D4FF00] text-[10px] font-bold text-[#020711] px-1">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6B7280] truncate">
                        {c.last_message.direction === "out" ? "→ " : "← "}
                        {c.last_message.body || "(empty)"}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* RIGHT: thread */}
      <section className="flex-1 flex flex-col min-w-0">
        {!selected || !thread ? (
          <div className="flex-1 flex items-center justify-center text-[#6B7280] text-sm">
            {selectedKey ? (
              loadingThread ? (
                <span className="inline-flex items-center">
                  <Loader2 size={14} className="animate-spin mr-2" /> Loading thread…
                </span>
              ) : (
                "Thread unavailable"
              )
            ) : (
              "Select a contact to see the conversation"
            )}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.06)] flex items-start gap-3">
              <button
                type="button"
                onClick={() => setSelectedKey(null)}
                className="md:hidden text-[#6B7280] hover:text-[#111827]"
                aria-label="Back to list"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-[#111827] truncate">{selected.contact_name}</h2>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#6B7280] mt-0.5">
                  {selected.contact_email && <span>{selected.contact_email}</span>}
                  {selected.contact_phone && <span>{selected.contact_phone}</span>}
                  {selected.client_id && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[rgba(212,255,0,0.10)] border border-[rgba(212,255,0,0.25)] text-[#D4FF00]">
                      Client
                    </span>
                  )}
                  <span>{selected.total_interactions} interactions</span>
                </div>
              </div>
            </div>

            {/* AI summary card */}
            {thread.summary?.summary && (
              <div className="px-5 pt-3">
                <div className="flex items-start gap-2 rounded-xl border border-[rgba(212,255,0,0.20)] bg-[rgba(212,255,0,0.05)] px-3 py-2.5">
                  <Sparkles size={14} className="text-[#D4FF00] mt-0.5 shrink-0" />
                  <div className="text-xs text-[#374151] leading-relaxed flex-1">
                    <p>{thread.summary.summary}</p>
                    {thread.summary.suggested_action && (
                      <p className="mt-1 text-[#D4FF00]">
                        Next: {thread.summary.suggested_action}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bubbles */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {thread.events.length === 0 ? (
                <div className="text-center text-text-muted text-xs py-8">
                  No interactions logged yet.
                </div>
              ) : (
                thread.events.map((e) => <BubbleItem key={e.id} event={e} />)
              )}
              <div ref={threadEndRef} />
            </div>

            {/* Action bar */}
            <div className="border-t border-[rgba(0,0,0,0.06)] p-3 space-y-2 bg-[rgba(0,0,0,0.02)]">
              {canCall && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCall("ai")}
                    disabled={calling || !selected.contact_phone}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(212,255,0,0.08)] border border-[rgba(212,255,0,0.25)] text-[#D4FF00] text-xs font-medium hover:bg-[rgba(212,255,0,0.14)] disabled:opacity-40"
                  >
                    <PhoneCall size={13} />
                    Call back AI
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCall("human")}
                    disabled={calling || !selected.contact_phone}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(0,0,0,0.04)] border border-[rgba(0,0,0,0.08)] text-[#374151] text-xs font-medium hover:bg-[rgba(0,0,0,0.08)] disabled:opacity-40"
                  >
                    <Phone size={13} />
                    Call back manual
                  </button>
                  {!selected.contact_phone && (
                    <span className="text-[10px] text-text-muted">No phone on contact</span>
                  )}
                </div>
              )}

              {canReply ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-[#6B7280]">Reply via:</span>
                    {(["email", "sms", "dm"] as const).map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() =>
                          setComposerChannel(composerChannel === ch ? null : ch)
                        }
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                          composerChannel === ch ||
                          (!composerChannel && pickReplyChannel(thread.events, null) === ch)
                            ? "bg-[rgba(212,255,0,0.10)] text-[#D4FF00] border-[rgba(212,255,0,0.30)]"
                            : "bg-[rgba(0,0,0,0.04)] text-[#6B7280] border-[rgba(0,0,0,0.08)] hover:text-[#111827]"
                        }`}
                      >
                        {ch.toUpperCase()}
                      </button>
                    ))}
                    {composerChannel && (
                      <button
                        type="button"
                        onClick={() => setComposerChannel(null)}
                        className="text-[10px] text-text-muted hover:text-[#111827] inline-flex items-center gap-0.5"
                      >
                        <X size={10} /> auto
                      </button>
                    )}
                  </div>
                  {(composerChannel === "email" ||
                    pickReplyChannel(thread.events, composerChannel) === "email") && (
                    <input
                      type="text"
                      value={composerSubject}
                      onChange={(e) => setComposerSubject(e.target.value)}
                      placeholder="Subject (optional)"
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-[rgba(0,0,0,0.10)] text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#D4FF00]"
                    />
                  )}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={composer}
                      onChange={(e) => setComposer(e.target.value)}
                      placeholder="Write a reply…"
                      rows={2}
                      className="flex-1 px-3 py-2 rounded-lg bg-white border border-[rgba(0,0,0,0.10)] text-sm text-[#111827] placeholder-[#9CA3AF] resize-none focus:outline-none focus:border-[#D4FF00]"
                    />
                    <button
                      type="button"
                      onClick={handleSendReply}
                      disabled={sending || !composer.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D4FF00] text-[#020711] text-sm font-semibold hover:bg-[#D4FF00] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      Send
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-text-muted text-center py-2">
                  Read-only — replies are managed by your agency.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

interface BubbleItemProps {
  event: OutreachEvent;
}

function BubbleItem({ event }: BubbleItemProps) {
  const [expanded, setExpanded] = useState(false);
  const isOutbound = event.direction === "out";
  const align = isOutbound ? "items-end ml-auto" : "items-start mr-auto";
  const tone = isOutbound
    ? "bg-[rgba(212,255,0,0.08)] border-[rgba(212,255,0,0.20)] text-[#111827]"
    : "bg-[rgba(0,0,0,0.04)] border-[rgba(0,0,0,0.08)] text-[#374151]";

  if (event.channel === "voice_call") {
    return (
      <div className={`flex flex-col ${align} max-w-[90%] sm:max-w-[75%]`}>
        <div
          className={` border px-3 py-2 ${tone} ${isOutbound ? "rounded-br-md" : "rounded-bl-md"}`}
        >
          <div className="flex items-center gap-2 text-xs">
            <ChannelIcon channel="voice_call" size={13} />
            <span className="font-medium">{event.body}</span>
            {event.outcome && <OutcomeChip outcome={event.outcome} />}
          </div>
          {event.transcript && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-[10px] text-[#D4FF00] hover:underline"
            >
              {expanded ? "Hide transcript" : "Show transcript"}
            </button>
          )}
          {expanded && event.transcript && (
            <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-snug text-[#374151] max-h-64 overflow-y-auto">
              {event.transcript}
            </pre>
          )}
        </div>
        <span className="text-[10px] text-text-muted mt-0.5 px-1">{formatTimestamp(event.ts)}</span>
      </div>
    );
  }

  // Email/SMS/DM bubbles
  const isEmail = event.channel === "email";
  const widthClass = isEmail ? "max-w-[92%] sm:max-w-[80%]" : "max-w-[85%] sm:max-w-[65%]";

  return (
    <div className={`flex flex-col ${align} ${widthClass}`}>
      <div className={` border px-3 py-2 ${tone} ${isOutbound ? "rounded-br-md" : "rounded-bl-md"}`}>
        <div className="flex items-center gap-2 text-[10px] text-[#6B7280] mb-1">
          <ChannelIcon channel={event.channel} size={11} />
          <span className="uppercase tracking-wider">{event.channel}</span>
          {event.outcome && <OutcomeChip outcome={event.outcome} />}
          {event.attachment_count && (
            <span className="text-[10px] text-text-muted">+{event.attachment_count} attached</span>
          )}
        </div>
        {isEmail && event.subject && (
          <p className="text-xs font-semibold text-[#111827] mb-1">{event.subject}</p>
        )}
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{event.body || "(empty)"}</p>
      </div>
      <span className="text-[10px] text-text-muted mt-0.5 px-1">{formatTimestamp(event.ts)}</span>
    </div>
  );
}
