import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Authed proxy for voice-assistant quick actions.
// SECURITY: Replaces the prior pattern of exposing CRON_SECRET to the browser via
// NEXT_PUBLIC_CRON_SECRET. The browser now posts here with its Supabase auth cookie;
// this route checks role and forwards server-side to the cron endpoint with the
// real (server-only) CRON_SECRET.
//
// Allowed actions map 1:1 to existing /api/cron/* GET handlers. Do NOT add webhook
// or admin-migration actions here without an explicit admin-only gate.

type VoiceAction = "outreach" | "scrape-leads" | "health-check";

const ACTION_TO_CRON: Record<VoiceAction, string> = {
  outreach: "/api/cron/outreach",
  "scrape-leads": "/api/cron/scrape-leads",
  "health-check": "/api/cron/health-check",
};

const ALLOWED_ROLES = new Set(["admin", "owner", "team_member"]);

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { action?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action as VoiceAction | undefined;
  if (!action || !(action in ACTION_TO_CRON)) {
    return NextResponse.json(
      { error: "Invalid action. Allowed: outreach, scrape-leads, health-check" },
      { status: 400 },
    );
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  // Build absolute URL for the server-to-server forward.
  const origin = request.nextUrl.origin;
  const targetUrl = `${origin}${ACTION_TO_CRON[action]}`;

  try {
    const cronRes = await fetch(targetUrl, {
      method: "GET",
      headers: { authorization: `Bearer ${cronSecret}` },
    });

    const contentType = cronRes.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await cronRes.json();
      return NextResponse.json(data, { status: cronRes.status });
    }
    const text = await cronRes.text();
    return new NextResponse(text, {
      status: cronRes.status,
      headers: { "content-type": contentType || "text/plain" },
    });
  } catch (err) {
    console.error("[voice-actions] forward failed:", err);
    return NextResponse.json(
      { error: "Failed to dispatch voice action" },
      { status: 502 },
    );
  }
}
