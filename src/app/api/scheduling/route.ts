/*
 * SQL Migration — run once in Supabase SQL Editor:
 *
 * CREATE TABLE IF NOT EXISTS meeting_types (
 *   id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *   name                  text NOT NULL,
 *   duration              integer NOT NULL DEFAULT 30,
 *   description           text,
 *   location_type         text NOT NULL DEFAULT 'zoom',
 *   color                 text,
 *   price                 numeric,
 *   active                boolean NOT NULL DEFAULT true,
 *   buffer_time           integer NOT NULL DEFAULT 0,
 *   max_bookings_per_day  integer,
 *   available_days        text[] NOT NULL DEFAULT '{mon,tue,wed,thu,fri}',
 *   available_hours_start text NOT NULL DEFAULT '09:00',
 *   available_hours_end   text NOT NULL DEFAULT '17:00',
 *   created_at            timestamptz NOT NULL DEFAULT now()
 * );
 *
 * ALTER TABLE meeting_types ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Users can view own meeting_types"
 *   ON meeting_types FOR SELECT USING (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can insert own meeting_types"
 *   ON meeting_types FOR INSERT WITH CHECK (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can update own meeting_types"
 *   ON meeting_types FOR UPDATE USING (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can delete own meeting_types"
 *   ON meeting_types FOR DELETE USING (auth.uid() = user_id);
 *
 * CREATE INDEX idx_meeting_types_user_id ON meeting_types(user_id);
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET — fetch all meeting types for the authenticated user
export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("meeting_types")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ meeting_types: data });
}

// POST — create a new meeting type
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, duration, description, location_type, color, price, active, buffer_time, max_bookings_per_day, available_days, available_hours_start, available_hours_end } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("meeting_types")
    .insert({
      user_id: user.id,
      name,
      duration: duration ?? 30,
      description: description ?? null,
      location_type: location_type ?? "zoom",
      color: color ?? "#C9A84C",
      price: price ?? null,
      active: active ?? true,
      buffer_time: buffer_time ?? 0,
      max_bookings_per_day: max_bookings_per_day ?? null,
      available_days: available_days ?? ["mon", "tue", "wed", "thu", "fri"],
      available_hours_start: available_hours_start ?? "09:00",
      available_hours_end: available_hours_end ?? "17:00",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ meeting_type: data }, { status: 201 });
}

// PATCH — update an existing meeting type
export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const allowedFields = [
    "name", "duration", "description", "location_type", "color", "price",
    "active", "buffer_time", "max_bookings_per_day", "available_days",
    "available_hours_start", "available_hours_end",
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

  const { data, error } = await supabase
    .from("meeting_types")
    .update(safeUpdates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ meeting_type: data });
}

// DELETE — remove a meeting type
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("meeting_types")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
