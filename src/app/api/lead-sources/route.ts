/**
 * Lead Sources API — CRUD over `lead_sources` table.
 *
 * GET also enriches each source with live attribution counts pulled from
 * the `leads` table (count of leads where lead_source_id = <source.id>).
 * The persisted total_leads_attributed / total_revenue_cents columns act
 * as a cache for display when live joins are slow; the live count is the
 * source of truth.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

type LeadSource = {
  id: string;
  user_id: string;
  source_name: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  description: string | null;
  total_leads_attributed: number;
  total_revenue_cents: number;
  created_at: string;
};

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { data: sources, error } = await supabase
    .from("lead_sources")
    .select("*")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Compute live attribution: count leads per source_id.
  // Single query, grouped client-side to avoid N+1 per source.
  const sourceIds = (sources ?? []).map((s) => s.id);
  const liveCounts: Record<string, number> = {};
  if (sourceIds.length > 0) {
    const { data: leadRows } = await supabase
      .from("leads")
      .select("lead_source_id")
      .eq("user_id", ownerId)
      .in("lead_source_id", sourceIds);
    for (const row of (leadRows ?? []) as Array<{ lead_source_id: string | null }>) {
      if (!row.lead_source_id) continue;
      liveCounts[row.lead_source_id] = (liveCounts[row.lead_source_id] || 0) + 1;
    }
  }

  const enriched = (sources ?? []).map((s: LeadSource) => ({
    ...s,
    live_lead_count: liveCounts[s.id] ?? 0,
  }));

  return NextResponse.json({ sources: enriched });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const body = await request.json();
  const { source_name, utm_source, utm_medium, utm_campaign, description } = body ?? {};
  if (!source_name || typeof source_name !== "string") {
    return NextResponse.json({ error: "source_name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lead_sources")
    .insert({
      user_id: ownerId,
      source_name: source_name.trim(),
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      description: description || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ source: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const body = await request.json();
  const { id, ...updates } = body ?? {};
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const allowed = ["source_name", "utm_source", "utm_medium", "utm_campaign", "description"];
  const safe: Record<string, unknown> = {};
  for (const k of allowed) if (k in updates) safe[k] = updates[k];
  if (Object.keys(safe).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lead_sources")
    .update(safe)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ source: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase
    .from("lead_sources")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
