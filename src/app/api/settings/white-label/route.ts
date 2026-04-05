import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// White-Label Settings — Clients see their own branding
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, brand_name, primary_color, logo_url, tagline } = await request.json();

  const config = { brand_name, primary_color: primary_color || "#C9A84C", logo_url, tagline, updated_at: new Date().toISOString() };

  const { data: existing } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("client_id", client_id)
    .eq("platform", "white_label_config")
    .single();

  if (existing) {
    await supabase.from("social_accounts").update({ metadata: config }).eq("id", existing.id);
  } else {
    await supabase.from("social_accounts").insert({
      client_id, platform: "white_label_config", account_name: brand_name || "Custom Brand",
      is_active: true, metadata: config,
    });
  }

  return NextResponse.json({ success: true, config });
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("client_id");
  if (!clientId) {
    const { data: client } = await supabase.from("clients").select("id").eq("profile_id", user.id).single();
    if (!client) return NextResponse.json({ config: null });
    const { data } = await supabase.from("social_accounts").select("metadata").eq("client_id", client.id).eq("platform", "white_label_config").single();
    return NextResponse.json({ config: data?.metadata || null });
  }

  const { data } = await supabase.from("social_accounts").select("metadata").eq("client_id", clientId).eq("platform", "white_label_config").single();
  return NextResponse.json({ config: data?.metadata || null });
}
