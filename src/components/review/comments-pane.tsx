"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock, Square, FileText, MessageCircle } from "lucide-react";
import type { ReviewComment, ReviewRegion } from "@/lib/review/types";

interface PendingPin {
  timestamp_seconds?: number;
  region?: ReviewRegion;
  page_number?: number;
}

interface Props {
  comments: ReviewComment[];
  version: number;
  activeCommentId: string | null;
  onSelectComment: (id: string | null) => void;
  pendingPin: PendingPin | null;
  onClearPendingPin: () => void;
  onSubmitComment: (params: {
    content: string;
    author_name: string;
    author_email?: string;
    pin: PendingPin | null;
    thread_parent_id?: string | null;
    page_number?: number;
  }) => Promise<void>;
  onToggleResolved?: (commentId: string, resolved: boolean) => Promise<void>;
  // Anonymous identity prompt — shown on first comment if null
  storedIdentity: { name: string; email: string } | null;
  onSetIdentity: (id: { name: string; email: string }) => void;
  // Mode: agency can always resolve; anon cannot
  canResolve: boolean;
  showPageNumberPicker: boolean;
}

export default function CommentsPane({
  comments,
  version,
  activeCommentId,
  onSelectComment,
  pendingPin,
  onClearPendingPin,
  onSubmitComment,
  onToggleResolved,
  storedIdentity,
  onSetIdentity,
  canResolve,
  showPageNumberPicker,
}: Props) {
  const [draft, setDraft] = useState("");
  const [nameInput, setNameInput] = useState(storedIdentity?.name ?? "");
  const [emailInput, setEmailInput] = useState(storedIdentity?.email ?? "");
  const [pageInput, setPageInput] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const versionTop = comments.filter(
    (c) => c.version === version && !c.thread_parent_id,
  );
  const replies = (parentId: string) =>
    comments.filter((c) => c.thread_parent_id === parentId);

  async function handleSubmit() {
    const content = draft.trim();
    if (!content) return;
    const name = (nameInput || storedIdentity?.name || "").trim();
    const email = (emailInput || storedIdentity?.email || "").trim();
    if (!canResolve && !name) return; // anon requires name
    setSubmitting(true);
    try {
      if (!storedIdentity && name) onSetIdentity({ name, email });
      await onSubmitComment({
        content,
        author_name: name || "Agency",
        author_email: email || undefined,
        pin: replyTo ? null : pendingPin,
        thread_parent_id: replyTo,
        page_number: showPageNumberPicker ? pageInput : undefined,
      });
      setDraft("");
      setReplyTo(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Comment list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {versionTop.length === 0 && (
          <div className="text-sm text-white/50 text-center py-8">
            No comments yet on version {version}.
          </div>
        )}
        {versionTop.map((c) => (
          <div
            key={c.id}
            className={`rounded-lg border p-3 transition-all cursor-pointer ${
              activeCommentId === c.id
                ? "border-[#C9A84C]/60 bg-[#C9A84C]/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            } ${c.resolved ? "opacity-60" : ""}`}
            onClick={() => onSelectComment(activeCommentId === c.id ? null : c.id)}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-sm text-white truncate">
                  {c.author_name}
                </span>
                {c.author_id === null && (
                  <span className="text-[10px] uppercase tracking-wide text-blue-300/70 border border-blue-300/30 rounded px-1.5">
                    client
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {c.timestamp_seconds !== null && (
                  <span className="text-[11px] text-white/60 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {formatTime(c.timestamp_seconds)}
                  </span>
                )}
                {c.region && (
                  <span className="text-[11px] text-white/60 flex items-center gap-0.5">
                    <Square className="w-3 h-3" />
                  </span>
                )}
                {c.page_number !== null && c.page_number !== undefined && (
                  <span className="text-[11px] text-white/60 flex items-center gap-0.5">
                    <FileText className="w-3 h-3" />p{c.page_number}
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-white/80 whitespace-pre-wrap">{c.content}</p>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-white/50">
              <span>{new Date(c.created_at).toLocaleString()}</span>
              {canResolve && onToggleResolved && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleResolved(c.id, !c.resolved);
                  }}
                  className="flex items-center gap-1 hover:text-white"
                >
                  {c.resolved ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Resolved
                    </>
                  ) : (
                    <>
                      <Circle className="w-3.5 h-3.5" /> Resolve
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setReplyTo(c.id);
                  onSelectComment(c.id);
                }}
                className="flex items-center gap-1 hover:text-white"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Reply
              </button>
            </div>

            {/* Replies */}
            {replies(c.id).map((r) => (
              <div
                key={r.id}
                className="mt-2 pl-3 border-l border-white/10"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-white/90">
                    {r.author_name}
                  </span>
                  <span className="text-[10px] text-white/40">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-white/70 whitespace-pre-wrap">{r.content}</p>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-white/10 p-3 space-y-2 bg-black/30">
        {!storedIdentity && !canResolve && (
          <div className="grid grid-cols-2 gap-2">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your name"
              className="px-2 py-1.5 text-sm rounded-md bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-[#C9A84C]/50"
            />
            <input
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Email (optional)"
              type="email"
              className="px-2 py-1.5 text-sm rounded-md bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-[#C9A84C]/50"
            />
          </div>
        )}

        {pendingPin && !replyTo && (
          <div className="flex items-center justify-between text-xs bg-blue-500/10 border border-blue-500/30 rounded px-2 py-1">
            <span className="text-blue-200">
              {pendingPin.timestamp_seconds !== undefined &&
                `Pin @ ${formatTime(pendingPin.timestamp_seconds)}`}
              {pendingPin.region && `Region pin set`}
              {pendingPin.page_number !== undefined &&
                `Page ${pendingPin.page_number} pin`}
            </span>
            <button
              type="button"
              onClick={onClearPendingPin}
              className="text-blue-200/70 hover:text-white"
            >
              Clear
            </button>
          </div>
        )}

        {replyTo && (
          <div className="flex items-center justify-between text-xs bg-white/5 border border-white/10 rounded px-2 py-1">
            <span className="text-white/70">Replying to comment</span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="text-white/70 hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}

        {showPageNumberPicker && !replyTo && (
          <div className="flex items-center gap-2 text-xs">
            <label className="text-white/60">Page</label>
            <input
              type="number"
              min={1}
              value={pageInput}
              onChange={(e) => setPageInput(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 px-2 py-1 rounded bg-white/5 border border-white/10 text-white"
            />
          </div>
        )}

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            replyTo
              ? "Write a reply..."
              : pendingPin
                ? "Add a comment at this pin..."
                : "Add a comment — click the asset first to pin it to a location"
          }
          rows={3}
          className="w-full px-2 py-1.5 text-sm rounded-md bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-[#C9A84C]/50 resize-none"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !draft.trim() || (!canResolve && !(nameInput || storedIdentity?.name))}
          className="w-full py-2 rounded-md bg-[#C9A84C] text-black font-semibold text-sm hover:bg-[#d4b559] disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {submitting ? "Posting..." : replyTo ? "Post reply" : "Post comment"}
        </button>
      </div>
    </div>
  );
}

function formatTime(s: number | null | undefined): string {
  if (s === null || s === undefined) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}
