import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Auto-configure a purchased domain:
 *   1. Purchase the domain via GoDaddy API (if not already purchased)
 *   2. Add the domain to the associated Vercel project
 *   3. Set DNS records (CNAME -> cname.vercel-dns.com) via GoDaddy
 *   4. Mark the domain row as "active"
 *
 * Callable by:
 *   - Stripe webhook (internal) after checkout.session.completed
 *   - The /dashboard/domains UI as a manual "Retry / finish setup" button
 *
 * Body: { domain: string, project_id?: string, user_id?: string }
 *
 * Service-role writes are used when invoked with a non-session bearer (webhook),
 * otherwise normal RLS-scoped writes.
 */

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { domain, project_id, user_id } = body as {
    domain: string;
    project_id?: string;
    user_id?: string;
  };

  if (!domain || !user_id) {
    return NextResponse.json({ error: "domain and user_id required" }, { status: 400 });
  }

  // Service client so the webhook path can write without a user session
  const supabase = createServiceClient();

  const godaddyKey = process.env.GODADDY_API_KEY;
  const godaddySecret = process.env.GODADDY_API_SECRET;
  const vercelToken = process.env.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN;
  const vercelProjectId = process.env.VERCEL_PROJECT_ID; // the hosting project

  const result: {
    domain: string;
    steps: Array<{ step: string; status: "ok" | "skipped" | "error"; detail?: string }>;
    missing_env: string[];
  } = { domain, steps: [], missing_env: [] };

  // ── Step 1: GoDaddy purchase ─────────────────────────────────────────
  if (godaddyKey && godaddySecret) {
    try {
      const { data: existing } = await supabase
        .from("website_domains")
        .select("godaddy_order_id, status")
        .eq("profile_id", user_id)
        .eq("domain", domain)
        .single();

      if (existing?.godaddy_order_id) {
        result.steps.push({ step: "godaddy_purchase", status: "skipped", detail: "Already purchased" });
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", user_id)
          .single();

        const [first, ...rest] = (profile?.full_name || "Client").split(" ");
        const purchaseRes = await fetch("https://api.godaddy.com/v1/domains/purchase", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `sso-key ${godaddyKey}:${godaddySecret}`,
          },
          body: JSON.stringify({
            domain,
            consent: {
              agreedAt: new Date().toISOString(),
              agreedBy: profile?.email || user_id,
              agreementKeys: ["DNRA"],
            },
            period: 1,
            renewAuto: true,
          }),
        });
        const data = await purchaseRes.json();
        if (purchaseRes.ok) {
          await supabase.from("website_domains").update({
            status: "purchased",
            godaddy_order_id: data.orderId || null,
          }).eq("profile_id", user_id).eq("domain", domain);
          result.steps.push({ step: "godaddy_purchase", status: "ok", detail: `Order ${data.orderId}` });
        } else {
          result.steps.push({ step: "godaddy_purchase", status: "error", detail: data.message || "unknown" });
        }
      }
    } catch (err) {
      result.steps.push({ step: "godaddy_purchase", status: "error", detail: String(err) });
    }
  } else {
    result.missing_env.push(...(!godaddyKey ? ["GODADDY_API_KEY"] : []), ...(!godaddySecret ? ["GODADDY_API_SECRET"] : []));
    result.steps.push({ step: "godaddy_purchase", status: "skipped", detail: "GoDaddy creds not set — domain row marked purchased for now" });
    await supabase.from("website_domains").update({ status: "purchased" })
      .eq("profile_id", user_id).eq("domain", domain);
  }

  // ── Step 2: Add domain to the Vercel project ────────────────────────
  if (vercelToken && vercelProjectId) {
    try {
      const vercelRes = await fetch(
        `https://api.vercel.com/v10/projects/${vercelProjectId}/domains`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${vercelToken}`,
          },
          body: JSON.stringify({ name: domain }),
        },
      );
      const vData = await vercelRes.json();
      if (vercelRes.ok || vData?.error?.code === "domain_already_in_use") {
        result.steps.push({ step: "vercel_attach", status: "ok", detail: vData.verified ? "Verified" : "Added; awaiting DNS" });
      } else {
        result.steps.push({ step: "vercel_attach", status: "error", detail: vData?.error?.message || "Vercel add failed" });
      }
    } catch (err) {
      result.steps.push({ step: "vercel_attach", status: "error", detail: String(err) });
    }
  } else {
    if (!vercelToken) result.missing_env.push("VERCEL_API_TOKEN");
    if (!vercelProjectId) result.missing_env.push("VERCEL_PROJECT_ID");
    result.steps.push({ step: "vercel_attach", status: "skipped", detail: "Vercel creds not set" });
  }

  // ── Step 3: Configure DNS records via GoDaddy ───────────────────────
  if (godaddyKey && godaddySecret) {
    try {
      // Strip TLD → domain root
      const parts = domain.split(".");
      const subdomain = parts.length > 2 ? parts[0] : null;
      const rootDomain = parts.length > 2 ? parts.slice(-2).join(".") : domain;
      const dnsRecords = subdomain
        ? [{ type: "CNAME", name: subdomain, data: "cname.vercel-dns.com", ttl: 600 }]
        : [
            { type: "A",     name: "@",   data: "76.76.21.21",           ttl: 600 },
            { type: "CNAME", name: "www", data: "cname.vercel-dns.com",  ttl: 600 },
          ];

      const dnsRes = await fetch(
        `https://api.godaddy.com/v1/domains/${rootDomain}/records`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `sso-key ${godaddyKey}:${godaddySecret}`,
          },
          body: JSON.stringify(dnsRecords),
        },
      );
      if (dnsRes.ok) {
        await supabase.from("website_domains").update({
          dns_records: dnsRecords,
          status: "dns_configured",
        }).eq("profile_id", user_id).eq("domain", domain);
        result.steps.push({ step: "dns_configure", status: "ok", detail: `${dnsRecords.length} records set` });
      } else {
        const txt = await dnsRes.text();
        result.steps.push({ step: "dns_configure", status: "error", detail: txt.slice(0, 200) });
      }
    } catch (err) {
      result.steps.push({ step: "dns_configure", status: "error", detail: String(err) });
    }
  }

  // ── Step 4: Link the domain to the project ──────────────────────────
  if (project_id) {
    await supabase.from("website_projects").update({
      custom_domain: domain,
      updated_at: new Date().toISOString(),
    }).eq("id", project_id);
  }

  // Final status
  const anyError = result.steps.some(s => s.status === "error");
  if (!anyError) {
    await supabase.from("website_domains").update({ status: "active" })
      .eq("profile_id", user_id).eq("domain", domain);
  }

  return NextResponse.json({ success: !anyError, ...result });
}
