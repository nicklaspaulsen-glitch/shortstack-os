import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Customize AI Bot — Clients can name their bot and configure its personality
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, bot_name, bot_personality, bot_greeting, bot_capabilities, bot_tone } = await request.json();

  // Find client
  const clientId = client_id || (await supabase.from("clients").select("id").eq("profile_id", user.id).single()).data?.id;
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Store bot config in client notes or a dedicated field
  const botConfig = {
    name: bot_name || "Trinity",
    personality: bot_personality || "professional and friendly",
    greeting: bot_greeting || "Hey! How can I help you today?",
    capabilities: bot_capabilities || ["answer questions", "check status", "request content", "get marketing advice"],
    tone: bot_tone || "warm, helpful, concise",
    updated_at: new Date().toISOString(),
  };

  // Store in social_accounts as a bot config
  const { data: existing } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("client_id", clientId)
    .eq("platform", "ai_bot_config")
    .single();

  if (existing) {
    await supabase.from("social_accounts").update({
      metadata: botConfig,
      account_name: bot_name || "Trinity",
    }).eq("id", existing.id);
  } else {
    await supabase.from("social_accounts").insert({
      client_id: clientId,
      platform: "ai_bot_config",
      account_name: bot_name || "Trinity",
      is_active: true,
      metadata: botConfig,
    });
  }

  return NextResponse.json({ success: true, config: botConfig });
}

// Get bot config for a client
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("client_id");

  const query = clientId
    ? supabase.from("social_accounts").select("metadata, account_name").eq("client_id", clientId).eq("platform", "ai_bot_config").single()
    : supabase.from("social_accounts").select("metadata, account_name").eq("platform", "ai_bot_config").eq("client_id",
      (await supabase.from("clients").select("id").eq("profile_id", user.id).single()).data?.id || ""
    ).single();

  const { data } = await query;

  return NextResponse.json({
    config: data?.metadata || {
      name: "Trinity",
      personality: "professional and friendly",
      greeting: "Hey! How can I help you today?",
      capabilities: ["answer questions", "check status", "request content", "get marketing advice"],
      tone: "warm, helpful, concise",
    },
  });
}
