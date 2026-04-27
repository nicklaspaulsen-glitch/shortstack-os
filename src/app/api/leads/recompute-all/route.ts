import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import {
  recomputeAllForUser,
  recomputeScore,
} from "@/lib/leads/score-recompute";

export const maxDuration = 300;

/**
 * POST /api/leads/recompute-all
 *
 * Admin batch — recomputes the most-stale leads under the caller's agency.
 * Body (optional): { maxLeads?, staleMinutes?, maxCostUsd?, leadIds? }
 *
 * Returns counts. Bounded by the same token-budget guard the cron uses.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

  // Only the agency owner (not team members) can trigger the batch directly.
  if (ownerId !== user.id) {
    return NextResponse.json(
      { error: "Only the agency owner can run a full recompute" },
      { status: 403 },
    );
  }

  let body: {
    maxLeads?: number;
    staleMinutes?: number;
    maxCostUsd?: number;
    leadIds?: string[];
  } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is OK — defaults will kick in
  }

  // If a specific list of lead IDs is supplied, recompute exactly those.
  if (Array.isArray(body.leadIds) && body.leadIds.length > 0) {
    const ids = body.leadIds.slice(0, 200);
    const { data: ownedLeads } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", ownerId)
      .in("id", ids);

    const owned = new Set((ownedLeads ?? []).map((r) => r.id as string));
    let processed = 0;
    let errors = 0;
    let skipped = 0;
    const startedAt = Date.now();

    for (const id of ids) {
      if (!owned.has(id)) {
        skipped++;
        continue;
      }
      try {
        const out = await recomputeScore(
          supabase,
          id,
          "/api/leads/recompute-all (selected)",
        );
        if (out) processed++;
        else skipped++;
      } catch (err) {
        console.error("[api/leads/recompute-all] one failed", id, err);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      skipped,
      errors,
      durationMs: Date.now() - startedAt,
    });
  }

  const result = await recomputeAllForUser(supabase, ownerId, {
    maxLeads: typeof body.maxLeads === "number" ? body.maxLeads : 100,
    staleMinutes:
      typeof body.staleMinutes === "number" ? body.staleMinutes : 60,
    maxCostUsd:
      typeof body.maxCostUsd === "number" ? body.maxCostUsd : 1.0,
    context: "/api/leads/recompute-all",
  });

  return NextResponse.json({ success: true, ...result });
}
