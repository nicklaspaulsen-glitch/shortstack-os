import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import {
  addResendDomain,
  getResendDomain,
  verifyResendDomain,
  listResendDomains,
  deleteResendDomain,
  mapResendStatus,
} from "@/lib/services/resend-domain";

// ──────────────────────────────────────────────────────────────────────────
// /api/mail-setup — agency email domain setup
//
//  POST   { domain }        — register domain with Resend, returns DNS records
//  GET    ?id=<resendId>    — fetch current status (polling)
//  GET                      — list all the agency's domains
//  DELETE ?id=<resendId>    — remove a domain from Resend
//
// Every path is scoped to the caller's effective owner — team_members roll
// up to their parent agency so they see the same set of domains their
// agency owner set up.
// ──────────────────────────────────────────────────────────────────────────

interface AgencyDomainRow {
  id: string;
  profile_id: string;
  domain: string;
  resend_id: string;
  status: string;
  records: unknown;
  created_at: string;
  verified_at: string | null;
}

async function ensureTable(db: ReturnType<typeof createServiceClient>) {
  // Best-effort: try to select — if the table doesn't exist we catch and
  // return an instructive error. Migration is shipped as a file the
  // user/admin can apply manually.
  const { error } = await db
    .from("agency_mail_domains")
    .select("id", { count: "exact", head: true })
    .limit(1);
  return !error || !/does not exist|not found|42P01/i.test(error.message);
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { domain } = await request.json();
  if (!domain || typeof domain !== "string") {
    return NextResponse.json({ error: "domain required" }, { status: 400 });
  }

  // Basic domain shape validation — not exhaustive (Resend validates too)
  const cleaned = domain.trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(cleaned)) {
    return NextResponse.json(
      { error: "Invalid domain format. Use subdomain.yourdomain.com" },
      { status: 400 },
    );
  }

  const result = await addResendDomain(cleaned);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, status: result.status },
      { status: result.status || 502 },
    );
  }

  // Persist to Supabase if the table exists (migration may not be applied
  // yet — in that case we still return the DNS records to the UI).
  const db = createServiceClient();
  const hasTable = await ensureTable(db);
  let dbRow: AgencyDomainRow | null = null;
  if (hasTable) {
    const { data, error } = await db
      .from("agency_mail_domains")
      .insert({
        profile_id: ownerId,
        domain: cleaned,
        resend_id: result.data.id,
        status: mapResendStatus(result.data.status),
        records: result.data.records || [],
      })
      .select()
      .single();
    if (!error) dbRow = data as AgencyDomainRow;
  }

  return NextResponse.json({
    ok: true,
    id: result.data.id,
    domain: cleaned,
    status: mapResendStatus(result.data.status),
    records: result.data.records || [],
    row: dbRow,
    table_exists: hasTable,
    setup_instructions: [
      "Copy the DNS records below.",
      "Add each as a new record in your DNS provider (GoDaddy, Cloudflare, Namecheap, Route 53, etc.).",
      "Wait 5–30 minutes for DNS to propagate.",
      "Return here and click Verify — we'll confirm Resend sees the records.",
    ],
  });
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const resendId = request.nextUrl.searchParams.get("id");
  const verify = request.nextUrl.searchParams.get("verify") === "1";

  // Single-domain status check (polling)
  if (resendId) {
    // Force Resend to re-check DNS if asked (verify=1 triggers fresh check)
    if (verify) {
      const v = await verifyResendDomain(resendId);
      if (!v.ok) {
        return NextResponse.json({ error: v.error }, { status: v.status || 502 });
      }
    }
    const result = await getResendDomain(resendId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status || 502 });
    }

    // Update our row if the table exists
    const db = createServiceClient();
    const hasTable = await ensureTable(db);
    const normalized = mapResendStatus(result.data.status);
    if (hasTable) {
      await db
        .from("agency_mail_domains")
        .update({
          status: normalized,
          records: result.data.records || [],
          verified_at: normalized === "verified" ? new Date().toISOString() : null,
        })
        .eq("resend_id", resendId)
        .eq("profile_id", ownerId);
    }

    return NextResponse.json({
      ok: true,
      id: resendId,
      domain: result.data.name,
      status: normalized,
      resend_status: result.data.status,
      records: result.data.records || [],
    });
  }

  // List all agency domains
  const db = createServiceClient();
  const hasTable = await ensureTable(db);
  if (!hasTable) {
    // Fallback: list from Resend directly (not agency-filtered — warn UI)
    const r = await listResendDomains();
    return NextResponse.json({
      ok: true,
      table_exists: false,
      warning: "Supabase `agency_mail_domains` table not applied yet — showing all Resend domains.",
      domains: r.ok ? r.data : [],
    });
  }

  const { data } = await db
    .from("agency_mail_domains")
    .select("*")
    .eq("profile_id", ownerId)
    .order("created_at", { ascending: false });
  return NextResponse.json({
    ok: true,
    domains: data || [],
    table_exists: true,
  });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const resendId = request.nextUrl.searchParams.get("id");
  if (!resendId) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Verify ownership via our row (if table exists)
  const db = createServiceClient();
  const hasTable = await ensureTable(db);
  if (hasTable) {
    const { data: row } = await db
      .from("agency_mail_domains")
      .select("profile_id")
      .eq("resend_id", resendId)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    if ((row as { profile_id: string }).profile_id !== ownerId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  const result = await deleteResendDomain(resendId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status || 502 });
  }

  if (hasTable) {
    await db.from("agency_mail_domains").delete().eq("resend_id", resendId).eq("profile_id", ownerId);
  }

  return NextResponse.json({ ok: true });
}
