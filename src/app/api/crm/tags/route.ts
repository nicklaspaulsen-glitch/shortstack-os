import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET /api/crm/tags — list all tags for this agency (optionally scoped to one lead)
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const leadId = request.nextUrl.searchParams.get("lead_id");

  let q = supabase
    .from("lead_tags")
    .select("id, lead_id, tag, created_at")
    .eq("profile_id", ownerId)
    .order("created_at", { ascending: false });

  if (leadId) q = q.eq("lead_id", leadId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, tags: data || [] });
}

// POST /api/crm/tags — tag a lead. Body: { lead_id, tag }
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lead_id, tag } = (await request.json()) as { lead_id?: string; tag?: string };
  if (!lead_id || !tag) {
    return NextResponse.json({ error: "lead_id and tag are required" }, { status: 400 });
  }

  // Verify the lead belongs to this agency
  const { data: lead } = await supabase
    .from("leads")
    .select("id, user_id")
    .eq("id", lead_id)
    .single();
  if (!lead || lead.user_id !== ownerId) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("lead_tags")
    .insert({ profile_id: ownerId, lead_id, tag })
    .select()
    .single();

  if (error) {
    // Unique-violation means the tag already exists — return the existing row.
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("lead_tags")
        .select("*")
        .eq("lead_id", lead_id)
        .eq("tag", tag)
        .single();
      return NextResponse.json({ success: true, tag: existing, duplicate: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire trigger for tag_added so automations/workflows can react
  try {
    const { fireTrigger } = await import("@/lib/workflows/trigger-dispatch");
    await fireTrigger({
      supabase,
      userId: ownerId,
      triggerType: "tag_added",
      payload: { lead_id, tag },
    });
  } catch (err) {
    console.error("[crm/tags] trigger dispatch failed:", err);
  }

  return NextResponse.json({ success: true, tag: data });
}
