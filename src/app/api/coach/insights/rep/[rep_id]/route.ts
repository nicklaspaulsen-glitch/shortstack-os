/**
 * GET /api/coach/insights/rep/[rep_id]
 *
 * Rep-level aggregate: avg score, last 30/60/90-day trends, top categories
 * of insights, total analyses run.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  createServiceClient,
} from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

interface InsightShape {
  category?: string;
  text?: string;
}

interface AnalysisRow {
  id: string;
  source_type: string;
  source_id: string;
  overall_score: number | null;
  insights: InsightShape[] | null;
  metrics: Record<string, unknown> | null;
  created_at: string;
}

function bucketDays(rows: AnalysisRow[], days: number) {
  const cutoff = Date.now() - days * 86400000;
  const subset = rows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  if (subset.length === 0) return { count: 0, avg_score: 0 };
  const avg = subset.reduce((s, r) => s + (r.overall_score || 0), 0) / subset.length;
  return { count: subset.length, avg_score: Math.round(avg) };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { rep_id: string } },
) {
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

  const service = createServiceClient();

  const { data: rep, error: repErr } = await service
    .from("profiles")
    .select("id, full_name, email, role, parent_agency_id")
    .eq("id", params.rep_id)
    .maybeSingle();
  if (repErr) {
    return NextResponse.json({ error: repErr.message }, { status: 500 });
  }
  // Rep must either be the owner themselves, a team_member of the owner, or
  // a client managed by the owner. Without a direct ownership column on
  // profiles for clients, we fall back to a presence check via team_members.
  let allowed = rep?.id === ownerId;
  if (!allowed && rep?.role === "team_member") {
    allowed = rep.parent_agency_id === ownerId;
  }
  if (!allowed) {
    const { data: tm } = await service
      .from("team_members")
      .select("id")
      .eq("agency_owner_id", ownerId)
      .eq("member_profile_id", params.rep_id)
      .maybeSingle();
    if (tm) allowed = true;
  }
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await service
    .from("coach_analyses")
    .select("id, source_type, source_id, overall_score, insights, metrics, created_at")
    .eq("user_id", ownerId)
    .eq("rep_id", params.rep_id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []) as AnalysisRow[];

  // Aggregate insight categories (top issues across the rep's calls).
  const categoryCounts = new Map<string, number>();
  for (const row of rows) {
    if (!Array.isArray(row.insights)) continue;
    for (const insight of row.insights) {
      const cat = typeof insight?.category === "string" ? insight.category : "tone";
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }
  }
  const topCategories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  return NextResponse.json({
    ok: true,
    rep: rep
      ? {
          id: rep.id,
          full_name: rep.full_name,
          email: rep.email,
        }
      : null,
    total_analyses: rows.length,
    last_7d: bucketDays(rows, 7),
    last_30d: bucketDays(rows, 30),
    last_90d: bucketDays(rows, 90),
    avg_score:
      rows.length > 0
        ? Math.round(rows.reduce((s, r) => s + (r.overall_score || 0), 0) / rows.length)
        : 0,
    top_insight_categories: topCategories,
    recent: rows.slice(0, 20).map((r) => ({
      id: r.id,
      source_type: r.source_type,
      source_id: r.source_id,
      overall_score: r.overall_score,
      created_at: r.created_at,
    })),
  });
}
