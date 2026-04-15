/*
 * SQL Migration — run in Supabase SQL editor or add as a migration file:
 *
 * CREATE TABLE IF NOT EXISTS calendar_events (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *   title TEXT NOT NULL,
 *   client TEXT,
 *   team_member TEXT NOT NULL DEFAULT '',
 *   date DATE NOT NULL,
 *   time TEXT NOT NULL DEFAULT '09:00',
 *   duration TEXT NOT NULL DEFAULT '30',
 *   category TEXT NOT NULL DEFAULT 'meeting',   -- meeting, deadline, content, call
 *   type TEXT NOT NULL DEFAULT 'video',          -- phone, video, in_person
 *   recurring BOOLEAN NOT NULL DEFAULT false,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 *
 * CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);
 * CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);
 *
 * ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "calendar_events_own" ON calendar_events FOR ALL
 *   USING (user_id = auth.uid())
 *   WITH CHECK (user_id = auth.uid());
 *
 * CREATE POLICY "calendar_events_admin" ON calendar_events FOR ALL
 *   USING (get_user_role(auth.uid()) = 'admin');
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const service = createServiceClient();
  let query = service
    .from("calendar_events")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error } = await query;

  if (error) {
    console.error("[calendar] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { title, client, team_member, date, time, duration, category, type, recurring } = body;

    if (!title || !date) {
      return NextResponse.json({ error: "Title and date are required" }, { status: 400 });
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from("calendar_events")
      .insert({
        user_id: user.id,
        title,
        client: client || null,
        team_member: team_member || "",
        date,
        time: time || "09:00",
        duration: String(duration || "30"),
        category: category || "meeting",
        type: type || "video",
        recurring: recurring ?? false,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[calendar] POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ event: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: "Event id is required" }, { status: 400 });
    }

    // Only allow known fields
    const allowed = ["title", "client", "team_member", "date", "time", "duration", "category", "type", "recurring"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in fields) {
        updates[key] = key === "duration" ? String(fields[key]) : fields[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from("calendar_events")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      console.error("[calendar] PATCH error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ event: data });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Event id is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("calendar_events")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[calendar] DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
