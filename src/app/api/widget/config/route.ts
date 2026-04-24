import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Widget config endpoint — serves non-sensitive per-hub branding so the
 * embed script doesn't need to hardcode greeting/name. Public and
 * CORS-open; anything truly private stays server-side.
 *
 * GET /api/widget/config?token=cw_…
 *   → { name, domain, greeting?, theme?, primary? }
 */

export const runtime = "nodejs";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(payload: unknown, init: number | ResponseInit = 200) {
  const initObj = typeof init === "number" ? { status: init } : init;
  const headers = new Headers(initObj.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  headers.set("Content-Type", "application/json");
  // Short cache to reduce origin hits without making config changes feel stuck.
  headers.set("Cache-Control", "public, max-age=60");
  return new NextResponse(JSON.stringify(payload), { ...initObj, headers });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();

  if (!token || !token.startsWith("cw_")) {
    return json({ error: "token required" }, 400);
  }

  const svc = createServiceClient();

  const { data: widget } = await svc
    .from("chat_widgets")
    .select("profile_id, domain, token")
    .eq("token", token)
    .maybeSingle();

  if (!widget) return json({ error: "Unknown widget token" }, 404);

  const row = widget as { profile_id: string; domain: string; token: string };

  // Resolve a friendly name for the header. Prefer the owning profile's
  // business name; fall back to the domain. Failures keep us quiet — the
  // widget has sensible defaults baked in.
  let name = row.domain;
  try {
    const { data: profile } = await svc
      .from("profiles")
      .select("business_name, first_name")
      .eq("id", row.profile_id)
      .maybeSingle();
    const p = profile as { business_name?: string | null; first_name?: string | null } | null;
    if (p?.business_name) name = p.business_name;
    else if (p?.first_name) name = `${p.first_name}`;
  } catch {
    /* defaults are fine */
  }

  return json({
    name,
    domain: row.domain,
    greeting: `Hi! You're chatting with ${name}. How can we help?`,
    theme: "light",
    primary: "#C9A84C",
  });
}
