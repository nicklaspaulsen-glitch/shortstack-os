/**
 * Agent memory API.
 *
 * GET    /api/agent-memory/:subjectKind/:subjectId  — list memories for a subject
 * DELETE /api/agent-memory/:subjectKind/:subjectId  — GDPR forget all memories for a subject
 *
 * Auth: signed-in agency owner / team member. Memories are RLS-scoped by
 * `agency_owner_id` so even a malformed query can't leak across tenants.
 *
 * Subject-kind validation rejects unknown kinds before the DB hit.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { forgetSubject, type SubjectKind } from "@/lib/ai/mem0-client";

export const dynamic = "force-dynamic";

const VALID_SUBJECT_KINDS: SubjectKind[] = [
  "lead",
  "client",
  "user",
  "team_member",
  "agent",
];

function isValidSubjectKind(value: string): value is SubjectKind {
  return (VALID_SUBJECT_KINDS as string[]).includes(value);
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: Promise<{ subjectKind: string; subjectId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { subjectKind, subjectId } = await context.params;
  if (!isValidSubjectKind(subjectKind)) {
    return NextResponse.json(
      { error: "Invalid subject_kind" },
      { status: 400 },
    );
  }
  if (!UUID_REGEX.test(subjectId)) {
    return NextResponse.json(
      { error: "Invalid subject_id" },
      { status: 400 },
    );
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Read from the local audit mirror — RLS confines us to the owner's rows.
  const { data, error } = await supabase
    .from("agent_memories")
    .select("id, fact, agent_key, source, source_ref_id, metadata, created_at")
    .eq("agency_owner_id", ownerId)
    .eq("subject_kind", subjectKind)
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load memories" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    data: data ?? [],
    meta: {
      total: (data ?? []).length,
      subject_kind: subjectKind,
      subject_id: subjectId,
    },
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { subjectKind, subjectId } = await context.params;
  if (!isValidSubjectKind(subjectKind)) {
    return NextResponse.json(
      { error: "Invalid subject_kind" },
      { status: 400 },
    );
  }
  if (!UUID_REGEX.test(subjectId)) {
    return NextResponse.json(
      { error: "Invalid subject_id" },
      { status: 400 },
    );
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await forgetSubject({
    agencyOwnerId: ownerId,
    subjectKind,
    subjectId,
  });

  return NextResponse.json({
    success: result.deleted,
    data: { forgotten: result.deleted },
  });
}
