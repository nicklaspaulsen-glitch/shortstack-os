"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Trash2 } from "lucide-react";
import {
  TASK_PRIORITIES,
  TASK_TYPES,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
  type WorkspaceTask,
  type WorkspaceTaskComment,
} from "@/lib/workspace/board";
import type { ClientLite, MemberLite } from "./board-card";

/**
 * Slide-in drawer surfacing the full task: editable description, status,
 * priority, due date, plus the comment thread. Drawer dismisses on
 * ESC or backdrop click. Edits propagate via the parent's `onPatch`
 * callback so the board stays in sync without a refetch.
 */

interface TaskDrawerProps {
  task: WorkspaceTask | null;
  comments: WorkspaceTaskComment[];
  clients: Record<string, ClientLite>;
  members: Record<string, MemberLite>;
  loading: boolean;
  canDelete: boolean;
  onClose: () => void;
  onPatch: (patch: Partial<WorkspaceTask>) => Promise<void>;
  onDelete: () => Promise<void>;
  onComment: (body: string) => Promise<void>;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.round(diff / (1000 * 60));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TaskDrawer({
  task,
  comments,
  clients,
  members,
  loading,
  canDelete,
  onClose,
  onPatch,
  onDelete,
  onComment,
}: TaskDrawerProps) {
  const [draft, setDraft] = useState<string>("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task?.title ?? "");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(task?.description ?? "");

  // Sync local edit drafts whenever the active task changes. Without this,
  // opening a different task inherits the previous task's drafts.
  useEffect(() => {
    setTitleDraft(task?.title ?? "");
    setDescDraft(task?.description ?? "");
    setEditingTitle(false);
    setEditingDesc(false);
    setDraft("");
  }, [task?.id, task?.title, task?.description]);

  // ESC closes the drawer.
  useEffect(() => {
    if (!task) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [task, onClose]);

  const handleCommentSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const body = draft.trim();
      if (!body || submittingComment) return;
      setSubmittingComment(true);
      try {
        await onComment(body);
        setDraft("");
      } finally {
        setSubmittingComment(false);
      }
    },
    [draft, submittingComment, onComment],
  );

  const saveTitle = async () => {
    const next = titleDraft.trim();
    if (!task || !next || next === task.title) {
      setEditingTitle(false);
      return;
    }
    await onPatch({ title: next });
    setEditingTitle(false);
  };

  const saveDesc = async () => {
    if (!task) return;
    if (descDraft === task.description) {
      setEditingDesc(false);
      return;
    }
    await onPatch({ description: descDraft });
    setEditingDesc(false);
  };

  return (
    <AnimatePresence>
      {task && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.aside
            key={task.id}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg bg-surface border-l border-border shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="font-mono">{task.id.slice(0, 8)}</span>
                <span>·</span>
                <span>Updated {formatTimestamp(task.updated_at)}</span>
              </div>
              <div className="flex items-center gap-1">
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this task?")) {
                        void onDelete();
                      }
                    }}
                    className="p-1.5 rounded-md text-muted hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-md hover:bg-surface-light text-muted hover:text-fg transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Title (click to edit) */}
              {editingTitle ? (
                <input
                  autoFocus
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle();
                    if (e.key === "Escape") {
                      setTitleDraft(task.title);
                      setEditingTitle(false);
                    }
                  }}
                  className="w-full px-2 py-1 -mx-2 -my-1 rounded bg-surface-light border border-[rgba(37,99,235,0.4)] text-xl font-semibold focus:outline-none"
                />
              ) : (
                <h2
                  className="text-xl font-semibold leading-tight cursor-text hover:bg-surface-light/40 -mx-2 px-2 py-1 rounded"
                  onClick={() => setEditingTitle(true)}
                >
                  {task.title}
                </h2>
              )}

              {/* Status + Priority + Type metadata grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Field label="Status">
                  <select
                    value={task.status}
                    onChange={(e) => onPatch({ status: e.target.value as TaskStatus })}
                    className="w-full px-2 py-1.5 rounded bg-surface-light border border-border focus:border-[#2563EB] focus:outline-none text-sm"
                  >
                    <option value="backlog">Backlog</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                  </select>
                </Field>
                <Field label="Priority">
                  <select
                    value={task.priority}
                    onChange={(e) =>
                      onPatch({ priority: e.target.value as TaskPriority })
                    }
                    className="w-full px-2 py-1.5 rounded bg-surface-light border border-border focus:border-[#2563EB] focus:outline-none text-sm"
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Type">
                  <select
                    value={task.type}
                    onChange={(e) => onPatch({ type: e.target.value as TaskType })}
                    className="w-full px-2 py-1.5 rounded bg-surface-light border border-border focus:border-[#2563EB] focus:outline-none text-sm"
                  >
                    {TASK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Due">
                  <input
                    type="date"
                    value={task.due_at ? task.due_at.slice(0, 10) : ""}
                    onChange={(e) =>
                      onPatch({
                        due_at: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null,
                      })
                    }
                    className="w-full px-2 py-1.5 rounded bg-surface-light border border-border focus:border-[#2563EB] focus:outline-none text-sm"
                  />
                </Field>
                <Field label="Client">
                  <select
                    value={task.client_id ?? ""}
                    onChange={(e) =>
                      onPatch({ client_id: e.target.value || null })
                    }
                    className="w-full px-2 py-1.5 rounded bg-surface-light border border-border focus:border-[#2563EB] focus:outline-none text-sm"
                  >
                    <option value="">No client</option>
                    {Object.values(clients).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.business_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Assignee">
                  <select
                    value={task.assignee_id ?? ""}
                    onChange={(e) =>
                      onPatch({ assignee_id: e.target.value || null })
                    }
                    className="w-full px-2 py-1.5 rounded bg-surface-light border border-border focus:border-[#2563EB] focus:outline-none text-sm"
                  >
                    <option value="">Unassigned</option>
                    {Object.values(members).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Description (click to edit) */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Description
                </div>
                {editingDesc ? (
                  <textarea
                    autoFocus
                    rows={5}
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    onBlur={saveDesc}
                    className="w-full px-3 py-2 rounded-lg bg-surface-light border border-[rgba(37,99,235,0.4)] text-sm resize-none focus:outline-none"
                    placeholder="Add details, links, or references..."
                  />
                ) : task.description ? (
                  <p
                    className="text-sm text-fg/90 whitespace-pre-wrap cursor-text hover:bg-surface-light/40 -mx-2 px-2 py-1 rounded"
                    onClick={() => setEditingDesc(true)}
                  >
                    {task.description}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDesc(true)}
                    className="text-xs text-muted hover:text-fg italic"
                  >
                    Add a description
                  </button>
                )}
              </div>

              {/* Comments */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">
                  Comments {comments.length > 0 && `(${comments.length})`}
                </div>
                {loading ? (
                  <div className="text-xs text-muted">Loading…</div>
                ) : comments.length === 0 ? (
                  <div className="text-xs text-muted italic">
                    No comments yet — be the first.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <CommentRow
                        key={c.id}
                        comment={c}
                        author={members[c.author_id]}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comment composer */}
            <form
              onSubmit={handleCommentSubmit}
              className="border-t border-border p-3 shrink-0"
            >
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      void handleCommentSubmit(e);
                    }
                  }}
                  rows={2}
                  placeholder="Write a comment… (⌘+Enter to send)"
                  className="flex-1 px-3 py-2 rounded-lg bg-surface-light border border-border focus:border-[#2563EB] focus:outline-none text-sm resize-none"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || submittingComment}
                  className="p-2 rounded-lg bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send size={16} />
                </button>
              </div>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}

function CommentRow({
  comment,
  author,
}: {
  comment: WorkspaceTaskComment;
  author: MemberLite | undefined;
}) {
  const initial = author?.full_name
    ? author.full_name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
        .toUpperCase()
    : "?";
  return (
    <div className="flex gap-2.5">
      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-[rgba(37,99,235,0.12)] text-[#2563EB] border border-[rgba(37,99,235,0.25)]">
        {author?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={author.avatar_url}
            alt={author.full_name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          initial
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs mb-0.5">
          <span className="font-medium">{author?.full_name ?? "Unknown"}</span>
          <span className="text-muted">{formatTimestamp(comment.created_at)}</span>
        </div>
        <p className="text-sm text-fg/90 whitespace-pre-wrap break-words">
          {comment.body}
        </p>
      </div>
    </div>
  );
}
