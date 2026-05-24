"use client";

import { Funnel, Plus, SquaresFour } from "@phosphor-icons/react";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { createBrowserClient } from "@supabase/ssr";
import {
  TASK_STATUSES,
  type WorkspaceTask,
  type WorkspaceTaskComment,
  type TaskStatus,
  type CreateTaskInput,
} from "@/lib/workspace/board";
import { useAuth } from "@/lib/auth-context";
import {
  BoardCard,
  type ClientLite,
  type MemberLite,
} from "@/components/workspace-board/board-card";
import { NewTaskModal } from "@/components/workspace-board/new-task-modal";
import { TaskDrawer } from "@/components/workspace-board/task-drawer";
import { MotionPage } from "@/components/motion/motion-page";

/**
 * Workspace Board — Trello/Monday-style kanban for agency teams.
 *
 * Architecture notes
 * ------------------
 * • Drag-drop uses native HTML5 DnD to match the existing Projects board
 *   pattern in this repo (no extra dependency, full keyboard fallback via
 *   the drawer's status select).
 * • Optimistic updates: column moves and reorders apply locally first, then
 *   POST to /api/workspace/tasks/reorder. Realtime subscription folds in any
 *   teammate's concurrent moves on the same tick.
 * • Real-time: subscribe to `postgres_changes` on `workspace_tasks` for the
 *   agency owner. INSERT/UPDATE/DELETE all flow through `handleRealtimeRow`.
 */

type View = "all" | "my_tasks" | "by_client" | "by_type" | "due_this_week";

const COLUMN_META: Record<TaskStatus, { label: string; color: string }> = {
  backlog: { label: "Backlog", color: "#94a3b8" },
  in_progress: { label: "In Progress", color: "#D4FF00" },
  review: { label: "Review", color: "#a855f7" },
  done: { label: "Done", color: "#22C55E" },
};

function getBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export default function WorkspaceBoardPage() {
  const { user, profile } = useAuth();

  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientsList, setClientsList] = useState<ClientLite[]>([]);
  const [membersList, setMembersList] = useState<MemberLite[]>([]);
  const [commentCountByTask, setCommentCountByTask] = useState<Record<string, number>>(
    {},
  );

  // View / filter UI state
  const [view, setView] = useState<View>("all");
  const [filterClient, setFilterClient] = useState<string>("");
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // New-task modal + drawer state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultStatus, setModalDefaultStatus] =
    useState<TaskStatus>("backlog");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeComments, setActiveComments] = useState<WorkspaceTaskComment[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Drag state — track id-being-dragged + hover column for drop visual.
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<TaskStatus | null>(null);
  const justDraggedRef = useRef(false);

  // ── Lookups: clients + members ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cRes, mRes] = await Promise.all([
          fetch("/api/clients"),
          fetch("/api/team"),
        ]);
        if (cancelled) return;
        if (cRes.ok) {
          const json = await cRes.json();
          setClientsList(
            (json.clients || []).map(
              (c: { id: string; business_name: string }) => ({
                id: c.id,
                business_name: c.business_name,
              }),
            ),
          );
        }
        if (mRes.ok) {
          const json = await mRes.json();
          setMembersList(
            (json.members || []).map(
              (m: { id: string; full_name: string; avatar_url: string | null }) => ({
                id: m.id,
                full_name: m.full_name,
                avatar_url: m.avatar_url,
              }),
            ),
          );
        }
      } catch (err) {
        console.error("[workspace-board] lookup load failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clientsById = useMemo(() => {
    const out: Record<string, ClientLite> = {};
    for (const c of clientsList) out[c.id] = c;
    return out;
  }, [clientsList]);

  const membersById = useMemo(() => {
    const out: Record<string, MemberLite> = {};
    for (const m of membersList) out[m.id] = m;
    return out;
  }, [membersList]);

  // ── Fetch board ──────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (view === "my_tasks") params.set("view", "my_tasks");
      if (view === "due_this_week") params.set("view", "due_this_week");
      if (filterClient) params.set("client_id", filterClient);
      if (filterAssignee) params.set("assignee_id", filterAssignee);

      const url =
        params.toString().length > 0
          ? `/api/workspace/tasks?${params.toString()}`
          : "/api/workspace/tasks";
      const res = await fetch(url);
      if (!res.ok) {
        console.error("[workspace-board] list fetch failed", await res.text());
        return;
      }
      const json = await res.json();
      setTasks((json.tasks || []) as WorkspaceTask[]);
    } finally {
      setLoading(false);
    }
  }, [view, filterClient, filterAssignee]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  // ── Realtime: keep board in sync across browser tabs/teammates ──────────
  useEffect(() => {
    if (!user?.id) return;
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`workspace-tasks-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_tasks",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: string };
            if (old.id) {
              setTasks((prev) => prev.filter((t) => t.id !== old.id));
            }
            return;
          }
          const row = payload.new as WorkspaceTask;
          if (!row?.id) return;
          setTasks((prev) => {
            const idx = prev.findIndex((t) => t.id === row.id);
            if (idx >= 0) {
              const next = prev.slice();
              next[idx] = row;
              return next;
            }
            return [...prev, row];
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Comment counts (lightweight roll-up).
  useEffect(() => {
    if (tasks.length === 0) {
      setCommentCountByTask({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const supabase = getBrowserSupabase();
        const { data } = await supabase
          .from("workspace_task_comments")
          .select("task_id")
          .in(
            "task_id",
            tasks.map((t) => t.id),
          );
        if (cancelled) return;
        const counts: Record<string, number> = {};
        for (const row of (data ?? []) as { task_id: string }[]) {
          counts[row.task_id] = (counts[row.task_id] ?? 0) + 1;
        }
        setCommentCountByTask(counts);
      } catch {
        // Non-fatal — counts default to 0 if the query fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tasks]);

  // ── Filtering / grouping for the visible board ───────────────────────────
  const visibleTasks = useMemo(() => {
    let list = tasks;
    if (filterClient) list = list.filter((t) => t.client_id === filterClient);
    if (filterAssignee)
      list = list.filter((t) => t.assignee_id === filterAssignee);
    return list;
  }, [tasks, filterClient, filterAssignee]);

  const tasksByStatus = useMemo(() => {
    const out: Record<TaskStatus, WorkspaceTask[]> = {
      backlog: [],
      in_progress: [],
      review: [],
      done: [],
    };
    for (const t of visibleTasks) out[t.status].push(t);
    for (const status of TASK_STATUSES) {
      out[status].sort((a, b) => a.position - b.position);
    }
    return out;
  }, [visibleTasks]);

  // ── Drag-drop: move a card between columns or reorder within a column ───
  const moveTask = useCallback(
    async (taskId: string, target: TaskStatus) => {
      const current = tasks.find((t) => t.id === taskId);
      if (!current) return;
      if (current.status === target) return;

      // Optimistic: bump it to the bottom of the target column.
      const targetMax = tasks
        .filter((t) => t.status === target)
        .reduce((acc, t) => Math.max(acc, t.position), -1);
      const optimistic: WorkspaceTask = {
        ...current,
        status: target,
        position: targetMax + 1,
      };
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? optimistic : t)),
      );

      try {
        const res = await fetch(`/api/workspace/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: target,
            position: optimistic.position,
          }),
        });
        if (!res.ok) {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? current : t)));
          console.error("[workspace-board] move failed", await res.text());
        }
      } catch (err) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? current : t)));
        console.error("[workspace-board] move error", err);
      }
    },
    [tasks],
  );

  // ── Drawer: load comments lazily on open ─────────────────────────────────
  const openTask = useCallback(async (taskId: string) => {
    setActiveTaskId(taskId);
    setActiveComments([]);
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/workspace/tasks/${taskId}`);
      if (res.ok) {
        const json = await res.json();
        setActiveComments(
          (json.comments || []) as WorkspaceTaskComment[],
        );
      }
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const closeTask = useCallback(() => {
    setActiveTaskId(null);
    setActiveComments([]);
  }, []);

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) ?? null,
    [tasks, activeTaskId],
  );

  // ── Mutations ────────────────────────────────────────────────────────────
  const createTask = useCallback(async (input: CreateTaskInput) => {
    const res = await fetch("/api/workspace/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to create task");
    }
    const json = await res.json();
    setTasks((prev) => [...prev, json.task as WorkspaceTask]);
  }, []);

  const patchActiveTask = useCallback(
    async (patch: Partial<WorkspaceTask>) => {
      if (!activeTaskId) return;
      const before = tasks.find((t) => t.id === activeTaskId);
      if (!before) return;
      // Optimistic apply.
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeTaskId ? ({ ...t, ...patch } as WorkspaceTask) : t,
        ),
      );
      try {
        const res = await fetch(`/api/workspace/tasks/${activeTaskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          setTasks((prev) => prev.map((t) => (t.id === activeTaskId ? before : t)));
        }
      } catch {
        setTasks((prev) => prev.map((t) => (t.id === activeTaskId ? before : t)));
      }
    },
    [activeTaskId, tasks],
  );

  const deleteActiveTask = useCallback(async () => {
    if (!activeTaskId) return;
    const before = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== activeTaskId));
    closeTask();
    try {
      const res = await fetch(`/api/workspace/tasks/${activeTaskId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setTasks(before);
      }
    } catch {
      setTasks(before);
    }
  }, [activeTaskId, tasks, closeTask]);

  const addComment = useCallback(
    async (body: string) => {
      if (!activeTaskId) return;
      const res = await fetch(
        `/api/workspace/tasks/${activeTaskId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        },
      );
      if (res.ok) {
        const json = await res.json();
        setActiveComments((prev) => [...prev, json.comment as WorkspaceTaskComment]);
        setCommentCountByTask((prev) => ({
          ...prev,
          [activeTaskId]: (prev[activeTaskId] ?? 0) + 1,
        }));
      }
    },
    [activeTaskId],
  );

  const canDelete = profile?.role !== "team_member";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <MotionPage className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] mx-auto space-y-6">{/* -- Board command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">Workspace</p>
        <h1 className="text-2xl font-display font-bold text-text-primary">Board</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setFiltersOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-border-subtle text-sm text-text-primary transition-colors"
                  >
                    <Funnel size={14} /> Filters
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setModalDefaultStatus("backlog");
                      setModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold text-black hover:bg-gold/90 text-sm font-medium transition-colors"
                  >
                    <Plus size={14} /> New task
                  </motion.button>
                </div>
      </div>
    </div>{/* View bar */}<div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-surface-light border border-border-subtle">
                {(
                  [
                    { v: "all", label: "All tasks" },
                    { v: "my_tasks", label: "My Tasks" },
                    { v: "due_this_week", label: "Due This Week" },
                    { v: "by_client", label: "By Client" },
                    { v: "by_type", label: "By Type" },
                  ] as { v: View; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setView(opt.v)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      view === opt.v
                        ? "bg-[rgba(212,255,0,0.12)] text-brand-accent"
                        : "text-text-muted hover:text-fg"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {filtersOpen && (
                <div className="flex items-center gap-2">
                  <select
                    value={filterClient}
                    onChange={(e) => setFilterClient(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-light border border-border-subtle text-xs focus:border-brand-accent focus:outline-none"
                  >
                    <option value="">All clients</option>
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.business_name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filterAssignee}
                    onChange={(e) => setFilterAssignee(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-light border border-border-subtle text-xs focus:border-brand-accent focus:outline-none"
                  >
                    <option value="">All assignees</option>
                    {membersList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                  {(filterClient || filterAssignee) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterClient("");
                        setFilterAssignee("");
                      }}
                      className="text-[11px] text-text-muted hover:text-fg"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>{/* Board grid */}{loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {TASK_STATUSES.map((s) => (
                  <div
                    key={s}
                    className="h-64 rounded-xl glass animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {TASK_STATUSES.map((status, colIndex) => {
                  const meta = COLUMN_META[status];
                  const columnTasks = tasksByStatus[status];
                  const isHover = hoverCol === status;
                  return (
                    <motion.div
                      key={status}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: colIndex * 0.06 }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setHoverCol(status);
                      }}
                      onDragLeave={() => setHoverCol((prev) => (prev === status ? null : prev))}
                      onDrop={() => {
                        if (draggedId) {
                          void moveTask(draggedId, status);
                        }
                        setDraggedId(null);
                        setHoverCol(null);
                      }}
                      className="flex flex-col"
                    >
                      {/* Column header */}
                      <div className="glass rounded-xl px-3 py-2.5 mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: meta.color }}
                          />
                          <span className="text-xs font-bold uppercase tracking-wider">
                            {meta.label}
                          </span>
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                            style={{
                              background: `${meta.color}18`,
                              color: meta.color,
                            }}
                          >
                            {columnTasks.length}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setModalDefaultStatus(status);
                            setModalOpen(true);
                          }}
                          className="p-1 rounded text-text-muted hover:text-fg hover:bg-white/5 transition-colors"
                          aria-label={`Add task to ${meta.label}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      {/* Drop zone */}
                      <div
                        className={`flex-1 min-h-[200px] rounded-xl border border-dashed transition-colors p-2 space-y-2 ${
                          isHover
                            ? "border-[rgba(212,255,0,0.25)] bg-[rgba(212,255,0,0.08)]"
                            : "glass border-border-subtle"
                        }`}
                      >
                        {columnTasks.length === 0 ? (
                          <div className="text-center text-[11px] text-text-muted/70 py-8">
                            Drop tasks here
                          </div>
                        ) : (
                          columnTasks.map((task, cardIndex) => (
                            <motion.div
                              key={task.id}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.16, delay: cardIndex * 0.04 }}
                            >
                              <BoardCard
                                task={task}
                                clients={clientsById}
                                members={membersById}
                                commentCount={commentCountByTask[task.id]}
                                isDragging={draggedId === task.id}
                                onDragStart={() => {
                                  setDraggedId(task.id);
                                  justDraggedRef.current = true;
                                }}
                                onDragEnd={() => {
                                  setDraggedId(null);
                                  setTimeout(() => {
                                    justDraggedRef.current = false;
                                  }, 50);
                                }}
                                onClick={() => {
                                  if (justDraggedRef.current) return;
                                  void openTask(task.id);
                                }}
                              />
                            </motion.div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}<NewTaskModal
              open={modalOpen}
              defaultStatus={modalDefaultStatus}
              clients={clientsList}
              members={membersList}
              onClose={() => setModalOpen(false)}
              onCreate={createTask}
            /><TaskDrawer
              task={activeTask}
              comments={activeComments}
              clients={clientsById}
              members={membersById}
              loading={drawerLoading}
              canDelete={canDelete}
              onClose={closeTask}
              onPatch={patchActiveTask}
              onDelete={deleteActiveTask}
              onComment={addComment}
            /></MotionPage>
  );
}
