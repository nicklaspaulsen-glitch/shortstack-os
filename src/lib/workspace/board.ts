import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared types + validators for the Workspace Board feature.
 *
 * Route handlers stay thin: they parse with Zod, hand off to Supabase, and
 * shape the response. Anything stateful or cross-cutting lives here.
 */

export const TASK_TYPES = [
  "video",
  "thumbnail",
  "post",
  "copy",
  "ad",
  "brief",
  "call",
  "generic",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = [
  "backlog",
  "in_progress",
  "review",
  "done",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface WorkspaceTask {
  id: string;
  agency_owner_id: string;
  client_id: string | null;
  assignee_id: string | null;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  position: number;
  attachments: unknown[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceTaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  mentions: string[];
  created_at: string;
}

// ── Zod validators ────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  title: z.string().min(1).max(280).trim(),
  description: z.string().max(8000).default(""),
  type: z.enum(TASK_TYPES).default("generic"),
  status: z.enum(TASK_STATUSES).default("backlog"),
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  due_at: z.string().datetime().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  attachments: z.array(z.unknown()).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const patchTaskSchema = z.object({
  title: z.string().min(1).max(280).trim().optional(),
  description: z.string().max(8000).optional(),
  type: z.enum(TASK_TYPES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  due_at: z.string().datetime().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).optional(),
  attachments: z.array(z.unknown()).optional(),
});

export type PatchTaskInput = z.infer<typeof patchTaskSchema>;

export const reorderSchema = z.object({
  status: z.enum(TASK_STATUSES),
  ordered_ids: z.array(z.string().uuid()).max(500),
});

export type ReorderInput = z.infer<typeof reorderSchema>;

export const createCommentSchema = z.object({
  body: z.string().min(1).max(4000).trim(),
  // Optional explicit mention list. If omitted, the route extracts @mentions
  // from the body text itself (see extractMentions below).
  mentions: z.array(z.string().uuid()).max(50).optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Extract @mentions from a comment body. Mentions in the UI take the form
 * `@[Display Name](uuid)` — a Notion-style markdown anchor that survives
 * round-trips through plain-text storage.
 */
export function extractMentions(body: string): string[] {
  const re = /@\[[^\]]+\]\(([0-9a-f-]{36})\)/gi;
  const out = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (match[1]) out.add(match[1].toLowerCase());
  }
  return Array.from(out);
}

/**
 * Compute the next position int for a column (max + 1) so newly created
 * tasks land at the bottom of the destination column rather than fighting
 * the existing order.
 */
export async function nextPosition(
  supabase: SupabaseClient,
  ownerId: string,
  status: TaskStatus,
): Promise<number> {
  const { data } = await supabase
    .from("workspace_tasks")
    .select("position")
    .eq("agency_owner_id", ownerId)
    .eq("status", status)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const max = (data?.position as number | undefined) ?? -1;
  return max + 1;
}

/**
 * Group a flat list of tasks into the four-column board view. Order within
 * each column is preserved from the input (caller sorts by position).
 */
export function groupByStatus(
  tasks: ReadonlyArray<WorkspaceTask>,
): Record<TaskStatus, WorkspaceTask[]> {
  const out: Record<TaskStatus, WorkspaceTask[]> = {
    backlog: [],
    in_progress: [],
    review: [],
    done: [],
  };
  for (const t of tasks) {
    out[t.status].push(t);
  }
  return out;
}

/**
 * Filter helper used by the GET /api/workspace/tasks list endpoint.
 * `view=my_tasks` → only tasks assigned to the calling user's team_member row.
 * `view=due_this_week` → due_at within now..now+7d AND status != done.
 */
export interface ListFilters {
  status?: TaskStatus;
  assignee_id?: string;
  client_id?: string;
  type?: TaskType;
  due_before?: string;
  view?: "my_tasks" | "due_this_week";
  /** Pre-resolved team_members.id for the caller (only used when view=my_tasks). */
  caller_team_member_id?: string | null;
}
