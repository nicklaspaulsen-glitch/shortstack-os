import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * DNS record management for purchased domains via GoDaddy.
 *
 * GET  ?domain=example.com     → returns current DNS records
 * PUT  { domain, records: [] } → replaces the DNS records for the domain
 *
 * Ownership check: only the profile that owns the website_domains row can manage it.
 */

interface DnsRecord {
  type: string;
  name: string;
  data: string;
  ttl?: number;
  priority?: number;
  port?: number;
  weight?: number;
}

async function assertOwnership(
  supabase: ReturnType<typeof createServerSupabase>,
  userId: string,
  domain: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("website_domains")
    .select("profile_id")
    .eq("domain", domain)
    .maybeSingle();
  return !!data && data.profile_id === userId;
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const domain = request.nextUrl.searchParams.get("domain");
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });

  const ok = await assertOwnership(supabase, user.id, domain);
  if (!ok) return NextResponse.json({ error: "Domain not found or forbidden" }, { status: 403 });

  const godaddyKey = process.env.GODADDY_API_KEY;
  const godaddySecret = process.env.GODADDY_API_SECRET;

  if (!godaddyKey || !godaddySecret) {
    // Return cached records
    const { data: row } = await supabase
      .from("website_domains")
      .select("dns_records")
      .eq("domain", domain)
      .single();
    return NextResponse.json({ records: row?.dns_records || [], source: "cache" });
  }

  try {
    const res = await fetch(`https://api.godaddy.com/v1/domains/${encodeURIComponent(domain)}/records`, {
      headers: { Authorization: `sso-key ${godaddyKey}:${godaddySecret}` },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `GoDaddy returned ${res.status}`, records: [] }, { status: 500 });
    }
    const records = await res.json();
    await supabase.from("website_domains").update({ dns_records: records }).eq("domain", domain);
    return NextResponse.json({ records, source: "godaddy" });
  } catch (err) {
    return NextResponse.json({ error: String(err), records: [] }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { domain, records } = await request.json();
  if (!domain || !Array.isArray(records)) {
    return NextResponse.json({ error: "domain and records[] required" }, { status: 400 });
  }

  const ok = await assertOwnership(supabase, user.id, domain);
  if (!ok) return NextResponse.json({ error: "Domain not found or forbidden" }, { status: 403 });

  const godaddyKey = process.env.GODADDY_API_KEY;
  const godaddySecret = process.env.GODADDY_API_SECRET;

  if (!godaddyKey || !godaddySecret) {
    // Persist to cache only
    await supabase.from("website_domains").update({
      dns_records: records as DnsRecord[],
      status: "dns_configured",
    }).eq("domain", domain);
    return NextResponse.json({ success: true, stub: true, records });
  }

  try {
    const res = await fetch(`https://api.godaddy.com/v1/domains/${encodeURIComponent(domain)}/records`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `sso-key ${godaddyKey}:${godaddySecret}`,
      },
      body: JSON.stringify(records),
    });
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `GoDaddy returned ${res.status}: ${err}` }, { status: 500 });
    }
    await supabase.from("website_domains").update({
      dns_records: records as DnsRecord[],
      status: "dns_configured",
    }).eq("domain", domain);
    return NextResponse.json({ success: true, records });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
