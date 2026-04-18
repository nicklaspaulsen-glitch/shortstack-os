import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { executePlatformAction } from "@/lib/ads/platforms";
import type { AdAction } from "@/lib/types";
import { requireOwnedClient, getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET — Fetch ad actions with optional filters
export async function GET(request: NextRequest) {
  // Auth check
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = request.nextUrl;

    const status = searchParams.get("status");
    const campaignId = searchParams.get("campaign_id");
    const clientId = searchParams.get("client_id");

    // If a client_id is provided, verify caller owns that client.
    if (clientId) {
      const ctx = await requireOwnedClient(authSupabase, user.id, clientId);
      if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Resolve effective owner and restrict ad_actions to caller-owned clients.
    const ownerId = await getEffectiveOwnerId(authSupabase, user.id);
    if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const supabase = createServiceClient();

    const { data: ownedClients } = await supabase
      .from("clients")
      .select("id")
      .eq("profile_id", ownerId);
    const ownedClientIds = (ownedClients || []).map((c) => c.id as string);

    if (ownedClientIds.length === 0) {
      return NextResponse.json({ actions: [] });
    }

    let query = supabase
      .from("ad_actions")
      .select("*")
      .in("client_id", ownedClientIds)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }
    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }
    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data: actions, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch actions" }, { status: 500 });
    }

    return NextResponse.json({ actions: (actions || []) as AdAction[] });
  } catch (error) {
    console.error("[ads/actions] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch actions" },
      { status: 500 }
    );
  }
}

// POST — Approve, reject, or execute an action
export async function POST(request: NextRequest) {
  // Auth check
  const authSupabase2 = createServerSupabase();
  const { data: { user: user2 } } = await authSupabase2.auth.getUser();
  if (!user2) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = createServiceClient();
    const { action_id, operation } = await request.json();

    if (!action_id || !operation) {
      return NextResponse.json(
        { error: "action_id and operation are required" },
        { status: 400 }
      );
    }

    if (!["approve", "reject", "execute"].includes(operation)) {
      return NextResponse.json(
        { error: "operation must be 'approve', 'reject', or 'execute'" },
        { status: 400 }
      );
    }

    // Fetch the action
    const { data: action, error: fetchError } = await supabase
      .from("ad_actions")
      .select("*")
      .eq("id", action_id)
      .single();

    if (fetchError || !action) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }

    // Verify the action belongs to a client owned by the caller.
    const ctx = await requireOwnedClient(authSupabase2, user2.id, action.client_id);
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (operation === "approve") {
      const { data: updated, error: updateError } = await supabase
        .from("ad_actions")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("id", action_id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: "Failed to approve action" }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: updated });
    }

    if (operation === "reject") {
      const { data: updated, error: updateError } = await supabase
        .from("ad_actions")
        .update({ status: "rejected" })
        .eq("id", action_id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: "Failed to reject action" }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: updated });
    }

    // operation === "execute"
    // Set status to executing
    await supabase
      .from("ad_actions")
      .update({ status: "executing" })
      .eq("id", action_id);

    try {
      const result = await executePlatformAction(action as AdAction);

      const { data: updated, error: updateError } = await supabase
        .from("ad_actions")
        .update({
          status: "executed",
          executed_at: new Date().toISOString(),
          execution_result: result,
        })
        .eq("id", action_id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: "Action executed but failed to update record" }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: updated });
    } catch (execError) {
      const errorMessage =
        execError instanceof Error ? execError.message : "Unknown execution error";

      await supabase
        .from("ad_actions")
        .update({
          status: "failed",
          error_message: errorMessage,
        })
        .eq("id", action_id);

      return NextResponse.json(
        { error: "Action execution failed", message: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[ads/actions] POST error:", error);
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}
