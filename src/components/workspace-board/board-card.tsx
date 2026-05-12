"use client";

import { motion } from "framer-motion";
import { Calendar, MessageCircle, Paperclip } from "lucide-react";
import type { TaskPriority, TaskType, WorkspaceTask } from "@/lib/workspace/board";

/**
 * One card in a board column. Renders compact metadata (type chip,
 * assignee initial, due date, comment count, attachment indicator) so
 * the column stays scannable even with 30+ cards in view.
 */

interface ClientLite {
  id: string;
  business_name: string;
}

interface MemberLite {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

interface BoardCardProps {
  task: WorkspaceTask;
  clients: Record<string, ClientLite>;
  members: Record<string, MemberLite>;
  commentCount?: number;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}

const TYPE_LABEL: Record<TaskType, string> = {
  video: "Video",
  thumbnail: "Thumbnail",
  post: "Post",
  copy: "Copy",
  ad: "Ad",
  brief: "Brief",
  call: "Call",
  generic: "Task",
};

// Type chip palette — distinct enough that you can spot a column's mix at
// a glance without reading every label.
const TYPE_COLORS: Record<TaskType, { bg: string; text: string }> = {
  video: { bg: "rgba(168, 85, 247, 0.18)", text: "#D8B4FE" },
  thumbnail: { bg: "rgba(236, 72, 153, 0.18)", text: "#F9A8D4" },
  post: { bg: "rgba(37, 99, 235, 0.18)", text: "#93C5FD" },
  copy: { bg: "rgba(37, 99, 235, 0.18)", text: "#93C5FD" },
  ad: { bg: "rgba(249, 115, 22, 0.18)", text: "#FDBA74" },
  brief: { bg: "rgba(139, 92, 246, 0.18)", text: "#C4B5FD" },
  call: { bg: "rgba(37, 99, 235, 0.18)", text: "#93C5FD" },
  generic: { bg: "rgba(148, 163, 184, 0.18)", text: "#CBD5E1" },
};

const PRIORITY_BAR: Record<TaskPriority, string> = {
  low: "transparent",
  normal: "transparent",
  high: "#FDBA74",
  urgent: "#F87171",
};

function initialOf(name?: string | null): string {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function formatDue(due: string | null): { label: string; overdue: boolean } | null {
  if (!due) return null;
  const dueDate = new Date(due);
  const now = new Date();
  const diff = dueDate.getTime() - now.getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  const overdue = diff < 0;
  if (overdue) {
    return { label: `${Math.abs(days)}d overdue`, overdue: true };
  }
  if (days === 0) return { label: "Today", overdue: false };
  if (days === 1) return { label: "Tomorrow", overdue: false };
  if (days < 7) return { label: `${days}d`, overdue: false };
  return {
    label: dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    overdue: false,
  };
}

export function BoardCard({
  task,
  clients,
  members,
  commentCount,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: BoardCardProps) {
  const typeMeta = TYPE_COLORS[task.type] ?? TYPE_COLORS.generic;
  const due = formatDue(task.due_at);
  const client = task.client_id ? clients[task.client_id] : null;
  const assignee = task.assignee_id ? members[task.assignee_id] : null;
  const attachmentCount = Array.isArray(task.attachments) ? task.attachments.length : 0;

  return (
    <motion.div
      layout
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`relative p-3 rounded-lg bg-surface-light border border-border hover:border-[rgba(37,99,235,0.3)] transition-colors cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      {/* Priority indicator strip on the left edge */}
      {(task.priority === "high" || task.priority === "urgent") && (
        <div
          className="absolute top-0 left-0 bottom-0 w-0.5 rounded-l-lg"
          style={{ background: PRIORITY_BAR[task.priority] }}
          aria-hidden
        />
      )}

      {/* Type chip + client */}
      <div className="flex items-center gap-1.5 mb-2 min-w-0">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ background: typeMeta.bg, color: typeMeta.text }}
        >
          {TYPE_LABEL[task.type]}
        </span>
        {client && (
          <span className="text-[10px] text-muted truncate">
            · {client.business_name}
          </span>
        )}
      </div>

      <h4 className="text-sm font-medium leading-snug line-clamp-2 mb-2">
        {task.title}
      </h4>

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
        <div className="flex items-center gap-2 min-w-0">
          {due && (
            <span
              className={`inline-flex items-center gap-1 ${
                due.overdue ? "text-red-400" : ""
              }`}
            >
              <Calendar size={11} />
              {due.label}
            </span>
          )}
          {commentCount !== undefined && commentCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageCircle size={11} />
              {commentCount}
            </span>
          )}
          {attachmentCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip size={11} />
              {attachmentCount}
            </span>
          )}
        </div>
        {assignee && (
          <div
            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-[rgba(37,99,235,0.12)] text-[#2563EB] border border-[rgba(37,99,235,0.3)]"
            title={assignee.full_name}
          >
            {assignee.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assignee.avatar_url}
                alt={assignee.full_name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              initialOf(assignee.full_name)
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export type { ClientLite, MemberLite };
