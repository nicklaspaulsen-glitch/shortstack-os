import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * AI Studio — Unified routing endpoint.
 *
 * POST /api/ai-studio  { tool: "transcribe" | "image-gen" | "remove-bg" | "upscale" | ... , ...params }
 *
 * Routes the request to the matching AI tool handler.
 * This is a convenience wrapper — each tool also has its own direct route.
 */

const TOOL_ROUTES: Record<string, string> = {
  transcribe:     "/api/ai/transcribe",
  upscale:        "/api/ai/upscale",
  "remove-bg":    "/api/ai/remove-bg",
  "image-gen":    "/api/ai-studio/image-gen",
  "img-to-video": "/api/ai/img-to-video",
  "music-gen":    "/api/ai/music-gen",
  "voice-clone":  "/api/ai/voice-clone",
  "train-lora":   "/api/ai/train-lora",
  "batch-gen":    "/api/ai/batch-generate",
};

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Provide { tool: string, ...params }" },
      { status: 400 },
    );
  }

  const tool = typeof body.tool === "string" ? body.tool : null;
  if (!tool) {
    return NextResponse.json(
      {
        error: "Missing 'tool' field",
        available_tools: Object.keys(TOOL_ROUTES),
      },
      { status: 400 },
    );
  }

  const targetPath = TOOL_ROUTES[tool];
  if (!targetPath) {
    return NextResponse.json(
      {
        error: `Unknown tool '${tool}'`,
        available_tools: Object.keys(TOOL_ROUTES),
      },
      { status: 400 },
    );
  }

  // Forward the request internally by constructing the full URL and fetching it.
  // We pass the original cookies so auth carries through.
  const origin = request.nextUrl.origin;
  const targetUrl = `${origin}${targetPath}`;

  // Strip 'tool' from the forwarded payload
  const { tool: _tool, ...rest } = body;

  try {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    // Forward cookies for auth
    const cookie = request.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(rest),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to route to '${tool}': ${String(err)}` },
      { status: 500 },
    );
  }
}

/** GET — return available tools and their status */
export async function GET() {
  const tools = Object.entries(TOOL_ROUTES).map(([id, path]) => ({
    id,
    path,
    direct_url: `/api/ai-studio/${id}`,
  }));

  return NextResponse.json({
    tools,
    usage: "POST /api/ai-studio with { tool: '<tool-id>', ...params }",
  });
}
