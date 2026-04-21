import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// DELETE /api/crm/tags/[id] — remove a specific tag row
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Pull the row first so we can fire a trigger on the way out.
  const { data: existing } = await supabase
    .from("lead_tags")
    .select("id, lead_id, tag")
    .eq("id", params.id)
    .eq("profile_id", ownerId)
    .single();

  const { error } = await supabase
    .from("lead_tags")
    .delete()
    .eq("id", params.id)
    .eq("profile_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (existing) {
    try {
      const { fireTrigger } = await import("@/lib/workflows/trigger-dispatch");
      await fireTrigger({
        supabase,
        userId: ownerId,
        triggerType: "tag_removed",
        payload: { lead_id: existing.lead_id, tag: existing.tag },
      });
    } catch (err) {
      console.error("[crm/tags/[id]] trigger dispatch failed:", err);
    }
  }

  return NextResponse.json({ success: true });
}
