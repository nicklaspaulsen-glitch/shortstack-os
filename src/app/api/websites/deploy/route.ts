import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Deploy a generated website to Vercel as a static site
// Creates a demo URL that clients can preview before buying
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { html, project_name, client_id } = await request.json();
  if (!html) return NextResponse.json({ error: "HTML content required" }, { status: 400 });

  const vercelToken = process.env.VERCEL_TOKEN;
  if (!vercelToken) {
    // If no Vercel token, just return the HTML as a data URL for preview
    return NextResponse.json({
      success: true,
      preview_only: true,
      message: "Vercel token not configured. Preview available but not deployed.",
    });
  }

  const safeName = (project_name || "client-site").toLowerCase().replace(/[^a-z0-9-]/g, "-").substring(0, 50);

  try {
    // Deploy using Vercel API v13 file upload
    const res = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: safeName,
        files: [
          {
            file: "index.html",
            data: Buffer.from(html).toString("base64"),
            encoding: "base64",
          },
        ],
        projectSettings: {
          framework: null,
        },
        target: "production",
      }),
    });

    const data = await res.json();

    if (data.url) {
      const deployUrl = `https://${data.url}`;

      // Log
      await supabase.from("trinity_log").insert({
        action_type: "website",
        description: `Website deployed: ${safeName} → ${deployUrl}`,
        client_id: client_id || null,
        status: "completed",
        result: { url: deployUrl, deployment_id: data.id, name: safeName },
      });

      return NextResponse.json({
        success: true,
        url: deployUrl,
        deployment_id: data.id,
        project_name: safeName,
      });
    }

    return NextResponse.json({ error: data.error?.message || "Deployment failed", details: data }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
