import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Social Media Account Connection — Connect client social accounts to ShortStack OS
// Stores account credentials so AI assistant can access and manage them
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, platform, account_name, account_id, access_token, refresh_token } = await request.json();

  // Check if already connected
  const { data: existing } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("client_id", client_id)
    .eq("platform", platform)
    .single();

  if (existing) {
    // Update existing connection
    await supabase.from("social_accounts").update({
      account_name, account_id,
      access_token: access_token || null,
      refresh_token: refresh_token || null,
      is_active: true,
      token_expires_at: access_token ? new Date(Date.now() + 60 * 86400000).toISOString() : null,
      metadata: { connected_at: new Date().toISOString(), connected_by: user.id },
    }).eq("id", existing.id);
  } else {
    // Create new connection
    await supabase.from("social_accounts").insert({
      client_id, platform, account_name, account_id,
      access_token: access_token || null,
      refresh_token: refresh_token || null,
      is_active: true,
      token_expires_at: access_token ? new Date(Date.now() + 60 * 86400000).toISOString() : null,
      metadata: { connected_at: new Date().toISOString(), connected_by: user.id },
    });
  }

  // Also setup Zernio profile if not exists
  const { data: zernioProfile } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("client_id", client_id)
    .eq("platform", "zernio")
    .single();

  if (!zernioProfile) {
    const { data: client } = await supabase.from("clients").select("business_name").eq("id", client_id).single();
    if (client) {
      await supabase.from("social_accounts").insert({
        client_id, platform: "zernio", account_name: client.business_name,
        is_active: true, metadata: { auto_created: true },
      });
    }
  }

  return NextResponse.json({ success: true, platform, account_name });
}

// Get all connected accounts for a client
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("client_id");

  // If no client_id, get current user's client
  let id = clientId;
  if (!id) {
    const { data: client } = await supabase.from("clients").select("id").eq("profile_id", user.id).single();
    id = client?.id;
  }

  if (!id) return NextResponse.json({ accounts: [] });

  const { data } = await supabase
    .from("social_accounts")
    .select("id, platform, account_name, account_id, is_active, created_at, metadata")
    .eq("client_id", id)
    .not("platform", "in", "(ai_bot_config,white_label_config)")
    .order("platform");

  return NextResponse.json({ accounts: data || [] });
}

// Disconnect an account
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { account_id } = await request.json();
  await supabase.from("social_accounts").update({ is_active: false }).eq("id", account_id);
  return NextResponse.json({ success: true });
}
