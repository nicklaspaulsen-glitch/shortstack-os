import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET — List all email senders for the user
export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("email_senders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ emails: data || [] });
}

// POST — Add a new email sender to the pool
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    email,
    display_name,
    label,
    smtp_provider,
    smtp_host,
    smtp_port,
    smtp_user,
    daily_limit,
  } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("email_senders")
    .insert({
      user_id: user.id,
      email,
      display_name: display_name || null,
      label: label || null,
      smtp_provider: smtp_provider || null,
      smtp_host: smtp_host || null,
      smtp_port: smtp_port || null,
      smtp_user: smtp_user || null,
      daily_limit: daily_limit || null,
      status: "pending",
      warmup_stage: 0,
      sent_today: 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
