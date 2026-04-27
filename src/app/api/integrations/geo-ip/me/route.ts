import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { extractClientIp, lookupIp } from "@/lib/integrations/geo-ip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Look up the caller's geo info from request headers. Auth-gated.
 *
 * Used by the dashboard "what's my country" widget and by client-portal
 * pages that want to default the displayed currency to the caller's locale.
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = extractClientIp(request.headers);
  const lookup = await lookupIp(ip);

  if (!lookup) {
    return NextResponse.json({
      success: false,
      ip,
      lookup: null,
      message: "Lookup unavailable (likely private IP / dev environment)",
    });
  }

  return NextResponse.json({ success: true, ip, lookup });
}
