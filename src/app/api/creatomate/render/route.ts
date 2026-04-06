import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Creatomate — AI video/image ad generation
// Creates professional ads, social graphics, video templates
// Set CREATOMATE_API_KEY in env vars
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { template_id, modifications, output_format } = await request.json();

  const apiKey = process.env.CREATOMATE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: "Creatomate not configured. Add CREATOMATE_API_KEY to Vercel env vars.",
      setup_url: "https://creatomate.com/dashboard/api-keys",
    }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.creatomate.com/v1/renders", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id,
        modifications,
        output_format: output_format || "mp4",
      }),
    });

    const data = await res.json();

    if (data[0]?.url || data[0]?.status === "planned") {
      return NextResponse.json({
        success: true,
        render_id: data[0]?.id,
        url: data[0]?.url,
        status: data[0]?.status,
      });
    }

    return NextResponse.json({ error: data.message || "Render failed", details: data }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
