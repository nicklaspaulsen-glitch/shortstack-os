/**
 * POST /api/trinity/proposals/[id]
 *
 * Approve or veto a proposal.  Body: { action: "approve" | "veto" }.
 * Approval immediately executes (the executeAction helper checks veto
 * window has expired OR the row is in 'approved' state).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { executeAction } from "@/lib/trinity/autonomous";

interface BodyShape {
  action?: unknown;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: BodyShape;
  try {
    body = (await request.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action.toLowerCase() : "";
  if (action !== "approve" && action !== "veto") {
    return NextResponse.json(
      { error: "action must be 'approve' or 'veto'" },
      { status: 400 },
    );
  }

  // Defense-in-depth ownership check before mutating.
  const { data: row } = await supabase
    .from("trinity_actions")
    .select("id, user_id, status")
    .eq("id", params.id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (row.status !== "proposed") {
    return NextResponse.json(
      { error: `Already ${row.status}` },
      { status: 409 },
    );
  }

  if (action === "veto") {
    const { error } = await supabase
      .from("trinity_actions")
      .update({
        status: "vetoed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("user_id", user.id);
    if (error) {
      console.error("[trinity/proposals/:id] veto error", error);
      return NextResponse.json({ error: "Failed to veto" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: "vetoed" });
  }

  // approve: flip to 'approved' so executeAction will pick it up regardless
  // of veto window.
  const { error: approveErr } = await supabase
    .from("trinity_actions")
    .update({
      status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("user_id", user.id);
  if (approveErr) {
    console.error("[trinity/proposals/:id] approve error", approveErr);
    return NextResponse.json({ error: "Failed to approve" }, { status: 500 });
  }

  // Execute synchronously so the user gets immediate feedback.
  const result = await executeAction(params.id);
  return NextResponse.json({ ok: true, status: result.status, result });
}
