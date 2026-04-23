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
 * Website sub-task: create a `website_projects` row pre-configured with
 * the domain as `custom_domain`, seeded with a starter template.
 *
 * This stops short of actually deploying to Vercel + attaching the domain
 * (the existing `/api/websites/domains/auto-configure` flow does that once
 * GoDaddy holds the domain). Here we just prep the slot so the user can
 * open the builder immediately.
 */

function starterIndex(domain: string): string {
  const brand = rootDomainOf(domain).replace(/\..+$/, "");
  const display = brand.charAt(0).toUpperCase() + brand.slice(1);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${display} — Coming Soon</title>
<style>
  :root { color-scheme: light dark; }
  html,body { margin:0; padding:0; font-family: -apple-system, system-ui, sans-serif; }
  main { min-height:100vh; display:grid; place-items:center; background: radial-gradient(ellipse at top, #1a1a2e, #0f0f1a); color: #f4f4f5; padding: 2rem; }
  .card { max-width: 560px; text-align: center; }
  h1 { font-size: clamp(2.2rem, 6vw, 3.6rem); margin: 0 0 .8rem; letter-spacing:-0.02em; }
  p { opacity: .75; font-size: 1.05rem; line-height: 1.6; }
</style>
</head>
<body>
<main>
  <div class="card">
    <h1>${display}</h1>
    <p>A new chapter is being written at <strong>${domain}</strong>. Check back soon.</p>
  </div>
</main>
</body>
</html>`;
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

  await setServiceStatus(jobId, "website", "in_progress");

  try {
    const svc = createServiceClient();

    // Don't create a duplicate if the user already has a website tied to
    // this domain — the Hub flow may run twice (retry).
    const { data: existing } = await svc
      .from("website_projects")
      .select("id, vercel_url")
      .eq("profile_id", ownerId)
      .eq("custom_domain", domain)
      .maybeSingle();

    let websiteId = existing?.id as string | undefined;
    const root = rootDomainOf(domain);

    if (!websiteId) {
      const { data: created, error } = await svc
        .from("website_projects")
        .insert({
          profile_id: ownerId,
          name: root,
          custom_domain: domain,
          status: "draft",
          template_style: "coming-soon",
          generated_files: {
            "index.html": starterIndex(domain),
          },
          business_info: {
            source: "domain_hub_provision",
            created_via: "Domain-as-Hub one-click flow",
          },
        })
        .select("id")
        .single();

      if (error || !created) {
        await setServiceFailed(jobId, "website", error?.message || "Insert failed");
        return NextResponse.json({ ok: false, error: error?.message }, { status: 500 });
      }
      websiteId = created.id;
    }

    await setServiceDone(jobId, "website", {
      website_id: websiteId,
      custom_domain: domain,
      template: "coming-soon",
      editor_url: `/dashboard/websites/${websiteId}`,
      public_url: `https://${domain}`,
    });

    return NextResponse.json({ ok: true, website_id: websiteId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setServiceFailed(jobId, "website", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
