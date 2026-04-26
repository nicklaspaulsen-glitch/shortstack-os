import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET /api/whatsapp/numbers
//
// Lists WhatsApp-capable phone numbers across both providers:
//  - Meta Cloud API: messaging_accounts row (phone_number_id) for the owner
//  - Twilio: any provisioned number with twilio_phone_number set on a client
//    + the env-default TWILIO_WHATSAPP_NUMBER if configured
//
// All scoped to the effective owner (so team_members see the agency's numbers).
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();

  // Meta-Cloud account row (single per agency-owner)
  const { data: metaAccount } = await service
    .from("messaging_accounts")
    .select("phone_number, phone_number_id, display_name, status, created_at")
    .eq("user_id", ownerId)
    .eq("provider", "whatsapp")
    .maybeSingle();

  // Twilio-backed client numbers
  const { data: clientNumbers } = await service
    .from("clients")
    .select("id, business_name, twilio_phone_number, twilio_phone_sid, created_at")
    .eq("profile_id", ownerId)
    .not("twilio_phone_number", "is", null);

  type NumberRow = {
    id: string;
    provider: "meta-cloud" | "twilio";
    phone: string;
    label: string;
    status: string;
    created_at: string | null;
  };

  const numbers: NumberRow[] = [];
  if (metaAccount?.phone_number) {
    numbers.push({
      id: `meta-${metaAccount.phone_number_id ?? metaAccount.phone_number}`,
      provider: "meta-cloud",
      phone: String(metaAccount.phone_number),
      label: String(metaAccount.display_name || "Meta WhatsApp"),
      status: String(metaAccount.status || "active"),
      created_at: (metaAccount.created_at as string | null) ?? null,
    });
  }
  for (const c of clientNumbers ?? []) {
    if (!c.twilio_phone_number) continue;
    numbers.push({
      id: `twilio-${c.id}`,
      provider: "twilio",
      phone: String(c.twilio_phone_number),
      label: String(c.business_name || "Twilio number"),
      status: "active",
      created_at: (c.created_at as string | null) ?? null,
    });
  }

  // Env-default fallback (only when no other numbers exist for the owner)
  if (numbers.length === 0 && process.env.TWILIO_WHATSAPP_NUMBER) {
    numbers.push({
      id: "env-default",
      provider: "twilio",
      phone: process.env.TWILIO_WHATSAPP_NUMBER,
      label: "Default (env)",
      status: "active",
      created_at: null,
    });
  }

  return NextResponse.json({
    numbers,
    env_meta_configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    env_twilio_configured: Boolean(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER,
    ),
  });
}
