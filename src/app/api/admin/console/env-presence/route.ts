/**
 * GET /api/admin/console/env-presence
 *
 * Returns a list of critical env-var names with a boolean indicating
 * whether they are set. NEVER returns actual values.
 *
 * Gated to admin or founder roles.
 */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CRITICAL_VARS = [
  "DISCORD_BOT_TOKEN",
  "NOTION_CLIENT_ID",
  "SLACK_BOT_TOKEN",
  "LINKEDIN_CLIENT_ID",
  "TIKTOK_ADS_APP_ID",
  "PANDADOC_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "STRIPE_SECRET_KEY",
  "RESEND_API_KEY",
  "ELEVENLABS_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "CRON_SECRET",
] as const;

export interface EnvPresenceItem {
  name: string;
  present: boolean;
}

export async function GET() {
  const authClient = createServerSupabase();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "founder") {
    return NextResponse.json({ error: "Admin or founder only" }, { status: 403 });
  }

  const items: EnvPresenceItem[] = CRITICAL_VARS.map((name) => ({
    name,
    present: Boolean(process.env[name]),
  }));

  return NextResponse.json({ items });
}
