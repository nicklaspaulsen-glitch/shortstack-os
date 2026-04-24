import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET  /api/review-requests/config  — list configs for the authed profile
// POST /api/review-requests/config  — create or upsert a config
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("review_request_configs")
    .select("*")
    .eq("profile_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const {
    id,
    client_id,
    trigger_type = "appointment_completed",
    delay_minutes = 60,
    platform = "google",
    review_url,
    message_template,
    channel = "sms",
    enabled = true,
  } = body;

  if (!review_url) {
    return NextResponse.json({ error: "review_url is required" }, { status: 400 });
  }

  const payload = {
    profile_id: ownerId,
    client_id: client_id || null,
    trigger_type,
    delay_minutes: Number(delay_minutes),
    platform,
    review_url,
    message_template:
      message_template ||
      "Hi {{first_name}}, thanks for your visit! We'd love a review: {{review_url}}",
    channel,
    enabled,
  };

  let result;
  if (id) {
    // Update existing — verify ownership first
    const { data, error } = await supabase
      .from("review_request_configs")
      .update(payload)
      .eq("id", id)
      .eq("profile_id", ownerId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = data;
  } else {
    const { data, error } = await supabase
      .from("review_request_configs")
      .insert(payload)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = data;
  }

  return NextResponse.json({ config: result });
}
