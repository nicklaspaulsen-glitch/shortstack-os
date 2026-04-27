/**
 * Mark a booking as a no-show.
 *
 * The host calls POST /api/scheduling/bookings/{id}/no-show after a slot
 * elapsed and the guest didn't join. This:
 *   - flips bookings.status to 'no_show'
 *   - stamps no_show_at
 *   - does NOT fire appointment_completed (separate trigger)
 *
 * The DELETE method clears the no-show flag (operator marked wrong).
 *
 * Auth: requires the booking to belong to the requesting user (or their
 * agency parent).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("bookings")
    .update({
      status: "no_show",
      no_show_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", ownerId)
    .select("id, status, no_show_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  return NextResponse.json({ booking: data });
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("bookings")
    .update({
      status: "confirmed",
      no_show_at: null,
    })
    .eq("id", id)
    .eq("user_id", ownerId)
    .select("id, status, no_show_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  return NextResponse.json({ booking: data });
}
