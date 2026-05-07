"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import {
  TASK_PRIORITIES,
  TASK_TYPES,
  type CreateTaskInput,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
} from "@/lib/workspace/board";
import type { ClientLite, MemberLite } from "./board-card";

interface NewTaskModalProps {
  open: boolean;
  defaultStatus?: TaskStatus;
  clients: ClientLite[];
  members: MemberLite[];
  onClose: () => void;
  onCreate: (input: CreateTaskInput) => Promise<void>;
}

export function NewTaskModal({
  open,
  defaultStatus = "backlog",
  clients,
  members,
  onClose,
  onCreate,
}: NewTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TaskType>("generic");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [clientId, setClientId] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueAt, setDueAt] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state every time the modal opens. Prevents stale form data
  // from leaking between successive create operations.
  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setType("generic");
      setPriority("normal");
      setClientId("");
      setAssigneeId("");
      setDueAt("");
      setError(null);
    }
  }, [open]);

  // ESC key dismisses the modal — same affordance as the drawer.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        type,
        status: defaultStatus,
        priority,
        client_id: clientId || null,
        assignee_id: assigneeId || null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative w-full max-w-lg bg-surface  border border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-semibold">New task</h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-surface-light text-muted hover:text-fg transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-light border border-border focus:border-gold/50 focus:outline-none text-sm"
                  placeholder="Edit the launch video"
                  maxLength={280}
                />
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-surface-light border border-border focus:border-gold/50 focus:outline-none text-sm resize-none"
                  placeholder="Optional context — links, requirements, references..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as TaskType)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-light border border-border focus:border-gold/50 focus:outline-none text-sm"
                  >
                    {TASK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-light border border-border focus:border-gold/50 focus:outline-none text-sm"
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                    Client
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-light border border-border focus:border-gold/50 focus:outline-none text-sm"
                  >
                    <option value="">No client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.business_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                    Assignee
                  </label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-light border border-border focus:border-gold/50 focus:outline-none text-sm"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
                  Due date
                </label>
                <input
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-light border border-border focus:border-gold/50 focus:outline-none text-sm"
                />
              </div>

              {error && (
                <div className="px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-fg hover:bg-surface-light transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium bg-gold text-black hover:bg-gold/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create task"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
