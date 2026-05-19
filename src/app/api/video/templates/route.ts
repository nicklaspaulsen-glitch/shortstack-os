/**
 * GET /api/video/templates
 *
 * Returns the list of available HTML video templates.
 * Each item includes metadata for rendering the picker UI.
 *
 * Response:
 *   { templates: TemplateMetadata[] }
 *
 * TemplateMetadata:
 *   id, name, description, category, aspectRatio,
 *   durationSeconds, previewGradient, defaultProps
 */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { templateList } from "@/lib/video-templates";

export async function GET() {
  // Auth gate — templates are user-facing but we want them scoped to
  // authenticated sessions to avoid public enumeration.
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Strip the render function — it can't be serialised to JSON and
  // should never leave the server boundary.
  const templates = templateList.map(({ render: _render, ...meta }) => meta);

  return NextResponse.json({ templates });
}
