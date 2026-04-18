import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Deploy a Claude-generated website to Vercel as a static site.
 *
 * Body: { project_id: string }
 *
 * If VERCEL_API_TOKEN is set, deploys via Vercel REST API v13.
 * Otherwise returns a simulated deployment URL.
 */

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { project_id } = await request.json();
  if (!project_id) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  const { data: project } = await supabase
    .from("website_projects")
    .select("*")
    .eq("id", project_id)
    .single();

  if (!project || project.profile_id !== user.id) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 });
  }

  const files = (project.generated_files || {}) as Record<string, string>;
  if (!files["index.html"]) {
    return NextResponse.json({ error: "No generated files — generate the website first" }, { status: 400 });
  }

  const safeName = (project.name || "client-site")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50) || "client-site";

  const vercelToken = process.env.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN;
  const vercelTeamId = process.env.VERCEL_TEAM_ID;

  // ── Simulated deployment when no token ────────────────────────────────
  if (!vercelToken) {
    const stubUrl = `https://${safeName}.shortstack-preview.work`;
    await supabase.from("website_projects").update({
      status: "preview",
      vercel_url: stubUrl,
      preview_url: stubUrl,
      updated_at: new Date().toISOString(),
    }).eq("id", project_id);

    return NextResponse.json({
      success: true,
      simulated: true,
      url: stubUrl,
      project_id,
      message: "Simulated deployment — set VERCEL_API_TOKEN to deploy for real.",
    });
  }

  // ── Real Vercel deployment ────────────────────────────────────────────
  await supabase.from("website_projects").update({
    status: "deploying",
    updated_at: new Date().toISOString(),
  }).eq("id", project_id);

  try {
    const fileList = Object.entries(files).map(([file, data]) => ({
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
        name: safeName,
        files: fileList,
        projectSettings: { framework: null },
        target: "production",
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.url) {
      await supabase.from("website_projects").update({
        status: "failed",
        error_log: data.error?.message || JSON.stringify(data).slice(0, 1000),
        updated_at: new Date().toISOString(),
      }).eq("id", project_id);
      return NextResponse.json({
        error: data.error?.message || "Deployment failed",
        details: data,
      }, { status: 500 });
    }

    const deployUrl = `https://${data.url}`;
    await supabase.from("website_projects").update({
      status: "live",
      vercel_project_id: data.projectId || data.projectId || null,
      vercel_deployment_id: data.id,
      vercel_url: deployUrl,
      preview_url: deployUrl,
      updated_at: new Date().toISOString(),
    }).eq("id", project_id);

    return NextResponse.json({
      success: true,
      url: deployUrl,
      deployment_id: data.id,
      project_id,
    });
  } catch (err) {
    await supabase.from("website_projects").update({
      status: "failed",
      error_log: String(err),
      updated_at: new Date().toISOString(),
    }).eq("id", project_id);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
