import { NextRequest, NextResponse } from "next/server";
import {
  loadJobAsCaller,
  setServiceStatus,
  setServiceDone,
  setServiceFailed,
  rootDomainOf,
} from "@/lib/domains/hub-job";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Portal sub-task: register `portal.<domain>` in `portal_subdomains` so the
 * portal router recognizes it, and return the DNS CNAME the client needs
 * to point at our portal host.
 *
 * This is the service with the largest "manual follow-up" footprint:
 *   - Vercel needs the subdomain added as a wildcard alias on the portal
 *     project (or pre-configured wildcard CNAME)
 *   - The apex-level GoDaddy zone must include `CNAME portal → cname.vercel-dns.com`
 *
 * We write the `portal_subdomains` row + attempt the CNAME PATCH at
 * GoDaddy, but if either step relies on infra that isn't wired up yet we
 * still succeed with a `manual_dns_required: true` hint so the UI can
 * surface the instructions.
 */

function resolveGoDaddyConfig() {
  const prodKey = process.env.GODADDY_API_KEY;
  const prodSecret = process.env.GODADDY_API_SECRET;
  const oteKey = process.env.GODADDY_API_KEY_OTE;
  const oteSecret = process.env.GODADDY_API_SECRET_OTE;
  const forceOte = process.env.GODADDY_USE_OTE === "1" || process.env.GODADDY_USE_OTE === "true";
  if (forceOte && oteKey && oteSecret)
    return { key: oteKey, secret: oteSecret, baseUrl: "https://api.ote-godaddy.com", env: "ote" as const };
  if (prodKey && prodSecret)
    return { key: prodKey, secret: prodSecret, baseUrl: "https://api.godaddy.com", env: "production" as const };
  if (oteKey && oteSecret)
    return { key: oteKey, secret: oteSecret, baseUrl: "https://api.ote-godaddy.com", env: "ote" as const };
  return null;
}

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

  await setServiceStatus(jobId, "portal", "in_progress");

  try {
    const apex = rootDomainOf(domain);
    const subdomain = `portal.${apex}`;
    const svc = createServiceClient();

    // Upsert — re-running the Hub flow should not error on the unique constraint.
    const { data: existing } = await svc
      .from("portal_subdomains")
      .select("id")
      .eq("subdomain", subdomain)
      .maybeSingle();

    if (!existing) {
      const { error } = await svc.from("portal_subdomains").insert({
        profile_id: ownerId,
        subdomain,
        apex_domain: apex,
      });
      if (error) {
        await setServiceFailed(jobId, "portal", error.message);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    // Attempt to write the portal CNAME at GoDaddy. Best-effort: if the
    // PATCH fails we still mark the sub-task done, with a flag so the UI
    // can render the manual instructions. This keeps OTE/sandbox users
    // unblocked.
    const portalTarget = process.env.PORTAL_CNAME_TARGET || "cname.vercel-dns.com";
    const cfg = resolveGoDaddyConfig();
    let cnamePatched = false;
    let manualDnsRequired = true;
    let dnsError: string | null = null;

    if (cfg) {
      try {
        const res = await fetch(
          `${cfg.baseUrl}/v1/domains/${encodeURIComponent(apex)}/records`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `sso-key ${cfg.key}:${cfg.secret}`,
            },
            body: JSON.stringify([
              { type: "CNAME", name: "portal", data: portalTarget, ttl: 3600 },
            ]),
          },
        );
        if (res.ok) {
          cnamePatched = true;
          manualDnsRequired = false;
        } else {
          dnsError = `GoDaddy PATCH HTTP ${res.status}`;
        }
      } catch (err) {
        dnsError = err instanceof Error ? err.message : String(err);
      }
    } else {
      dnsError = "GoDaddy credentials not configured";
    }

    await setServiceDone(jobId, "portal", {
      subdomain,
      apex_domain: apex,
      public_url: `https://${subdomain}`,
      cname_target: portalTarget,
      cname_patched: cnamePatched,
      manual_dns_required: manualDnsRequired,
      vercel_alias_required: true,
      dns_error: dnsError,
      dns_records: [
        { type: "CNAME", name: "portal", data: portalTarget, ttl: 3600 },
      ],
    });

    return NextResponse.json({ ok: true, subdomain });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setServiceFailed(jobId, "portal", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
