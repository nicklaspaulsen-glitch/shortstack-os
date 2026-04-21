/*
 * SQL Migration — run once in Supabase SQL Editor:
 *
 * CREATE TABLE IF NOT EXISTS deals (
 *   id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *   title           text NOT NULL,
 *   client_name     text NOT NULL,
 *   value           numeric NOT NULL DEFAULT 0,
 *   stage           text NOT NULL DEFAULT 'prospect'
 *                     CHECK (stage IN ('prospect','qualified','proposal_sent','negotiation','closed_won','closed_lost')),
 *   probability     integer NOT NULL DEFAULT 10,
 *   expected_close_date date,
 *   contact_email   text,
 *   contact_phone   text,
 *   notes           text,
 *   source          text,
 *   created_at      timestamptz NOT NULL DEFAULT now(),
 *   updated_at      timestamptz NOT NULL DEFAULT now()
 * );
 *
 * -- Auto-update updated_at on row change
 * CREATE OR REPLACE FUNCTION update_deals_updated_at()
 * RETURNS TRIGGER AS $$
 * BEGIN
 *   NEW.updated_at = now();
 *   RETURN NEW;
 * END;
 * $$ LANGUAGE plpgsql;
 *
 * CREATE TRIGGER deals_updated_at
 *   BEFORE UPDATE ON deals
 *   FOR EACH ROW EXECUTE FUNCTION update_deals_updated_at();
 *
 * -- RLS: users can only access their own deals
 * ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Users can view own deals"
 *   ON deals FOR SELECT USING (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can insert own deals"
 *   ON deals FOR INSERT WITH CHECK (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can update own deals"
 *   ON deals FOR UPDATE USING (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can delete own deals"
 *   ON deals FOR DELETE USING (auth.uid() = user_id);
 *
 * -- Index for fast user lookups
 * CREATE INDEX idx_deals_user_id ON deals(user_id);
 * CREATE INDEX idx_deals_stage   ON deals(stage);
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { fireTrigger } from "@/lib/workflows/trigger-dispatch";

// GET — fetch deals for the authenticated user, optionally scoped to a client
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");

  let query = supabase
    .from("deals")
    .select("*")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false });

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deals: data });
}

// POST — create a new deal
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const body = await request.json();
  const { title, client_name, value, stage, probability, expected_close_date, contact_email, contact_phone, notes, source } = body;

  if (!title || !client_name) {
    return NextResponse.json({ error: "title and client_name are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("deals")
    .insert({
      user_id: ownerId,
      title,
      client_name,
      value: value ?? 0,
      stage: stage ?? "prospect",
      probability: probability ?? 10,
      expected_close_date: expected_close_date ?? null,
      contact_email: contact_email ?? null,
      contact_phone: contact_phone ?? null,
      notes: notes ?? null,
      source: source ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deal: data }, { status: 201 });
}

// PATCH — update an existing deal (stage changes, field edits)
export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Only allow updating known deal fields
  const allowedFields = [
    "title", "client_name", "value", "stage", "probability",
    "expected_close_date", "contact_email", "contact_phone", "notes", "source",
  ];
  const safeUpdates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in updates) {
      safeUpdates[key] = updates[key];
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Capture the previous stage BEFORE the update so we can include both
  // from_stage and to_stage in the pipeline_stage_changed trigger payload.
  let prevStage: string | null = null;
  if ("stage" in safeUpdates) {
    const { data: existing } = await supabase
      .from("deals")
      .select("stage")
      .eq("id", id)
      .eq("user_id", ownerId)
      .maybeSingle();
    prevStage = (existing as { stage?: string } | null)?.stage || null;
  }

  const { data, error } = await supabase
    .from("deals")
    .update(safeUpdates)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire the pipeline_stage_changed trigger if the stage actually moved.
  // Fire-and-forget — doesn't block the API response.
  if (
    "stage" in safeUpdates &&
    typeof safeUpdates.stage === "string" &&
    prevStage &&
    prevStage !== safeUpdates.stage
  ) {
    const service = createServiceClient();
    fireTrigger({
      supabase: service,
      userId: ownerId,
      triggerType: "pipeline_stage_changed",
      payload: {
        deal_id: id,
        from_stage: prevStage,
        to_stage: safeUpdates.stage,
        ...(data as Record<string, unknown>),
      },
    }).catch((err) => console.error("[deals] fireTrigger failed:", err));
  }

  return NextResponse.json({ deal: data });
}

// DELETE — remove a deal
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("deals")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
