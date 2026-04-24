import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// GET — fetch WhatsApp account settings + recent messages for authenticated user
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Account row (messaging_accounts with provider='whatsapp')
  const { data: account } = await service
    .from("messaging_accounts")
    .select("id, phone_number, phone_number_id, business_account_id, display_name, business_description, business_logo_url, auto_reply_enabled, auto_reply_template, business_hours, status, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("provider", "whatsapp")
    .maybeSingle();

  // Recent conversations for this user on the whatsapp channel
  const { data: conversations } = await service
    .from("conversations")
    .select("id, contact_id, external_thread_id, subject, last_message_at, last_message_preview, unread_count, status")
    .eq("user_id", user.id)
    .eq("channel", "whatsapp")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(20);

  const convoIds = (conversations ?? []).map((c) => c.id);
  let messages: unknown[] = [];
  if (convoIds.length > 0) {
    const { data: msgs } = await service
      .from("conversation_messages")
      .select("id, conversation_id, direction, from_identifier, to_identifier, body, sent_at, read_at")
      .in("conversation_id", convoIds)
      .order("sent_at", { ascending: false })
      .limit(50);
    messages = msgs ?? [];
  }

  const envConfigured = Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
  );

  return NextResponse.json({
    account: account || null,
    conversations: conversations ?? [],
    messages,
    env_configured: envConfigured,
  });
}

// PUT — upsert WhatsApp account settings
export async function PUT(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const allowed = [
      "phone_number",
      "phone_number_id",
      "business_account_id",
      "display_name",
      "business_description",
      "business_logo_url",
      "auto_reply_enabled",
      "auto_reply_template",
      "business_hours",
    ];
    const updates: Record<string, unknown> = {
      user_id: user.id,
      provider: "whatsapp",
      updated_at: new Date().toISOString(),
    };
    for (const k of allowed) if (k in body) updates[k] = body[k];

    const service = createServiceClient();
    const { data, error } = await service
      .from("messaging_accounts")
      .upsert(updates, { onConflict: "user_id,provider" })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ account: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// POST — send a test message via the Meta Cloud API
export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken) {
    return NextResponse.json({
      error: "WHATSAPP_ACCESS_TOKEN not set",
      instructions: "Add WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID to Vercel env vars.",
    }, { status: 500 });
  }

  let body: { to: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { to, message } = body;
  if (!to) return NextResponse.json({ error: "'to' (phone) required" }, { status: 400 });

  const service = createServiceClient();
  const { data: account } = await service
    .from("messaging_accounts")
    .select("phone_number_id")
    .eq("user_id", user.id)
    .eq("provider", "whatsapp")
    .maybeSingle();

  const phoneId = account?.phone_number_id || envPhoneId;
  if (!phoneId) {
    return NextResponse.json({ error: "No phone_number_id configured" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message || "Test message from ShortStack OS" },
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: "Send failed", detail: payload }, { status: 500 });
    }
    return NextResponse.json({ success: true, response: payload });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Send failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
