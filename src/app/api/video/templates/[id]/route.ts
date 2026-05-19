/**
 * POST /api/video/templates/[id]
 *
 * Renders a video template to a full HTML string that can be:
 *   a) Displayed as an iframe preview in the browser
 *   b) Passed to a self-hosted worker that records it frame-by-frame via
 *      headless Chromium + FFmpeg and returns an MP4
 *
 * Request body (JSON) — all fields optional, merged over template defaultProps:
 *   Any props accepted by the template identified by [id].
 *
 * Response:
 *   { success: true, html: string, meta: { id, name, durationSeconds, aspectRatio } }
 *   { success: false, error: string }
 *
 * GET /api/video/templates/[id]
 *
 * Returns template metadata (same shape as the list endpoint item).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getTemplate, renderTemplate } from "@/lib/video-templates";

// ---------------------------------------------------------------------------
// GET — fetch template metadata
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const template = getTemplate(params.id);
  if (!template) {
    return NextResponse.json({ error: `Template '${params.id}' not found` }, { status: 404 });
  }

  // Strip render function before serialising
  const { render: _render, ...meta } = template;
  return NextResponse.json({ template: meta });
}

// ---------------------------------------------------------------------------
// POST — render template → HTML
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Parse optional override props
  let overrides: Record<string, unknown> = {};
  try {
    const body = await req.text();
    if (body.trim()) {
      overrides = JSON.parse(body) as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const result = renderTemplate(params.id, overrides);
  if (!result) {
    return NextResponse.json(
      { success: false, error: `Template '${params.id}' not found` },
      { status: 404 },
    );
  }

  const { html, template } = result;

  return NextResponse.json({
    success: true,
    html,
    meta: {
      id: template.id,
      name: template.name,
      durationSeconds: template.durationSeconds,
      aspectRatio: template.aspectRatio,
    },
  });
}
