import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import {
  addResendDomain,
  getResendDomain,
  verifyResendDomain,
  mapResendStatus,
  resendRecordsToGoDaddy,
  ResendDnsRecord,
} from "@/lib/services/resend-domain";

/**
 * Resend mail auto-setup for a purchased domain.
 *
 * POST  { domain }           → provision in Resend + write DNS at GoDaddy + kick off verify
 * GET   ?domain=example.com  → poll current Resend status, sync to DB
 *
 * Required: caller must own the matching `website_domains` row.
 *
 * Sandbox: GoDaddy OTE (`GODADDY_USE_OTE=1`) doesn't actually hold the
 * domain, so writing DNS returns 404/422. We detect that and return a clearly
 * flagged `{ sandbox: true }` error instead of crashing the flow.
 */

// Mirrors the resolution in /search — production wins, OTE is fallback, or
// can be forced via GODADDY_USE_OTE=1.
function resolveGoDaddyConfig() {
  const prodKey = process.env.GODADDY_API_KEY;
  const prodSecret = process.env.GODADDY_API_SECRET;
  const oteKey = process.env.GODADDY_API_KEY_OTE;
  const oteSecret = process.env.GODADDY_API_SECRET_OTE;
  const forceOte =
    process.env.GODADDY_USE_OTE === "1" || process.env.GODADDY_USE_OTE === "true";

  if (forceOte && oteKey && oteSecret) {
    return { key: oteKey, secret: oteSecret, baseUrl: "https://api.ote-godaddy.com", env: "ote" as const };
  }
  if (prodKey && prodSecret) {
    return { key: prodKey, secret: prodSecret, baseUrl: "https://api.godaddy.com", env: "production" as const };
  }
  if (oteKey && oteSecret) {
    return { key: oteKey, secret: oteSecret, baseUrl: "https://api.ote-godaddy.com", env: "ote" as const };
  }
  return null;
}

function rootDomain(domain: string): string {
  const parts = domain.split(".");
  return parts.length > 2 ? parts.slice(-2).join(".") : domain;
}

/**
 * PATCH Resend's DNS records onto the domain's zone at GoDaddy without
 * clobbering unrelated records (A/CNAME for the website, MX the user has
 * configured elsewhere, etc.). PATCH appends; PUT would replace — we do NOT
 * want to replace.
 */
async function patchGoDaddyRecords(
  domain: string,
  records: Array<{ type: string; name: string; data: string; ttl: number; priority?: number }>,
): Promise<{ ok: true } | { ok: false; error: string; sandbox?: boolean; status?: number }> {
  const cfg = resolveGoDaddyConfig();
  if (!cfg) {
    return { ok: false, error: "GoDaddy credentials not configured" };
  }
  const root = rootDomain(domain);
  const res = await fetch(`${cfg.baseUrl}/v1/domains/${encodeURIComponent(root)}/records`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `sso-key ${cfg.key}:${cfg.secret}`,
    },
    body: JSON.stringify(records),
  });
  if (res.ok) return { ok: true };

  const txt = await res.text().catch(() => "");
  // OTE: domain isn't actually registered in our reseller account, so GoDaddy
  // returns 404 "UNKNOWN_DOMAIN" or 422 when writing records. Surface this as
  // a sandbox limitation rather than a generic failure — lets the UI display
  // something useful during staging/testing.
  const sandbox = cfg.env === "ote" && (res.status === 404 || res.status === 422 || /unknown.?domain/i.test(txt));
  return {
    ok: false,
    error: `GoDaddy DNS PATCH failed (HTTP ${res.status}): ${txt.slice(0, 300)}`,
    sandbox,
    status: res.status,
  };
}

interface DomainRow {
  id: string;
  profile_id: string;
  domain: string;
  resend_domain_id: string | null;
  resend_status: string | null;
}

async function loadOwnedDomain(
  supabase: SupabaseClient,
  ownerId: string,
  domain: string,
): Promise<DomainRow | null> {
  const { data } = await supabase
    .from("website_domains")
    .select("id, profile_id, domain, resend_domain_id, resend_status")
    .eq("profile_id", ownerId)
    .eq("domain", domain)
    .maybeSingle();
  return (data as DomainRow | null) ?? null;
}

/**
 * Run the mail-setup flow end-to-end. Exported for `auto-configure` to call
 * directly without a self-fetch.
 *
 * Uses the service client so it works from webhook/internal paths too.
 */
export async function setupResendMailForDomain(
  ownerId: string,
  domain: string,
): Promise<{
  ok: boolean;
  resend_domain_id?: string;
  status?: string;
  dns_records?: ResendDnsRecord[];
  sandbox?: boolean;
  error?: string;
}> {
  const supabase = createServiceClient();
  const row = await loadOwnedDomain(supabase, ownerId, domain);
  if (!row) return { ok: false, error: "Domain not found or not owned by caller" };

  // 1. Add to Resend (idempotent-ish: if already there, Resend returns 400;
  //    fall back to a lookup so we don't double-provision).
  let resendId = row.resend_domain_id;
  let dnsRecords: ResendDnsRecord[] = [];

  if (!resendId) {
    const created = await addResendDomain(domain);
    if (!created.ok) {
      // If Resend reports the domain already exists on this account, we can't
      // recover without listing — surface the error to the caller to triage.
      await supabase.from("website_domains").update({
        resend_last_error: created.error.slice(0, 500),
        resend_status: "failed",
      }).eq("id", row.id);
      return { ok: false, error: `Resend create failed: ${created.error}` };
    }
    resendId = created.data.id;
    dnsRecords = created.data.records || [];
  } else {
    // Already created — re-fetch records so we can (re)write them.
    const fetched = await getResendDomain(resendId);
    if (!fetched.ok) {
      await supabase.from("website_domains").update({
        resend_last_error: fetched.error.slice(0, 500),
      }).eq("id", row.id);
      return { ok: false, error: `Resend lookup failed: ${fetched.error}` };
    }
    dnsRecords = fetched.data.records || [];
  }

  // 2. Write DNS at GoDaddy (OTE-aware).
  const gdRecords = resendRecordsToGoDaddy(dnsRecords, rootDomain(domain));
  const dnsResult = await patchGoDaddyRecords(domain, gdRecords);

  if (!dnsResult.ok) {
    await supabase.from("website_domains").update({
      resend_domain_id: resendId,
      resend_status: dnsResult.sandbox ? "pending" : "failed",
      resend_dns_configured: false,
      resend_last_error: dnsResult.error.slice(0, 500),
    }).eq("id", row.id);
    return {
      ok: false,
      resend_domain_id: resendId,
      dns_records: dnsRecords,
      sandbox: dnsResult.sandbox,
      error: dnsResult.sandbox
        ? "Sandbox limitation: GoDaddy OTE doesn't hold real domains, so DNS write was rejected. The Resend entry exists; DNS must be applied on a real GoDaddy account."
        : dnsResult.error,
    };
  }

  // 3. Kick off Resend verification (best-effort — Resend will poll even if
  //    this call fails, we just store the best status we can see).
  let status: "pending" | "verifying" | "verified" | "failed" = "verifying";
  const verify = await verifyResendDomain(resendId);
  if (verify.ok) status = mapResendStatus(verify.data.status);

  // 4. Persist to DB.
  await supabase.from("website_domains").update({
    resend_domain_id: resendId,
    resend_status: status,
    resend_dns_configured: true,
    resend_last_error: null,
  }).eq("id", row.id);

  return {
    ok: true,
    resend_domain_id: resendId,
    status,
    dns_records: dnsRecords,
  };
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let parsed: { domain?: string };
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const domain = parsed.domain?.trim();
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });

  // Ownership check — loadOwnedDomain inside setupResendMailForDomain does
  // this already, but we also check here so we can reject with 403 instead
  // of a generic error.
  const { data: owns } = await supabase
    .from("website_domains")
    .select("id")
    .eq("profile_id", ownerId)
    .eq("domain", domain)
    .maybeSingle();
  if (!owns) return NextResponse.json({ error: "Domain not found or forbidden" }, { status: 403 });

  const result = await setupResendMailForDomain(ownerId, domain);
  const httpStatus = result.ok ? 200 : result.sandbox ? 200 : 500;
  return NextResponse.json(result, { status: httpStatus });
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const domain = request.nextUrl.searchParams.get("domain");
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });

  const row = await loadOwnedDomain(supabase as unknown as SupabaseClient, ownerId, domain);
  if (!row) return NextResponse.json({ error: "Domain not found or forbidden" }, { status: 403 });

  if (!row.resend_domain_id) {
    return NextResponse.json({
      ok: true,
      resend_domain_id: null,
      status: null,
      message: "Mail not yet set up for this domain",
    });
  }

  const fetched = await getResendDomain(row.resend_domain_id);
  if (!fetched.ok) {
    return NextResponse.json(
      { ok: false, error: fetched.error, resend_domain_id: row.resend_domain_id, status: row.resend_status },
      { status: 500 },
    );
  }

  const newStatus = mapResendStatus(fetched.data.status);
  if (newStatus !== row.resend_status) {
    const service = createServiceClient();
    await service.from("website_domains").update({
      resend_status: newStatus,
      ...(newStatus === "verified" ? { resend_last_error: null } : {}),
    }).eq("id", row.id);
  }

  return NextResponse.json({
    ok: true,
    resend_domain_id: row.resend_domain_id,
    status: newStatus,
    raw_status: fetched.data.status,
    records: fetched.data.records || [],
  });
}
