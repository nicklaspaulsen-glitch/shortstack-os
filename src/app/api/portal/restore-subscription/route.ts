import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// POST — Restore a cancelled subscription (before 30-day deletion)
export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Find cancelled client
  const { data: client } = await service
    .from("clients")
    .select("id, cancelled_at")
    .eq("profile_id", user.id)
    .single();

  if (!client?.cancelled_at) {
    return NextResponse.json({ error: "No active cancellation to restore" }, { status: 400 });
  }

  // Remove cancellation
  await service
    .from("clients")
    .update({
      cancelled_at: null,
      cancellation_reason: null,
      scheduled_deletion_at: null,
    })
    .eq("id", client.id);

  // Cancel pending deletion request
  await service
    .from("account_deletion_requests")
    .update({ status: "cancelled", processed_at: new Date().toISOString(), processed_by: "user" })
    .eq("profile_id", user.id)
    .eq("status", "pending");

  try {
    await service.from("trinity_log").insert({
      user_id: user.id,
      action_type: "subscription_restored",
      description: "User restored their cancelled subscription.",
      status: "completed",
    });
  } catch (err) { console.error("[portal/restore-subscription] trinity_log insert failed:", err); }

  return NextResponse.json({ success: true, message: "Your subscription has been restored. Welcome back!" });
}
