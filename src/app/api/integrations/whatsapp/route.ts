import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// WhatsApp Business API via Meta Cloud API
// Requires: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_BUSINESS_ACCOUNT_ID
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

const WA_API = "https://graph.facebook.com/v21.0";

function getConfig() {
  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
  };
}

// Get message templates, business profile
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cfg = getConfig();
  if (!cfg.accessToken) return NextResponse.json({ error: "WhatsApp not configured", connected: false }, { status: 500 });

  const action = request.nextUrl.searchParams.get("action") || "templates";

  try {
    if (action === "templates") {
      const res = await fetch(
        `${WA_API}/${cfg.businessAccountId}/message_templates?limit=50`,
        { headers: { Authorization: `Bearer ${cfg.accessToken}` } }
      );
      const data = await res.json();
      return NextResponse.json({
        success: true,
        templates: (data.data || []).map((t: Record<string, unknown>) => ({
          name: t.name,
          status: t.status,
          category: t.category,
          language: t.language,
          id: t.id,
        })),
      });
    }

    if (action === "business_profile") {
      const res = await fetch(
        `${WA_API}/${cfg.phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`,
        { headers: { Authorization: `Bearer ${cfg.accessToken}` } }
      );
      const data = await res.json();
      return NextResponse.json({ success: true, profile: data.data?.[0] || {} });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: `WhatsApp API error: ${err}` }, { status: 500 });
  }
}

// Send messages (text, template, media)
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cfg = getConfig();
  if (!cfg.accessToken) return NextResponse.json({ error: "WhatsApp not configured" }, { status: 500 });

  const { action, to, client_id, ...params } = await request.json();
  if (!to) return NextResponse.json({ error: "Recipient phone number (to) required" }, { status: 400 });

  // Normalize phone number — strip non-digits, ensure country code
  const phone = to.replace(/\D/g, "");

  try {
    if (action === "send_text") {
      const { message } = params;
      const res = await fetch(`${WA_API}/${cfg.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: { preview_url: true, body: message },
        }),
      });
      const data = await res.json();

      if (client_id) {
        await supabase.from("trinity_log").insert({
          action_type: "custom",
          description: `WhatsApp message sent to ${phone}`,
          client_id,
          status: "completed",
          result: { type: "whatsapp_message", message_id: data.messages?.[0]?.id },
        });
      }

      return NextResponse.json({ success: true, message_id: data.messages?.[0]?.id });
    }

    if (action === "send_template") {
      const { template_name, language, components } = params;
      const res = await fetch(`${WA_API}/${cfg.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: template_name,
            language: { code: language || "en_US" },
            components: components || [],
          },
        }),
      });
      const data = await res.json();
      return NextResponse.json({ success: true, message_id: data.messages?.[0]?.id });
    }

    if (action === "send_media") {
      const { type, media_url, caption } = params;
      const mediaType = type || "image";
      const res = await fetch(`${WA_API}/${cfg.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: mediaType,
          [mediaType]: { link: media_url, caption },
        }),
      });
      const data = await res.json();
      return NextResponse.json({ success: true, message_id: data.messages?.[0]?.id });
    }

    return NextResponse.json({ error: "Unknown action. Use: send_text, send_template, send_media" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: `WhatsApp API error: ${err}` }, { status: 500 });
  }
}
