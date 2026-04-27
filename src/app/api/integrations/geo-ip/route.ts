import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { lookupIp } from "@/lib/integrations/geo-ip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lightweight IP-format check — accepts IPv4 dotted-quad and IPv6 colon-hex.
// Real validation is done by the upstream providers; this just keeps obvious
// garbage out of our logs and the cache.
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^([0-9a-fA-F:]+)$/;

function looksLikeIp(s: string): boolean {
  return IPV4_RE.test(s) || (s.includes(":") && IPV6_RE.test(s));
}

export async function GET(request: NextRequest) {
  // Auth-gated — geo lookups consume our (free-tier) quota and produce
  // PII-adjacent data. Don't expose to anonymous callers.
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ip = searchParams.get("ip")?.trim();

  if (!ip) {
    return NextResponse.json(
      { error: "ip query parameter is required" },
      { status: 400 },
    );
  }

  if (!looksLikeIp(ip)) {
    return NextResponse.json(
      { error: "ip must be a valid IPv4 or IPv6 address" },
      { status: 400 },
    );
  }

  const lookup = await lookupIp(ip);
  if (!lookup) {
    return NextResponse.json(
      { success: false, lookup: null, message: "Lookup unavailable (private IP, quota exhausted, or all providers down)" },
    );
  }

  return NextResponse.json({ success: true, lookup });
}
