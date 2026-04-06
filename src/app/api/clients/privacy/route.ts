import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET: Get client privacy settings
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("client_id");

  let id = clientId;
  if (!id) {
    const { data: client } = await supabase.from("clients").select("id").eq("profile_id", user.id).single();
    id = client?.id;
  }
  if (!id) return NextResponse.json({ settings: {} });

  const { data: client } = await supabase.from("clients").select("metadata").eq("id", id).single();
  const privacy = (client?.metadata as Record<string, unknown>)?.privacy || {};

  return NextResponse.json({ settings: privacy });
}

// POST: Update client privacy settings
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, settings } = await request.json();

  let id = client_id;
  if (!id) {
    const { data: client } = await supabase.from("clients").select("id").eq("profile_id", user.id).single();
    id = client?.id;
  }
  if (!id) return NextResponse.json({ error: "No client found" }, { status: 404 });

  // Get existing metadata and merge privacy settings
  const { data: client } = await supabase.from("clients").select("metadata").eq("id", id).single();
  const existingMetadata = (client?.metadata as Record<string, unknown>) || {};

  await supabase.from("clients").update({
    metadata: { ...existingMetadata, privacy: settings },
  }).eq("id", id);

  return NextResponse.json({ success: true });
}
