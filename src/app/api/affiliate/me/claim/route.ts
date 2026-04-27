/**
 * Claim an affiliate invite — links the signed-in user to an affiliate row
 * created without a user_id (i.e. invited by email before they signed up).
 * Email match must succeed; this prevents anyone from hijacking an invite.
 */
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = user.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "No email on session" }, { status: 400 });

  // Find any affiliate rows matching this email that haven't been claimed yet.
  const { data: rows, error } = await supabase
    .from("affiliates")
    .select("id")
    .eq("email", email)
    .is("user_id", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json({ ok: true, claimed: 0 });

  const ids = rows.map((r) => r.id);
  const { error: updErr } = await supabase
    .from("affiliates")
    .update({ user_id: user.id })
    .in("id", ids);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, claimed: ids.length });
}
