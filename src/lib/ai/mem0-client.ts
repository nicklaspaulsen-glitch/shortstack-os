/**
 * Mem0 long-term agent memory layer.
 *
 * Wraps the official `mem0ai` client with our scoping convention so memories
 * NEVER leak across agencies. Every Mem0 user-id is constructed as
 *
 *   `${agencyOwnerId}__${subjectKind}__${subjectId}`
 *
 * which gives us a hard privacy boundary at the SDK layer (in addition to the
 * RLS row in `agent_memories`).
 *
 * ## Why two stores?
 *
 * - **Mem0 backend** holds the embeddings + the canonical fact text. It does
 *   the semantic recall.
 * - **`agent_memories` Postgres table** is a local audit/index so the UI can
 *   render "what does Lyra remember about this lead?" without paying a Mem0
 *   round-trip per page load. Also gives us GDPR-ready `forgetSubject` in
 *   one transaction.
 *
 * ## Soft-fail
 *
 * If `MEM0_API_KEY` is unset, every public function no-ops and returns the
 * empty/safe shape. Production is expected to run with the key set; preview
 * deployments and local dev usually run without.
 */

import type { MemoryClient as MemoryClientType } from "mem0ai";
import { createServiceClient } from "@/lib/supabase/server";

export type SubjectKind = "lead" | "client" | "user" | "team_member" | "agent";

export interface RememberFactInput {
  agencyOwnerId: string;
  subjectKind: SubjectKind;
  subjectId: string;
  fact: string;
  agentKey?: string;
  source: string;
  sourceRefId?: string;
  metadata?: Record<string, unknown>;
}

export interface RecallFactsInput {
  agencyOwnerId: string;
  subjectKind: SubjectKind;
  subjectId: string;
  query?: string;
  limit?: number;
}

export interface ForgetSubjectInput {
  agencyOwnerId: string;
  subjectKind: SubjectKind;
  subjectId: string;
}

export interface RecalledFact {
  id: string;
  fact: string;
  score?: number;
  createdAt?: string;
}

/** Lazy-init singleton so module load is safe without env vars. */
let cachedClient: MemoryClientType | null = null;
let initAttempted = false;

function getMem0(): MemoryClientType | null {
  if (initAttempted) return cachedClient;
  initAttempted = true;

  const apiKey = process.env.MEM0_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    // Lazy require — keeps module load cheap when key is unset.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MemoryClient } = require("mem0ai") as typeof import("mem0ai");
    cachedClient = new MemoryClient({ apiKey });
    return cachedClient;
  } catch (err) {
    console.error("[mem0-client] init failed", err);
    return null;
  }
}

/**
 * Build the per-subject scoping id used as Mem0's `user_id`. Includes the
 * agency owner so memories never bleed across agencies even if subject IDs
 * collide.
 */
function scopedUserId(
  agencyOwnerId: string,
  subjectKind: SubjectKind,
  subjectId: string,
): string {
  return `${agencyOwnerId}__${subjectKind}__${subjectId}`;
}

/**
 * Persist a fact about a subject. Writes to Mem0 + `agent_memories`.
 * Soft-fails on any error — memory is auxiliary, never on the request hot path.
 */
export async function rememberFact(
  input: RememberFactInput,
): Promise<{ memoryId: string | null }> {
  const client = getMem0();
  if (!client) return { memoryId: null };

  const fact = (input.fact || "").trim();
  if (!fact) return { memoryId: null };

  try {
    const userId = scopedUserId(
      input.agencyOwnerId,
      input.subjectKind,
      input.subjectId,
    );
    const result = await client.add(
      [{ role: "user", content: fact }],
      {
        userId,
        metadata: {
          agencyOwnerId: input.agencyOwnerId,
          subjectKind: input.subjectKind,
          subjectId: input.subjectId,
          agentKey: input.agentKey ?? null,
          source: input.source,
          ...(input.metadata ?? {}),
        },
      },
    );

    // mem0 returns an array of Memory objects (one per extracted fact).
    const first = Array.isArray(result) && result.length > 0 ? result[0] : null;
    const mem0MemoryId = first?.id ?? null;

    if (!mem0MemoryId) {
      // Mem0 sometimes returns an empty array if it deduped the fact —
      // not an error, just nothing new to record locally.
      return { memoryId: null };
    }

    try {
      const supabase = createServiceClient();
      await supabase.from("agent_memories").insert({
        agency_owner_id: input.agencyOwnerId,
        subject_kind: input.subjectKind,
        subject_id: input.subjectId,
        agent_key: input.agentKey ?? null,
        mem0_memory_id: mem0MemoryId,
        fact,
        source: input.source,
        source_ref_id: input.sourceRefId ?? null,
        metadata: input.metadata ?? {},
      });
    } catch (dbErr) {
      // Mem0 has the canonical record; failing to mirror locally isn't fatal.
      console.error("[mem0-client] local mirror insert failed", dbErr);
    }

    return { memoryId: mem0MemoryId };
  } catch (err) {
    console.error("[mem0-client] rememberFact failed", err);
    return { memoryId: null };
  }
}

/**
 * Recall facts for a subject, optionally semantically filtered by `query`.
 * Returns ordered, de-duplicated facts. Empty array when Mem0 is unconfigured
 * or any error occurs.
 */
export async function recallFacts(
  input: RecallFactsInput,
): Promise<RecalledFact[]> {
  const client = getMem0();
  if (!client) return [];

  const limit = Math.max(1, Math.min(50, input.limit ?? 10));
  const userId = scopedUserId(
    input.agencyOwnerId,
    input.subjectKind,
    input.subjectId,
  );

  try {
    if (input.query && input.query.trim()) {
      const res = await client.search(input.query.trim(), {
        filters: { user_id: userId },
        topK: limit,
      });
      return (res?.results ?? [])
        .map((m): RecalledFact => ({
          id: m.id,
          fact: m.memory ?? m.data?.memory ?? "",
          score: typeof m.score === "number" ? m.score : undefined,
          createdAt:
            m.createdAt instanceof Date
              ? m.createdAt.toISOString()
              : typeof m.createdAt === "string"
                ? m.createdAt
                : undefined,
        }))
        .filter((f) => f.fact.length > 0);
    }

    const res = await client.getAll({
      filters: { user_id: userId },
      pageSize: limit,
    });
    return (res?.results ?? [])
      .map((m): RecalledFact => ({
        id: m.id,
        fact: m.memory ?? m.data?.memory ?? "",
        createdAt:
          m.createdAt instanceof Date
            ? m.createdAt.toISOString()
            : typeof m.createdAt === "string"
              ? m.createdAt
              : undefined,
      }))
      .filter((f) => f.fact.length > 0);
  } catch (err) {
    console.error("[mem0-client] recallFacts failed", err);
    return [];
  }
}

/**
 * GDPR-style hard delete for everything Mem0 + the local mirror knows
 * about a single subject. Best-effort across both stores.
 */
export async function forgetSubject(
  input: ForgetSubjectInput,
): Promise<{ deleted: boolean }> {
  const client = getMem0();
  const userId = scopedUserId(
    input.agencyOwnerId,
    input.subjectKind,
    input.subjectId,
  );

  let mem0Ok = true;
  if (client) {
    try {
      await client.deleteAll({ userId });
    } catch (err) {
      console.error("[mem0-client] forgetSubject mem0 delete failed", err);
      mem0Ok = false;
    }
  }

  let dbOk = true;
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("agent_memories")
      .delete()
      .eq("agency_owner_id", input.agencyOwnerId)
      .eq("subject_kind", input.subjectKind)
      .eq("subject_id", input.subjectId);
    if (error) throw error;
  } catch (err) {
    console.error("[mem0-client] forgetSubject db delete failed", err);
    dbOk = false;
  }

  return { deleted: mem0Ok && dbOk };
}

/**
 * Whether Mem0 is configured. Useful for gating UI behavior so we don't
 * surface "Memories" tabs that will always be empty.
 */
export function isMem0Configured(): boolean {
  return Boolean(process.env.MEM0_API_KEY);
}
