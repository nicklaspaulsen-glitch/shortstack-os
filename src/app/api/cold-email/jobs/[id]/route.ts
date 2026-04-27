/**
 * Single cold-email job — status + progress + delete.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) ?? user.id;

  const { data: job, error } = await supabase
    .from("cold_email_jobs")
    .select("*")
    .eq("id", ctx.params.id)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Sample of recent personalizations for the UI.
  const { data: samples } = await supabase
    .from("cold_email_personalizations")
    .select(
      "id, status, generated_subject, generated_opener, generated_body, lead_id, error_message, created_at",
    )
    .eq("job_id", ctx.params.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ job, samples: samples ?? [] });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) ?? user.id;
  const { error } = await supabase
    .from("cold_email_jobs")
    .delete()
    .eq("id", ctx.params.id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
