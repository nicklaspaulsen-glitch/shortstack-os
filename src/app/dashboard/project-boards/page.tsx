"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Kanban, Plus, Loader2, X, Trash2, Calendar, User, MessageSquare,
} from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import EmptyState from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ──────────────────────────────────────────────────────
type Status = "backlog" | "todo" | "in_progress" | "review" | "done";
type Priority = "low" | "medium" | "high" | "urgent";

interface Board {
  id: string;
  user_id: string;
  client_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  created_at: string;
}

interface Task {
  id: string;
  board_id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  assignee_profile_id: string | null;
  due_date: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: string;
  task_id: string;
  author_profile_id: string | null;
  body: string;
  created_at: string;
}

// ── Column config ──────────────────────────────────────────────
const COLUMNS: { key: Status; label: string; color: string }[] = [
  { key: "backlog",     label: "Backlog",     color: "#6b7280" },
  { key: "todo",        label: "To Do",       color: "#3b82f6" },
  { key: "in_progress", label: "In Progress", color: "#f59e0b" },
  { key: "review",      label: "Review",      color: "#8b5cf6" },
  { key: "done",        label: "Done",        color: "#10b981" },
];

const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string }> = {
  low:    { label: "Low",    color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  medium: { label: "Medium", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  high:   { label: "High",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  urgent: { label: "Urgent", color: "#ef4444", bg: "rgba(239,68,68,0.14)" },
};

// ── Helpers ────────────────────────────────────────────────────
const isOverdue = (dueDate: string | null) => {
  if (!dueDate) return false;
  // Compare date-only to avoid time-zone surprises.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
};

const formatDue = (dueDate: string | null) => {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// ── Page ───────────────────────────────────────────────────────
export default function ProjectsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Modals/panels
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [creatingBoard, setCreatingBoard] = useState(false);

  const [quickTaskOpen, setQuickTaskOpen] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskStatus, setQuickTaskStatus] = useState<Status>("todo");
  const quickTaskRef = useRef<HTMLInputElement | null>(null);

  const [addingTaskColumn, setAddingTaskColumn] = useState<Status | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskComments, setTaskComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [editingTask, setEditingTask] = useState<Partial<Task>>({});

  // Drag state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null);
  // Track drag state to suppress the click that follows dragend on the same card.
  const justDraggedRef = useRef(false);

  // Assignee profile lookup — keyed by profile_id, populated from
  // /api/profiles/by-ids when tasks load. Fixes the bug where the first
  // character of the UUID was rendered as an "initial".
  const [profileMap, setProfileMap] = useState<
    Record<string, { full_name: string | null; avatar_url: string | null }>
  >({});

  // Submission guards — prevent Enter-spam from creating duplicate rows.
  const [submittingQuickTask, setSubmittingQuickTask] = useState(false);
  const [submittingInlineTask, setSubmittingInlineTask] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // ── Load boards on mount ───────────────────────────────────
  const fetchBoards = useCallback(async () => {
    setLoadingBoards(true);
    try {
      const res = await fetch("/api/projects/boards");
      if (!res.ok) {
        toast.error("Failed to load boards");
        return;
      }
      const json = await res.json();
      const list: Board[] = json.boards ?? [];
      setBoards(list);
      // Pick first board if nothing selected yet.
      if (list.length > 0) {
        setActiveBoardId((prev) => prev ?? list[0].id);
      } else {
        setActiveBoardId(null);
      }
    } finally {
      setLoadingBoards(false);
    }
  }, []);

  useEffect(() => { fetchBoards(); }, [fetchBoards]);

  // ── Load tasks for the active board ────────────────────────
  const fetchTasks = useCallback(async (boardId: string) => {
    setLoadingTasks(true);
    try {
      const res = await fetch(`/api/projects/boards/${boardId}/tasks`);
      if (!res.ok) {
        toast.error("Failed to load tasks");
        return;
      }
      const json = await res.json();
      setTasks(json.tasks ?? []);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    if (activeBoardId) fetchTasks(activeBoardId);
    else setTasks([]);
  }, [activeBoardId, fetchTasks]);

  // Look up assignee profiles whenever task list changes. We only fetch
  // IDs we haven't seen yet so a bunch of status changes don't re-hit the
  // endpoint unnecessarily.
  useEffect(() => {
    const missing = Array.from(
      new Set(
        tasks
          .map((t) => t.assignee_profile_id)
          .filter((id): id is string => !!id && !profileMap[id]),
      ),
    );
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/profiles/by-ids?ids=${encodeURIComponent(missing.join(","))}`,
        );
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || !Array.isArray(json.profiles)) return;
        setProfileMap((prev) => {
          const next = { ...prev };
          for (const p of json.profiles) {
            next[p.id] = {
              full_name: p.full_name || null,
              avatar_url: p.avatar_url || null,
            };
          }
          return next;
        });
      } catch {
        /* ignore — avatar falls back to generic icon */
      }
    })();
    return () => { cancelled = true; };
  }, [tasks, profileMap]);

  /** Render-helper: resolve a profile_id to a readable initial. */
  const getAssigneeInitial = useCallback(
    (profileId: string | null): { initial: string; name: string | null } => {
      if (!profileId) return { initial: "", name: null };
      const p = profileMap[profileId];
      if (!p || !p.full_name) return { initial: "?", name: null };
      const trimmed = p.full_name.trim();
      if (!trimmed) return { initial: "?", name: null };
      const parts = trimmed.split(/\s+/);
      const initial =
        (parts[0]?.[0] || "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] || "") : "");
      return { initial: initial.toUpperCase() || "?", name: trimmed };
    },
    [profileMap],
  );

  // ── Cmd/Ctrl+Shift+K → quick task dialog ───────────────────
  // Plain Cmd/Ctrl+K is already claimed by the global command palette and
  // global search — stacking a third handler on the same combo opened all
  // three at once. Use Shift+K here so the shortcut is additive, not
  // conflicting.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "k") {
        if (!activeBoardId) return;
        e.preventDefault();
        setQuickTaskOpen(true);
        setTimeout(() => quickTaskRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setQuickTaskOpen(false);
        setSelectedTask(null);
        setShowNewBoard(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeBoardId]);

  // ── Create board ───────────────────────────────────────────
  const handleCreateBoard = async () => {
    if (creatingBoard) return;
    const name = newBoardName.trim();
    if (!name) return;
    setCreatingBoard(true);
    try {
      const res = await fetch("/api/projects/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Failed to create board");
        return;
      }
      const json = await res.json();
      const board: Board = json.board;
      setBoards((prev) => [board, ...prev]);
      setActiveBoardId(board.id);
      setNewBoardName("");
      setShowNewBoard(false);
      toast.success(`Board "${board.name}" created`);
    } finally {
      setCreatingBoard(false);
    }
  };

  // ── Delete board ───────────────────────────────────────────
  const handleDeleteBoard = async (id: string) => {
    if (!confirm("Delete this board and all its tasks?")) return;
    const prevBoards = boards;
    setBoards((prev) => prev.filter((b) => b.id !== id));
    if (activeBoardId === id) {
      const next = prevBoards.find((b) => b.id !== id);
      setActiveBoardId(next?.id ?? null);
    }
    const res = await fetch(`/api/projects/boards/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setBoards(prevBoards);
      toast.error("Failed to delete board");
      return;
    }
    toast.success("Board deleted");
  };

  // ── Create task ────────────────────────────────────────────
  const createTask = async (title: string, status: Status) => {
    if (!activeBoardId || !title.trim()) return;
    const optimisticId = `tmp-${Date.now()}`;
    const columnTasks = tasks.filter((t) => t.status === status);
    const nextPos = columnTasks.length
      ? Math.max(...columnTasks.map((t) => t.position)) + 1
      : 0;
    const optimistic: Task = {
      id: optimisticId,
      board_id: activeBoardId,
      title: title.trim(),
      description: null,
      status,
      priority: "medium",
      assignee_profile_id: null,
      due_date: null,
      position: nextPos,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, optimistic]);

    const res = await fetch(`/api/projects/boards/${activeBoardId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), status }),
    });
    if (!res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== optimisticId));
      toast.error("Failed to create task");
      return;
    }
    const json = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === optimisticId ? json.task : t)));
  };

  const submitInlineNewTask = async (status: Status) => {
    if (submittingInlineTask) return;
    if (!newTaskTitle.trim()) {
      setAddingTaskColumn(null);
      return;
    }
    setSubmittingInlineTask(true);
    try {
      await createTask(newTaskTitle, status);
      setNewTaskTitle("");
      setAddingTaskColumn(null);
    } finally {
      setSubmittingInlineTask(false);
    }
  };

  const submitQuickTask = async () => {
    if (submittingQuickTask) return;
    if (!quickTaskTitle.trim()) return;
    setSubmittingQuickTask(true);
    try {
      await createTask(quickTaskTitle, quickTaskStatus);
      setQuickTaskTitle("");
      setQuickTaskOpen(false);
    } finally {
      setSubmittingQuickTask(false);
    }
  };

  // ── Move task (drag-drop) ──────────────────────────────────
  const moveTask = async (taskId: string, newStatus: Status) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic — move the task to the end of the target column locally.
    const targetPos = tasks.filter((t) => t.status === newStatus).length;
    const prevTasks = tasks;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: newStatus, position: targetPos } : t
      )
    );

    const res = await fetch(`/api/projects/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      setTasks(prevTasks);
      toast.error("Failed to move task");
    }
  };

  // ── Update task (panel) ────────────────────────────────────
  const saveTaskEdit = async () => {
    if (!selectedTask) return;
    const updates: Partial<Task> = {};
    (Object.keys(editingTask) as (keyof Task)[]).forEach((k) => {
      if (editingTask[k] !== selectedTask[k]) {
        (updates as Record<string, unknown>)[k] = editingTask[k];
      }
    });
    if (Object.keys(updates).length === 0) {
      setSelectedTask(null);
      return;
    }
    const res = await fetch(`/api/projects/tasks/${selectedTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      toast.error("Failed to save changes");
      return;
    }
    const json = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === json.task.id ? json.task : t)));
    setSelectedTask(null);
    toast.success("Task updated");
  };

  // ── Delete task ────────────────────────────────────────────
  const handleDeleteTask = async (id: string) => {
    const prev = tasks;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    setSelectedTask(null);
    const res = await fetch(`/api/projects/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setTasks(prev);
      toast.error("Failed to delete task");
    }
  };

  // ── Load comments when panel opens ─────────────────────────
  const openTaskPanel = async (task: Task) => {
    setSelectedTask(task);
    setEditingTask({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date,
    });
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/projects/tasks/${task.id}/comments`);
      if (res.ok) {
        const json = await res.json();
        setTaskComments(json.comments ?? []);
      } else {
        setTaskComments([]);
      }
    } finally {
      setLoadingComments(false);
    }
  };

  const submitComment = async () => {
    if (submittingComment) return;
    if (!selectedTask || !newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/projects/tasks/${selectedTask.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newComment.trim() }),
      });
      if (!res.ok) {
        toast.error("Failed to post comment");
        return;
      }
      const json = await res.json();
      setTaskComments((prev) => [...prev, json.comment]);
      setNewComment("");
    } finally {
      setSubmittingComment(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  const activeBoard = boards.find((b) => b.id === activeBoardId) ?? null;

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Kanban size={28} />}
        title="Projects"
        subtitle="Kanban-style boards for every project. Drag tasks across columns, leave comments, ship work."
        gradient="gold"
        actions={
          <button
            onClick={() => setShowNewBoard(true)}
            className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all flex items-center gap-1.5"
          >
            <Plus size={12} /> New Board
          </button>
        }
      />

      {/* ── Loading skeleton ─────────────────────────────── */}
      {loadingBoards && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
          <div className="flex gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0 w-[260px] space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────── */}
      {!loadingBoards && boards.length === 0 && (
        <div className="card py-10">
          <EmptyState
            icon={<Kanban size={48} />}
            title="Create your first board"
            description="Boards hold your project's tasks across Backlog, To Do, In Progress, Review, and Done columns. Drag to move, click to edit."
            action={
              <button
                onClick={() => setShowNewBoard(true)}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Plus size={12} /> Create board
              </button>
            }
          />
        </div>
      )}

      {/* ── Board tabs ───────────────────────────────────── */}
      {!loadingBoards && boards.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {boards.map((b) => (
            <div key={b.id} className="relative group flex-shrink-0">
              <button
                onClick={() => setActiveBoardId(b.id)}
                className={`px-4 py-2 text-xs rounded-lg border flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeBoardId === b.id
                    ? "bg-gold/10 text-gold border-gold/30"
                    : "bg-surface text-muted border-border hover:text-foreground hover:border-gold/20"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: b.color || "#C9A84C" }}
                />
                {b.name}
              </button>
              {activeBoardId === b.id && (
                <button
                  onClick={() => handleDeleteBoard(b.id)}
                  title="Delete board"
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-400/15 border border-red-400/30 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Kanban columns ───────────────────────────────── */}
      {!loadingBoards && activeBoard && (
        <>
          {loadingTasks && (
            <div className="flex items-center justify-center py-12 gap-2 text-muted">
              <Loader2 size={16} className="animate-spin" /> Loading tasks...
            </div>
          )}

          {!loadingTasks && (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {COLUMNS.map((col) => {
                const columnTasks = tasks
                  .filter((t) => t.status === col.key)
                  .sort((a, b) => a.position - b.position);
                const isDragTarget = dragOverColumn === col.key;
                return (
                  <div
                    key={col.key}
                    className="flex-shrink-0 w-[280px]"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverColumn(col.key);
                    }}
                    onDragLeave={() => setDragOverColumn(null)}
                    onDrop={() => {
                      if (draggedTaskId) moveTask(draggedTaskId, col.key);
                      setDraggedTaskId(null);
                      setDragOverColumn(null);
                    }}
                  >
                    {/* Column header */}
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: col.color }}
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {col.label}
                        </span>
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                          style={{
                            background: `${col.color}18`,
                            color: col.color,
                          }}
                        >
                          {columnTasks.length}
                        </span>
                      </div>
                    </div>

                    {/* Tasks */}
                    <div
                      className={`space-y-2 min-h-[120px] rounded-lg p-1 transition-colors ${
                        isDragTarget ? "bg-gold/5 ring-1 ring-gold/20" : ""
                      }`}
                    >
                      {columnTasks.map((task) => {
                        const overdue = isOverdue(task.due_date);
                        const pri = PRIORITY_META[task.priority];
                        const assignee = getAssigneeInitial(task.assignee_profile_id);
                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={() => {
                              setDraggedTaskId(task.id);
                              justDraggedRef.current = true;
                            }}
                            onDragEnd={() => {
                              setDraggedTaskId(null);
                              // Clear the drag-just-ended flag shortly after
                              // so a trailing click event (fired after drop
                              // on some browsers) does not open the panel.
                              setTimeout(() => {
                                justDraggedRef.current = false;
                              }, 50);
                            }}
                            onClick={() => {
                              if (justDraggedRef.current) return;
                              openTaskPanel(task);
                            }}
                            className="p-3 rounded-lg bg-surface-light border border-border hover:border-gold/30 transition-all cursor-grab active:cursor-grabbing"
                          >
                            <p className="text-[12px] font-semibold leading-snug mb-2 break-words">
                              {task.title}
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ background: pri.bg, color: pri.color }}
                              >
                                {pri.label}
                              </span>
                              {task.due_date && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                    overdue
                                      ? "bg-red-400/15 text-red-400"
                                      : "bg-surface text-muted"
                                  }`}
                                >
                                  <Calendar size={8} /> {formatDue(task.due_date)}
                                </span>
                              )}
                              {task.assignee_profile_id && (
                                <span
                                  className="ml-auto w-5 h-5 rounded-full bg-gold/20 border border-gold/30 text-gold text-[9px] font-bold flex items-center justify-center"
                                  title={assignee.name ? `Assigned to ${assignee.name}` : "Assignee"}
                                >
                                  {assignee.initial || <User size={10} />}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {columnTasks.length === 0 && !isDragTarget && (
                        <div className="text-center py-6 border border-dashed border-border rounded-lg">
                          <p className="text-[9px] text-muted">Drop tasks here</p>
                        </div>
                      )}

                      {/* Inline add-task */}
                      {addingTaskColumn === col.key ? (
                        <div className="p-2 rounded-lg bg-surface-light border border-gold/30">
                          <input
                            autoFocus
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onBlur={() => submitInlineNewTask(col.key)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") submitInlineNewTask(col.key);
                              if (e.key === "Escape") {
                                setNewTaskTitle("");
                                setAddingTaskColumn(null);
                              }
                            }}
                            placeholder="Task title..."
                            className="w-full text-[11px] bg-transparent outline-none text-foreground placeholder-muted"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAddingTaskColumn(col.key);
                            setNewTaskTitle("");
                          }}
                          className="w-full mt-1 py-1.5 rounded-lg text-[10px] text-muted hover:text-gold hover:bg-gold/5 transition-colors flex items-center justify-center gap-1"
                        >
                          <Plus size={10} /> New task
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[9px] text-muted">
            Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-surface-light border border-border">Cmd/Ctrl+Shift+K</kbd> to quickly add a task.
          </p>
        </>
      )}

      {/* ── New board modal ───────────────────────────────── */}
      {showNewBoard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowNewBoard(false)}
        >
          <div
            className="card w-full max-w-md space-y-3 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Create new board</h3>
              <button onClick={() => setShowNewBoard(false)} className="text-muted hover:text-foreground">
                <X size={14} />
              </button>
            </div>
            <input
              autoFocus
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateBoard()}
              placeholder="Board name (e.g. Q2 Marketing Launch)"
              className="input w-full text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNewBoard(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBoard}
                disabled={creatingBoard || !newBoardName.trim()}
                className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {creatingBoard && <Loader2 size={12} className="animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick task dialog (Cmd/Ctrl+K) ───────────────── */}
      {quickTaskOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-24"
          onClick={() => setQuickTaskOpen(false)}
        >
          <div
            className="card w-full max-w-lg space-y-3 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Plus size={14} className="text-gold" /> Quick task
              </h3>
              <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-surface-light border border-border text-muted">
                Esc
              </kbd>
            </div>
            <input
              ref={quickTaskRef}
              value={quickTaskTitle}
              onChange={(e) => setQuickTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitQuickTask()}
              placeholder="What needs to get done?"
              className="input w-full text-sm"
            />
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-muted">Column:</label>
              <select
                value={quickTaskStatus}
                onChange={(e) => setQuickTaskStatus(e.target.value as Status)}
                className="input text-xs"
              >
                {COLUMNS.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
              <button
                onClick={submitQuickTask}
                disabled={submittingQuickTask || !quickTaskTitle.trim()}
                className="btn-primary ml-auto text-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {submittingQuickTask && <Loader2 size={12} className="animate-spin" />}
                Add task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Task detail side panel ────────────────────────── */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-40 bg-black/60 flex justify-end"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className="w-full max-w-md h-full bg-surface border-l border-border overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-surface border-b border-border px-4 py-3 flex items-center justify-between z-10">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Task details
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDeleteTask(selectedTask.id)}
                  className="p-1.5 rounded-lg hover:bg-red-400/10 text-red-400 transition-colors"
                  title="Delete task"
                >
                  <Trash2 size={12} />
                </button>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-1.5 rounded-lg hover:bg-surface-light text-muted transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">Title</label>
                <input
                  value={editingTask.title ?? ""}
                  onChange={(e) =>
                    setEditingTask((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="input w-full text-sm mt-1"
                />
              </div>

              {/* Status + Priority */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">Status</label>
                  <select
                    value={editingTask.status ?? "backlog"}
                    onChange={(e) =>
                      setEditingTask((prev) => ({ ...prev, status: e.target.value as Status }))
                    }
                    className="input w-full text-xs mt-1"
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">Priority</label>
                  <select
                    value={editingTask.priority ?? "medium"}
                    onChange={(e) =>
                      setEditingTask((prev) => ({ ...prev, priority: e.target.value as Priority }))
                    }
                    className="input w-full text-xs mt-1"
                  >
                    {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                      <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due date */}
              <div>
                <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">Due date</label>
                <input
                  type="date"
                  value={editingTask.due_date ?? ""}
                  onChange={(e) =>
                    setEditingTask((prev) => ({
                      ...prev,
                      due_date: e.target.value || null,
                    }))
                  }
                  className="input w-full text-xs mt-1"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-semibold text-muted uppercase tracking-wider">Description</label>
                <textarea
                  value={editingTask.description ?? ""}
                  onChange={(e) =>
                    setEditingTask((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={4}
                  placeholder="Add details..."
                  className="input w-full text-xs mt-1 resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedTask(null)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTaskEdit}
                  className="flex-1 btn-primary text-xs"
                >
                  Save
                </button>
              </div>

              {/* Comments */}
              <div className="pt-3 border-t border-border space-y-2">
                <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare size={10} /> Comments
                </h4>
                {loadingComments ? (
                  <div className="flex items-center gap-2 text-muted text-[10px]">
                    <Loader2 size={10} className="animate-spin" /> Loading...
                  </div>
                ) : taskComments.length === 0 ? (
                  <p className="text-[10px] text-muted">No comments yet.</p>
                ) : (
                  <div className="space-y-2">
                    {taskComments.map((c) => (
                      <div key={c.id} className="bg-surface-light rounded-lg p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <User size={10} className="text-muted" />
                          <span className="text-[9px] text-muted">
                            {new Date(c.created_at).toLocaleString(undefined, {
                              month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] whitespace-pre-wrap">{c.body}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitComment()}
                    placeholder="Write a comment..."
                    className="input flex-1 text-xs"
                  />
                  <button
                    onClick={submitComment}
                    disabled={submittingComment || !newComment.trim()}
                    className="btn-primary text-xs disabled:opacity-50"
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
