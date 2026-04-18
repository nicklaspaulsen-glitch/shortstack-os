import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Demo deployment for a website project.
 *
 * POST /api/websites/[id]/demo
 *  - Injects a tasteful "Built with ShortStack — Upgrade" watermark into the
 *    generated index.html, then deploys the modified bundle to a free demo
 *    subdomain. Sets status=preview, demo_expires_at=now()+14 days.
 *  - If VERCEL_API_TOKEN is set, uses the Vercel REST API; otherwise returns
 *    a simulated URL of the form https://demo-{slug}.shortstack.work.
 *
 * GET /api/websites/[id]/demo
 *  - Returns the current demo state (URL, expires_at, days_left, expired).
 */

function slugify(name: string) {
  return (name || "client-site")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50) || "client-site";
}

/**
 * Inject the ShortStack watermark just before </body>. Idempotent — if the
 * watermark is already present it is replaced rather than duplicated.
 */
function injectWatermark(html: string, slug: string): string {
  const watermark = `<div id="ss-watermark" style="position:fixed;bottom:12px;right:12px;background:rgba(0,0,0,0.85);color:gold;font-size:11px;padding:6px 12px;border-radius:8px;font-family:system-ui,-apple-system,sans-serif;z-index:9999;backdrop-filter:blur(10px);box-shadow:0 4px 12px rgba(0,0,0,0.2)">✨ Built with ShortStack · <a href="https://app.shortstack.work/signup?ref=demo&project=${encodeURIComponent(slug)}" style="color:#fff;text-decoration:underline" target="_blank" rel="noopener">Upgrade</a></div>`;

  // Strip existing watermark first to keep this idempotent
  const stripped = html.replace(/<div id="ss-watermark"[\s\S]*?<\/div>/i, "");

  if (/<\/body\s*>/i.test(stripped)) {
    return stripped.replace(/<\/body\s*>/i, `${watermark}\n</body>`);
  }
  // Fallback: append at end
  return stripped + watermark;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = params.id;
  const { data: project } = await supabase
    .from("website_projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project || project.profile_id !== user.id) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 });
  }

  const files = (project.generated_files || {}) as Record<string, string>;
  if (!files["index.html"]) {
    return NextResponse.json({ error: "No generated files — generate the website first" }, { status: 400 });
  }

  const slug = slugify(project.name);
  const watermarkEnabled = project.watermark_enabled !== false;

  // Inject watermark when enabled (default for demo)
  const demoFiles: Record<string, string> = { ...files };
  if (watermarkEnabled) {
    demoFiles["index.html"] = injectWatermark(files["index.html"], slug);
  }

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const deployedAt = new Date().toISOString();

  const vercelToken = process.env.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN;
  const vercelTeamId = process.env.VERCEL_TEAM_ID;

  // ── Simulated demo deployment ─────────────────────────────────────────
  if (!vercelToken) {
    const stubUrl = `https://demo-${slug}.shortstack.work`;
    await supabase.from("website_projects").update({
      status: "preview",
      preview_url: stubUrl,
      vercel_url: stubUrl,
      demo_expires_at: expiresAt,
      demo_deployed_at: deployedAt,
      watermark_enabled: true,
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);

    return NextResponse.json({
      success: true,
      simulated: true,
      url: stubUrl,
      project_id: projectId,
      expires_at: expiresAt,
      days_left: 14,
      message: "Simulated demo deployment — set VERCEL_API_TOKEN for a real preview URL.",
    });
  }

  // ── Real Vercel deployment with watermark ─────────────────────────────
  await supabase.from("website_projects").update({
    status: "deploying",
    updated_at: new Date().toISOString(),
  }).eq("id", projectId);

  try {
    const fileList = Object.entries(demoFiles).map(([file, data]) => ({
      file,
      data: Buffer.from(data).toString("base64"),
      encoding: "base64" as const,
    }));

    const qs = vercelTeamId ? `?teamId=${encodeURIComponent(vercelTeamId)}` : "";
    const res = await fetch(`https://api.vercel.com/v13/deployments${qs}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `demo-${slug}`,
        files: fileList,
        projectSettings: { framework: null },
        target: "preview",
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.url) {
      await supabase.from("website_projects").update({
        status: "failed",
        error_log: data.error?.message || JSON.stringify(data).slice(0, 1000),
        updated_at: new Date().toISOString(),
      }).eq("id", projectId);
      return NextResponse.json({
        error: data.error?.message || "Demo deployment failed",
        details: data,
      }, { status: 500 });
    }

    const demoUrl = `https://${data.url}`;
    await supabase.from("website_projects").update({
      status: "preview",
      vercel_project_id: data.projectId || null,
      vercel_deployment_id: data.id,
      vercel_url: demoUrl,
      preview_url: demoUrl,
      demo_expires_at: expiresAt,
      demo_deployed_at: deployedAt,
      watermark_enabled: true,
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);

    return NextResponse.json({
      success: true,
      url: demoUrl,
      deployment_id: data.id,
      project_id: projectId,
      expires_at: expiresAt,
      days_left: 14,
    });
  } catch (err) {
    await supabase.from("website_projects").update({
      status: "failed",
      error_log: String(err),
      updated_at: new Date().toISOString(),
    }).eq("id", projectId);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("website_projects")
    .select("id, profile_id, status, preview_url, demo_expires_at, demo_deployed_at, watermark_enabled")
    .eq("id", params.id)
    .single();

  if (!project || project.profile_id !== user.id) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 });
  }

  const expiresAt = project.demo_expires_at ? new Date(project.demo_expires_at).getTime() : null;
  const now = Date.now();
  const expired = expiresAt !== null && expiresAt < now;
  const daysLeft = expiresAt === null
    ? null
    : Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)));

  // Auto-mark archived if demo expired and not upgraded to live
  if (expired && project.status === "preview") {
    await supabase.from("website_projects").update({
      status: "archived",
      updated_at: new Date().toISOString(),
    }).eq("id", project.id);
  }

  return NextResponse.json({
    success: true,
    demo: {
      url: project.preview_url,
      status: expired ? "expired" : project.status,
      expires_at: project.demo_expires_at,
      deployed_at: project.demo_deployed_at,
      days_left: daysLeft,
      expired,
      watermark_enabled: project.watermark_enabled !== false,
    },
  });
}
