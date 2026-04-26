/**
 * Design Studio — /api/design-studio/templates
 * GET  → list templates (global + user-owned)
 * POST → clone a template into a new design
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/security/require-owned-client";
import { cloneTemplateDoc } from "@/lib/design/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await requireOwnedClient(supabase, user.id);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const category = url.searchParams.get("category");

  // Global templates are visible to everyone; owned templates visible to owner
  let query = supabase
    .from("design_templates")
    .select("id, category, name, preview_url, is_global, owner_id, created_at")
    .or(`is_global.eq.true,owner_id.eq.${ctx.ownerId}`)
    .order("is_global", { ascending: false })
    .order("created_at", { ascending: true });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[design-studio/templates] list error", error);
    return NextResponse.json({ error: "Failed to list templates" }, { status: 500 });
  }

  // Global templates are seeded via migration (add_design_studio_seed_templates).
  // No lazy seeding here — avoids service-role writes in user GET handlers.
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  // Clone a template → new design
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await requireOwnedClient(supabase, user.id);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { template_id: string; title?: string; client_id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.template_id) {
    return NextResponse.json({ error: "template_id is required" }, { status: 400 });
  }

  // Fetch template (RLS ensures visibility)
  const { data: tpl } = await supabase
    .from("design_templates")
    .select("*")
    .eq("id", body.template_id)
    .single();

  if (!tpl) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Validate client if provided
  if (body.client_id) {
    const clientCtx = await requireOwnedClient(supabase, user.id, body.client_id);
    if (!clientCtx) return NextResponse.json({ error: "Forbidden: client not owned" }, { status: 403 });
  }

  // Infer canvas size from first page's layer bounding box — or use tpl dimensions
  // Templates store their size in category metadata; fall back to 1080x1080
  const SIZES: Record<string, { width: number; height: number }> = {
    "Instagram": { width: 1080, height: 1080 },
    "YouTube": { width: 1280, height: 720 },
    "Facebook": { width: 1200, height: 630 },
    "LinkedIn": { width: 1584, height: 396 },
    "Twitter/X": { width: 1600, height: 900 },
    "General": { width: 1080, height: 1080 },
  };

  // Check if name implies a story (1080×1920)
  const isStory = tpl.name.toLowerCase().includes("story");
  const baseSize = SIZES[tpl.category] ?? { width: 1080, height: 1080 };
  const canvasSize = isStory ? { width: 1080, height: 1920 } : baseSize;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clonedDoc = cloneTemplateDoc(tpl.doc as any);

  const { data: design, error } = await supabase
    .from("designs")
    .insert({
      user_id: ctx.ownerId,
      client_id: body.client_id ?? null,
      title: body.title ?? tpl.name,
      width: canvasSize.width,
      height: canvasSize.height,
      doc: clonedDoc,
    })
    .select()
    .single();

  if (error) {
    console.error("[design-studio/templates] clone error", error);
    return NextResponse.json({ error: "Failed to clone template" }, { status: 500 });
  }

  return NextResponse.json({ data: design }, { status: 201 });
}

// Seeding moved to /api/design-studio/admin/seed-templates (founder-gated, idempotent).
// Run once after a fresh deploy or after adding new templates to SEED_TEMPLATES.
