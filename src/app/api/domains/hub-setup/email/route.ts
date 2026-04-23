import { NextRequest, NextResponse } from "next/server";
import {
  loadJobAsCaller,
  setServiceStatus,
  setServiceDone,
  setServiceFailed,
} from "@/lib/domains/hub-job";
import { setupResendMailForDomain } from "@/app/api/websites/domains/mail-setup/route";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Email sub-task: provision the domain in Resend, write DKIM/SPF/DMARC at
 * GoDaddy, kick off verification.
 *
 * Delegates to the existing `setupResendMailForDomain` helper — we just
 * make sure the `website_domains` row exists first (Hub flow may be
 * pre-purchase on a domain the user already owns elsewhere).
 */

export async function POST(request: NextRequest) {
  let body: { job_id?: string; domain?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { job_id: jobId, domain } = body;
  if (!jobId || !domain) {
    return NextResponse.json({ error: "job_id and domain required" }, { status: 400 });
  }

  const loaded = await loadJobAsCaller(jobId);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }
  const { ownerId } = loaded;

  await setServiceStatus(jobId, "email", "in_progress");

  try {
    // Ensure there's a website_domains row — mail-setup keys off it. In the
    // Hub flow we may be provisioning BEFORE the GoDaddy purchase clears,
    // so upsert a minimal row with status='pending'.
    const svc = createServiceClient();
    const { data: existing } = await svc
      .from("website_domains")
      .select("id")
      .eq("profile_id", ownerId)
      .eq("domain", domain)
      .maybeSingle();

    if (!existing) {
      await svc.from("website_domains").insert({
        profile_id: ownerId,
        domain,
        status: "pending",
      });
    }

    const result = await setupResendMailForDomain(ownerId, domain);

    // DMARC policy record — Resend doesn't include this by default (they
    // only care about DKIM/SPF for sending). We inject a permissive p=none
    // record so the client passes DMARC reporting from day one.
    const dmarcRecord = {
      type: "TXT",
      name: "_dmarc",
      value: `v=DMARC1; p=none; rua=mailto:postmaster@${domain}`,
      ttl: 3600,
    };
    const records = [...(result.dns_records || []), dmarcRecord];

    if (!result.ok && !result.sandbox) {
      await setServiceFailed(jobId, "email", result.error || "Email setup failed", {
        resend_domain_id: result.resend_domain_id,
        dns_records: records,
      });
      return NextResponse.json({ ok: false, error: result.error });
    }

    await setServiceDone(jobId, "email", {
      resend_domain_id: result.resend_domain_id,
      resend_status: result.status || "pending",
      dns_records: records,
      sandbox: result.sandbox || false,
      send_address: `hello@${domain}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setServiceFailed(jobId, "email", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
