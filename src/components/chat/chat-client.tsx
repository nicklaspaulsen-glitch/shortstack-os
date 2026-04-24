"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_REACTIONS,
  EDIT_WINDOW_MS,
  type ChannelListItem,
  type ChatMessage,
  type ChatReaction,
  type MentionRow,
} from "@/lib/chat/types";

/* -------------------------------------------------------------------- */
/* Constants + helpers                                                   */
/* -------------------------------------------------------------------- */

const EMOJI_PICKER = [
  "👍", "❤️", "😂", "🎉", "🔥", "💡",
  "👀", "🙏", "😮", "😢", "✅", "❌",
  "🚀", "🤔", "💯", "🙌", "🫡", "🤝",
  "😎", "⭐",
] as const;

type MessageWithMeta = ChatMessage & {
  reactions: ChatReaction[];
  reply_count: number;
  sender_name?: string;
  sender_email?: string;
};

type OrgMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  role?: string | null;
};

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const sameDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function displayName(m: { full_name?: string | null; email?: string | null }): string {
  return m.full_name || (m.email ? m.email.split("@")[0] : "Unknown");
}

/** Render message content: bold/italic, inline code, links, @mentions. */
function renderContent(content: string, mentions: string[] = []): React.ReactNode {
  if (!content) return <span className="italic text-neutral-500">(deleted)</span>;
  // Very lightweight markdown-ish formatting — avoids an extra dep.
  const parts: React.ReactNode[] = [];
  const lines = content.split("\n");
  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) parts.push(<br key={`br-${lineIdx}`} />);
    // Tokenize: @mentions | code | **bold** | *italic* | links | text
    const tokenRe =
      /(@[a-zA-Z0-9_.-]{2,64})|(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(https?:\/\/[^\s]+)/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    let tokenKey = 0;
    while ((match = tokenRe.exec(line)) !== null) {
      if (match.index > lastIdx) {
        parts.push(line.slice(lastIdx, match.index));
      }
      const tok = match[0];
      const k = `tk-${lineIdx}-${tokenKey++}`;
      if (tok.startsWith("@")) {
        parts.push(
          <span
            key={k}
            className={`${mentions.length > 0 ? "text-blue-400" : "text-blue-400"} bg-blue-500/10 px-1 rounded`}
          >
            {tok}
          </span>,
        );
      } else if (tok.startsWith("`") && tok.endsWith("`")) {
        parts.push(
          <code key={k} className="px-1 bg-neutral-800 rounded text-xs font-mono">
            {tok.slice(1, -1)}
          </code>,
        );
      } else if (tok.startsWith("**") && tok.endsWith("**")) {
        parts.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
      } else if (tok.startsWith("*") && tok.endsWith("*")) {
        parts.push(<em key={k}>{tok.slice(1, -1)}</em>);
      } else if (tok.startsWith("http")) {
        parts.push(
          <a
            key={k}
            href={tok}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline"
          >
            {tok}
          </a>,
        );
      }
      lastIdx = match.index + tok.length;
    }
    if (lastIdx < line.length) parts.push(line.slice(lastIdx));
  });
  return <>{parts}</>;
}

/* -------------------------------------------------------------------- */
/* Main component                                                        */
/* -------------------------------------------------------------------- */

export default function ChatClient() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [channels, setChannels] = useState<ChannelListItem[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageWithMeta[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<MessageWithMeta[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [mentionsView, setMentionsView] = useState(false);
  const [mentions, setMentions] = useState<MentionRow[]>([]);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showDmPicker, setShowDmPicker] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const senderCacheRef = useRef<Map<string, OrgMember>>(new Map());

  /* ------------------------- URL sync ---------------------------- */

  // Load from URL on mount / on change.
  useEffect(() => {
    const ch = sp.get("channel");
    const th = sp.get("thread");
    if (ch && ch !== activeChannelId) setActiveChannelId(ch);
    if (th !== threadRootId) setThreadRootId(th);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const updateUrl = useCallback(
    (channelId: string | null, threadId: string | null) => {
      const params = new URLSearchParams();
      if (channelId) params.set("channel", channelId);
      if (threadId) params.set("thread", threadId);
      const qs = params.toString();
      router.replace(qs ? `/dashboard/chat?${qs}` : `/dashboard/chat`, { scroll: false });
    },
    [router],
  );

  /* ----------------------- Load channels ------------------------- */

  const loadChannels = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const res = await fetch("/api/chat/channels", { cache: "no-store" });
      const json = await res.json();
      const list = (json.channels || []) as ChannelListItem[];
      setChannels(list);
      // Auto-seed defaults on cold start (no channels + user is agency owner).
      if (list.length === 0 && !sp.get("channel")) {
        await fetch("/api/chat/seed-defaults", { method: "POST" });
        const r2 = await fetch("/api/chat/channels", { cache: "no-store" });
        const j2 = await r2.json();
        setChannels((j2.channels || []) as ChannelListItem[]);
      }
    } catch {
      setChannels([]);
    } finally {
      setChannelsLoading(false);
    }
  }, [sp]);

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/members", { cache: "no-store" });
      const json = await res.json();
      const mm = (json.members || []) as OrgMember[];
      setMembers(mm);
      mm.forEach((m) => senderCacheRef.current.set(m.id, m));
    } catch {
      setMembers([]);
    }
  }, []);

  useEffect(() => {
    if (user && !authLoading) {
      loadChannels();
      loadMembers();
    }
  }, [user, authLoading, loadChannels, loadMembers]);

  // Pick first channel if none selected after channels load.
  useEffect(() => {
    if (!activeChannelId && channels.length > 0 && !sp.get("channel") && !mentionsView) {
      const first = channels[0].id;
      setActiveChannelId(first);
      updateUrl(first, null);
    }
  }, [channels, activeChannelId, sp, mentionsView, updateUrl]);

  /* ----------------------- Load messages ------------------------- */

  const enrichMessages = useCallback(
    (msgs: MessageWithMeta[]): MessageWithMeta[] => {
      return msgs.map((m) => {
        const cached = senderCacheRef.current.get(m.sender_id);
        return cached
          ? {
              ...m,
              sender_name: cached.full_name || undefined,
              sender_email: cached.email || undefined,
            }
          : m;
      });
    },
    [],
  );

  const loadMessages = useCallback(
    async (channelId: string) => {
      setMessagesLoading(true);
      try {
        const res = await fetch(`/api/chat/channels/${channelId}/messages`, {
          cache: "no-store",
        });
        const json = await res.json();
        setMessages(enrichMessages((json.messages || []) as MessageWithMeta[]));
        // mark read
        await fetch(`/api/chat/channels/${channelId}/read`, { method: "POST" });
        // refresh channel list to clear unread badge
        loadChannels();
      } catch {
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    },
    [enrichMessages, loadChannels],
  );

  const loadThread = useCallback(
    async (rootId: string, channelId: string) => {
      try {
        const res = await fetch(
          `/api/chat/channels/${channelId}/messages?thread=${rootId}`,
          { cache: "no-store" },
        );
        const json = await res.json();
        setThreadMessages(enrichMessages((json.messages || []) as MessageWithMeta[]));
      } catch {
        setThreadMessages([]);
      }
    },
    [enrichMessages],
  );

  useEffect(() => {
    if (!activeChannelId || mentionsView) return;
    loadMessages(activeChannelId);
  }, [activeChannelId, mentionsView, loadMessages]);

  useEffect(() => {
    if (!activeChannelId || !threadRootId) {
      setThreadMessages([]);
      return;
    }
    loadThread(threadRootId, activeChannelId);
  }, [activeChannelId, threadRootId, loadThread]);

  /* ----------------------- Mentions view ------------------------- */

  const loadMentions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/mentions", { cache: "no-store" });
      const json = await res.json();
      setMentions((json.mentions || []) as MentionRow[]);
    } catch {
      setMentions([]);
    }
  }, []);

  useEffect(() => {
    if (mentionsView) loadMentions();
  }, [mentionsView, loadMentions]);

  /* ----------------------- Realtime ------------------------------ */

  useEffect(() => {
    if (!activeChannelId) return;
    const channel = supabase
      .channel(`chat:${activeChannelId}`)
      .on(
        // @ts-expect-error realtime event union narrows at runtime
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${activeChannelId}`,
        },
        () => {
          loadMessages(activeChannelId);
          if (threadRootId) loadThread(threadRootId, activeChannelId);
        },
      )
      .on(
        // @ts-expect-error realtime event union narrows at runtime
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => {
          loadMessages(activeChannelId);
          if (threadRootId) loadThread(threadRootId, activeChannelId);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannelId, threadRootId, supabase, loadMessages, loadThread]);

  /* ----------------------- Auto-scroll --------------------------- */

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (threadScrollRef.current) {
      threadScrollRef.current.scrollTop = threadScrollRef.current.scrollHeight;
    }
  }, [threadMessages]);

  /* ----------------------- Actions ------------------------------- */

  const sendMessage = useCallback(
    async (content: string, threadParentId: string | null) => {
      if (!activeChannelId || !content.trim()) return;
      await fetch(`/api/chat/channels/${activeChannelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, thread_parent_id: threadParentId }),
      });
      // Realtime will refresh; force one quick load for immediate feedback.
      loadMessages(activeChannelId);
      if (threadParentId) loadThread(threadParentId, activeChannelId);
    },
    [activeChannelId, loadMessages, loadThread],
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user) return;
      // Optimistic
      const toggle = (list: MessageWithMeta[]) =>
        list.map((m) => {
          if (m.id !== messageId) return m;
          const has = m.reactions.some(
            (r) => r.user_id === user.id && r.emoji === emoji,
          );
          const next = has
            ? m.reactions.filter(
                (r) => !(r.user_id === user.id && r.emoji === emoji),
              )
            : [
                ...m.reactions,
                {
                  message_id: messageId,
                  user_id: user.id,
                  emoji,
                  created_at: new Date().toISOString(),
                },
              ];
          return { ...m, reactions: next };
        });
      setMessages(toggle);
      setThreadMessages(toggle);
      await fetch(`/api/chat/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
    },
    [user],
  );

  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      await fetch(`/api/chat/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
      });
      if (activeChannelId) loadMessages(activeChannelId);
      if (threadRootId && activeChannelId) loadThread(threadRootId, activeChannelId);
    },
    [activeChannelId, threadRootId, loadMessages, loadThread],
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      await fetch(`/api/chat/messages/${messageId}`, { method: "DELETE" });
      if (activeChannelId) loadMessages(activeChannelId);
      if (threadRootId && activeChannelId) loadThread(threadRootId, activeChannelId);
    },
    [activeChannelId, threadRootId, loadMessages, loadThread],
  );

  const openThread = useCallback(
    (messageId: string) => {
      setThreadRootId(messageId);
      updateUrl(activeChannelId, messageId);
    },
    [activeChannelId, updateUrl],
  );

  const closeThread = useCallback(() => {
    setThreadRootId(null);
    updateUrl(activeChannelId, null);
  }, [activeChannelId, updateUrl]);

  const selectChannel = useCallback(
    (id: string) => {
      setMentionsView(false);
      setActiveChannelId(id);
      setThreadRootId(null);
      updateUrl(id, null);
    },
    [updateUrl],
  );

  const openDm = useCallback(
    async (otherUserId: string) => {
      const res = await fetch(`/api/chat/dms/${otherUserId}`, { cache: "no-store" });
      const json = await res.json();
      if (json?.channel?.id) {
        await loadChannels();
        selectChannel(json.channel.id);
      }
      setShowDmPicker(false);
    },
    [loadChannels, selectChannel],
  );

  /* ----------------------- Render -------------------------------- */

  if (authLoading) {
    return (
      <div className="p-8 text-neutral-400">Loading…</div>
    );
  }
  if (!user) {
    return (
      <div className="p-8 text-neutral-300">
        Please sign in to use team chat.
      </div>
    );
  }

  const activeChannel = channels.find((c) => c.id === activeChannelId) || null;
  const threadRoot = threadRootId
    ? messages.find((m) => m.id === threadRootId)
    : null;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-neutral-950 text-neutral-100">
      {/* LEFT PANE — Channels */}
      <aside className="w-64 shrink-0 border-r border-neutral-800 flex flex-col">
        <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
          <h2 className="font-semibold text-sm">Chat</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setShowChannelModal(true)}
              className="text-xs px-2 py-1 rounded hover:bg-neutral-800"
              title="New channel"
            >
              + Channel
            </button>
          </div>
        </div>
        <button
          onClick={() => {
            setMentionsView(true);
            setActiveChannelId(null);
            setThreadRootId(null);
            updateUrl(null, null);
          }}
          className={`text-left px-3 py-2 text-sm border-b border-neutral-800 hover:bg-neutral-900 ${
            mentionsView ? "bg-neutral-900" : ""
          }`}
        >
          @ Mentions
        </button>
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500">
            Channels
          </div>
          {channelsLoading && (
            <div className="px-3 py-2 text-xs text-neutral-500">Loading…</div>
          )}
          {!channelsLoading && channels.length === 0 && (
            <div className="px-3 py-2 text-xs text-neutral-500">
              No channels yet. Seeding defaults…
            </div>
          )}
          {channels
            .filter((c) => c.channel_type !== "dm")
            .map((c) => (
              <button
                key={c.id}
                onClick={() => selectChannel(c.id)}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between hover:bg-neutral-900 ${
                  activeChannelId === c.id ? "bg-neutral-900" : ""
                }`}
              >
                <span className="truncate">
                  <span className="text-neutral-500 mr-1">#</span>
                  {c.name}
                </span>
                {typeof c.unread_count === "number" && c.unread_count > 0 && (
                  <span className="ml-2 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">
                    {c.unread_count}
                  </span>
                )}
              </button>
            ))}

          <div className="px-3 py-2 mt-3 text-xs uppercase tracking-wide text-neutral-500 flex items-center justify-between">
            <span>Direct Messages</span>
            <button
              onClick={() => setShowDmPicker(true)}
              className="text-neutral-400 hover:text-neutral-100"
              title="Start DM"
            >
              +
            </button>
          </div>
          {channels
            .filter((c) => c.channel_type === "dm")
            .map((c) => {
              const ids = c.name.split(":");
              const otherId = ids.find((id) => id !== user.id) || "";
              const other = senderCacheRef.current.get(otherId);
              const label = other ? displayName(other) : "DM";
              return (
                <button
                  key={c.id}
                  onClick={() => selectChannel(c.id)}
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between hover:bg-neutral-900 ${
                    activeChannelId === c.id ? "bg-neutral-900" : ""
                  }`}
                >
                  <span className="truncate">{label}</span>
                  {typeof c.unread_count === "number" && c.unread_count > 0 && (
                    <span className="ml-2 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">
                      {c.unread_count}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </aside>

      {/* CENTER PANE — Messages */}
      <main className="flex-1 flex flex-col min-w-0">
        {mentionsView ? (
          <MentionsPane
            mentions={mentions}
            onOpen={(channelId, messageId) => {
              setMentionsView(false);
              setActiveChannelId(channelId);
              setThreadRootId(null);
              updateUrl(channelId, null);
              // Deep scroll to message — keep simple for now.
              void messageId;
            }}
          />
        ) : activeChannel ? (
          <>
            <header className="px-4 py-3 border-b border-neutral-800">
              <h1 className="font-semibold">
                {activeChannel.channel_type === "dm"
                  ? (() => {
                      const ids = activeChannel.name.split(":");
                      const otherId = ids.find((id) => id !== user.id) || "";
                      const other = senderCacheRef.current.get(otherId);
                      return other ? displayName(other) : "DM";
                    })()
                  : `# ${activeChannel.name}`}
              </h1>
              {activeChannel.description && (
                <p className="text-xs text-neutral-400">{activeChannel.description}</p>
              )}
            </header>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messagesLoading && (
                <div className="text-neutral-500 text-sm">Loading…</div>
              )}
              {!messagesLoading && messages.length === 0 && (
                <div className="text-neutral-500 text-sm">
                  No messages yet. Say hi 👋
                </div>
              )}
              {messages.map((m) => (
                <MessageRow
                  key={m.id}
                  m={m}
                  currentUserId={user.id}
                  onReact={toggleReaction}
                  onOpenThread={openThread}
                  onEdit={editMessage}
                  onDelete={deleteMessage}
                />
              ))}
            </div>
            <MessageComposer onSend={(c) => sendMessage(c, null)} members={members} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-500">
            Select a channel to start chatting
          </div>
        )}
      </main>

      {/* RIGHT PANE — Thread */}
      {threadRootId && activeChannelId && (
        <aside className="w-96 shrink-0 border-l border-neutral-800 flex flex-col">
          <header className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
            <h2 className="font-semibold">Thread</h2>
            <button
              onClick={closeThread}
              className="text-neutral-400 hover:text-neutral-100"
            >
              ×
            </button>
          </header>
          <div ref={threadScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {threadRoot && (
              <MessageRow
                m={threadRoot}
                currentUserId={user.id}
                onReact={toggleReaction}
                onOpenThread={() => {}}
                onEdit={editMessage}
                onDelete={deleteMessage}
                hideThreadButton
              />
            )}
            <div className="border-t border-neutral-800 pt-3">
              {threadMessages.map((m) => (
                <MessageRow
                  key={m.id}
                  m={m}
                  currentUserId={user.id}
                  onReact={toggleReaction}
                  onOpenThread={() => {}}
                  onEdit={editMessage}
                  onDelete={deleteMessage}
                  hideThreadButton
                />
              ))}
            </div>
          </div>
          <MessageComposer
            onSend={(c) => sendMessage(c, threadRootId)}
            members={members}
            placeholder="Reply in thread…"
          />
        </aside>
      )}

      {/* Modals */}
      {showChannelModal && (
        <ChannelCreateModal
          onClose={() => setShowChannelModal(false)}
          onCreated={(id) => {
            setShowChannelModal(false);
            loadChannels();
            selectChannel(id);
          }}
        />
      )}
      {showDmPicker && (
        <DmPickerModal
          members={members.filter((m) => m.id !== user.id)}
          onPick={openDm}
          onClose={() => setShowDmPicker(false)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* Sub-components                                                        */
/* -------------------------------------------------------------------- */

function MessageRow({
  m,
  currentUserId,
  onReact,
  onOpenThread,
  onEdit,
  onDelete,
  hideThreadButton,
}: {
  m: MessageWithMeta;
  currentUserId: string;
  onReact: (messageId: string, emoji: string) => void;
  onOpenThread: (messageId: string) => void;
  onEdit: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
  hideThreadButton?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.content);
  const [showPicker, setShowPicker] = useState(false);
  const isMine = m.sender_id === currentUserId;
  const editable =
    isMine &&
    !m.deleted_at &&
    Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW_MS;

  // Aggregate reactions by emoji
  const grouped: Record<string, { count: number; userIds: string[] }> = {};
  for (const r of m.reactions || []) {
    const g = grouped[r.emoji] || { count: 0, userIds: [] };
    g.count++;
    g.userIds.push(r.user_id);
    grouped[r.emoji] = g;
  }

  return (
    <div className="group flex gap-3 hover:bg-neutral-900/50 -mx-2 px-2 py-1 rounded">
      <div className="w-8 h-8 shrink-0 rounded bg-neutral-800 flex items-center justify-center text-xs text-neutral-300">
        {(m.sender_name || m.sender_email || "?").slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-medium">
            {m.sender_name || (m.sender_email ? m.sender_email.split("@")[0] : "Unknown")}
          </span>
          <span className="text-xs text-neutral-500">{fmtTime(m.created_at)}</span>
          {m.edited_at && (
            <span className="text-xs text-neutral-500">(edited)</span>
          )}
        </div>
        {editing ? (
          <div className="mt-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-sm"
              rows={2}
            />
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => {
                  onEdit(m.id, draft);
                  setEditing(false);
                }}
                className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setDraft(m.content);
                  setEditing(false);
                }}
                className="text-xs bg-neutral-700 hover:bg-neutral-600 px-2 py-1 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-neutral-200 whitespace-pre-wrap break-words">
            {m.deleted_at ? (
              <span className="italic text-neutral-500">(deleted)</span>
            ) : (
              renderContent(m.content, m.mentions)
            )}
          </div>
        )}
        {/* Reactions */}
        {Object.keys(grouped).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(grouped).map(([emoji, g]) => {
              const mine = g.userIds.includes(currentUserId);
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(m.id, emoji)}
                  className={`text-xs px-1.5 py-0.5 rounded border ${
                    mine
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-neutral-700 bg-neutral-800/50"
                  }`}
                >
                  {emoji} {g.count}
                </button>
              );
            })}
          </div>
        )}
        {/* Reply count link */}
        {!hideThreadButton && m.reply_count > 0 && (
          <button
            onClick={() => onOpenThread(m.id)}
            className="mt-1 text-xs text-blue-400 hover:underline"
          >
            {m.reply_count} {m.reply_count === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>
      {/* Hover actions */}
      <div className="relative opacity-0 group-hover:opacity-100 flex gap-1 items-start pt-1">
        {DEFAULT_REACTIONS.slice(0, 3).map((e) => (
          <button
            key={e}
            onClick={() => onReact(m.id, e)}
            className="text-sm hover:bg-neutral-800 rounded p-1"
            title="React"
          >
            {e}
          </button>
        ))}
        <button
          onClick={() => setShowPicker((s) => !s)}
          className="text-xs text-neutral-400 hover:text-neutral-100 px-1"
          title="More reactions"
        >
          +
        </button>
        {showPicker && (
          <div className="absolute right-0 top-full mt-1 z-10 bg-neutral-800 border border-neutral-700 rounded p-2 grid grid-cols-5 gap-1 shadow-xl">
            {EMOJI_PICKER.map((e) => (
              <button
                key={e}
                onClick={() => {
                  onReact(m.id, e);
                  setShowPicker(false);
                }}
                className="hover:bg-neutral-700 rounded p-1"
              >
                {e}
              </button>
            ))}
          </div>
        )}
        {!hideThreadButton && (
          <button
            onClick={() => onOpenThread(m.id)}
            className="text-xs text-neutral-400 hover:text-neutral-100 px-1"
            title="Thread"
          >
            💬
          </button>
        )}
        {editable && (
          <>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-neutral-400 hover:text-neutral-100 px-1"
              title="Edit"
            >
              ✎
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this message?")) onDelete(m.id);
              }}
              className="text-xs text-neutral-400 hover:text-red-400 px-1"
              title="Delete"
            >
              🗑
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function MessageComposer({
  onSend,
  members,
  placeholder,
}: {
  onSend: (content: string) => void;
  members: OrgMember[];
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");

  const onChange = (v: string) => {
    setValue(v);
    // Detect ongoing @token at cursor end — cheap detector.
    const m = /(?:^|\s)@([a-zA-Z0-9_.-]*)$/.exec(v);
    if (m) {
      setMentionQuery(m[1].toLowerCase());
      setShowMentionMenu(true);
    } else {
      setShowMentionMenu(false);
    }
  };

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onSend(v);
    setValue("");
    setShowMentionMenu(false);
  };

  const filtered = mentionQuery
    ? members
        .filter((m) => {
          const local = (m.email || "").split("@")[0].toLowerCase();
          const first = (m.full_name || "").toLowerCase().split(" ")[0];
          return local.startsWith(mentionQuery) || first.startsWith(mentionQuery);
        })
        .slice(0, 5)
    : members.slice(0, 5);

  const insertMention = (m: OrgMember) => {
    const handle = m.email ? m.email.split("@")[0] : (m.full_name || "").split(" ")[0];
    const next = value.replace(/@([a-zA-Z0-9_.-]*)$/, `@${handle} `);
    setValue(next);
    setShowMentionMenu(false);
  };

  return (
    <div className="relative border-t border-neutral-800 p-3">
      {showMentionMenu && filtered.length > 0 && (
        <div className="absolute bottom-full left-3 mb-1 bg-neutral-800 border border-neutral-700 rounded shadow-xl min-w-[200px]">
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => insertMention(m)}
              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-neutral-700"
            >
              <span className="font-medium">{displayName(m)}</span>
              {m.email && (
                <span className="text-xs text-neutral-400 ml-2">{m.email}</span>
              )}
            </button>
          ))}
        </div>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
        placeholder={placeholder || "Message… (Enter to send, Shift+Enter for newline)"}
        className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-sm resize-none focus:outline-none focus:border-blue-500"
      />
      <div className="mt-1 flex justify-between items-center text-xs text-neutral-500">
        <span>
          Supports <code>**bold**</code>, <code>*italic*</code>,{" "}
          <code>`code`</code>, @mentions
        </span>
        <button
          onClick={submit}
          disabled={!value.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3 py-1 rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function ChannelCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [channelType, setChannelType] = useState<"public" | "private">("public");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          channel_type: channelType,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to create channel");
        return;
      }
      onCreated(json.channel.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6 w-96">
        <h3 className="text-lg font-semibold mb-4">New Channel</h3>
        <label className="block text-xs mb-1 text-neutral-400">Name</label>
        <input
          value={name}
          onChange={(e) =>
            setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
          }
          placeholder="e.g. marketing"
          className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-sm mb-3"
        />
        <label className="block text-xs mb-1 text-neutral-400">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional"
          className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-sm mb-3"
        />
        <label className="block text-xs mb-1 text-neutral-400">Type</label>
        <select
          value={channelType}
          onChange={(e) =>
            setChannelType(e.target.value as "public" | "private")
          }
          className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-sm mb-4"
        >
          <option value="public">Public — anyone in org can join</option>
          <option value="private">Private — invite only</option>
        </select>
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || loading}
            className="text-sm px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40"
          >
            {loading ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DmPickerModal({
  members,
  onPick,
  onClose,
}: {
  members: OrgMember[];
  onPick: (userId: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = members.filter((m) =>
    displayName(m).toLowerCase().includes(q.toLowerCase()) ||
    (m.email || "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6 w-96">
        <h3 className="text-lg font-semibold mb-4">Start a DM</h3>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search team members…"
          className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-sm mb-3"
          autoFocus
        />
        <div className="max-h-60 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="text-xs text-neutral-500 py-4 text-center">
              No team members.
            </div>
          )}
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => onPick(m.id)}
              className="block w-full text-left px-3 py-2 rounded hover:bg-neutral-800"
            >
              <div className="text-sm font-medium">{displayName(m)}</div>
              {m.email && (
                <div className="text-xs text-neutral-400">{m.email}</div>
              )}
            </button>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function MentionsPane({
  mentions,
  onOpen,
}: {
  mentions: MentionRow[];
  onOpen: (channelId: string, messageId: string) => void;
}) {
  return (
    <>
      <header className="px-4 py-3 border-b border-neutral-800">
        <h1 className="font-semibold">@ Mentions</h1>
        <p className="text-xs text-neutral-400">
          Unread messages that mention you.
        </p>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {mentions.length === 0 && (
          <div className="text-neutral-500 text-sm">No unread mentions.</div>
        )}
        {mentions.map((m) => (
          <button
            key={m.message_id}
            onClick={() => onOpen(m.channel_id, m.message_id)}
            className="block w-full text-left p-3 border border-neutral-800 rounded hover:bg-neutral-900"
          >
            <div className="text-xs text-neutral-400 mb-1">
              <span className="text-blue-400">#{m.channel_name}</span>{" "}
              · {fmtTime(m.created_at)}
            </div>
            <div className="text-sm text-neutral-200 whitespace-pre-wrap break-words">
              {m.content.length > 280
                ? m.content.slice(0, 280) + "…"
                : m.content}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
