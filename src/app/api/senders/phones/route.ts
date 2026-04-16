import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET — List all phone numbers for the user
export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("phone_numbers")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error && error.message.includes("relation") && error.message.includes("does not exist")) {
    return NextResponse.json({ phones: [], hint: "Table phone_numbers not found" });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ phones: data || [] });
}

// POST — Add a new phone number to the pool (manual add, not Twilio purchase)
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { phone_number, label, type, twilio_sid, daily_limit, country } = await request.json();

  if (!phone_number) {
    return NextResponse.json({ error: "phone_number is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("phone_numbers")
    .insert({
      user_id: user.id,
      phone_number,
      label: label || null,
      type: type || null,
      twilio_sid: twilio_sid || null,
      daily_limit: daily_limit || null,
      country: country || null,
      status: "warmup",
      warmup_stage: 0,
      sent_today: 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
