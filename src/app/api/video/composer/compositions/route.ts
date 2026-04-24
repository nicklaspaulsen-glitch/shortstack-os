import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Default starter HTML for a brand-new hyperframes composition.
// Mirrors node_modules/hyperframes/dist/templates/blank/index.html but with
// sensible placeholder values so a preview can run immediately.
const DEFAULT_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        margin: 0; width: 1920px; height: 1080px;
        overflow: hidden;
        background: linear-gradient(135deg, #0f172a, #1e293b);
        font-family: system-ui, -apple-system, sans-serif;
      }
      .hero {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        flex-direction: column; color: #fff;
      }
      .title { font-size: 96px; font-weight: 800; letter-spacing: -2px; }
      .subtitle { font-size: 36px; opacity: 0.7; margin-top: 24px; }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="10"
      data-width="1920"
      data-height="1080"
    >
      <div id="hero" class="clip hero" data-start="0" data-duration="10" data-track-index="0">
        <div class="title" id="title">Your Title</div>
        <div class="subtitle" id="subtitle">Edit this composition in the composer</div>
      </div>
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      tl.from("#title", { opacity: 0, y: -50, duration: 1 }, 0);
      tl.from("#subtitle", { opacity: 0, y: 50, duration: 1 }, 0.5);
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;

// GET /api/video/composer/compositions?project_id=<uuid>
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = request.nextUrl.searchParams.get("project_id");

  let query = supabase
    .from("hyperframes_compositions")
    .select(
      "id, title, duration_seconds, fps, width, height, project_id, metadata, created_by, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ compositions: data ?? [] });
}

// POST /api/video/composer/compositions
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // allow empty body - defaults apply
  }

  const title = (body.title as string) || "Untitled composition";
  const htmlSource = (body.html_source as string) || DEFAULT_HTML;
  const projectId = (body.project_id as string | null) || null;
  const durationSeconds = Number(body.duration_seconds ?? 10);
  const fps = Number(body.fps ?? 30);
  const width = Number(body.width ?? 1920);
  const height = Number(body.height ?? 1080);
  const metadata = (body.metadata as Record<string, unknown>) || {};

  const { data, error } = await supabase
    .from("hyperframes_compositions")
    .insert({
      title,
      html_source: htmlSource,
      project_id: projectId,
      duration_seconds: durationSeconds,
      fps,
      width,
      height,
      metadata,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ composition: data }, { status: 201 });
}
