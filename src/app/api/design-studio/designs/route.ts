/**
 * Design Studio — /api/design-studio/designs
 * GET  → list designs for the authenticated user
 * POST → create a new design
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/security/require-owned-client";
import { makeEmptyDoc } from "@/lib/design/store";
import type { SizePreset } from "@/lib/design/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await requireOwnedClient(supabase, user.id);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  let query = supabase
    .from("designs")
    .select("id, title, width, height, thumbnail_url, created_at, updated_at", { count: "exact" })
    .eq("user_id", ctx.ownerId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[design-studio/designs] list error", error);
    return NextResponse.json({ error: "Failed to list designs" }, { status: 500 });
  }

  return NextResponse.json({
    data,
    meta: { total: count ?? 0, limit, offset },
  });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await requireOwnedClient(supabase, user.id);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    title?: string;
    width?: number;
    height?: number;
    client_id?: string;
    from_template_id?: string;
    preset?: SizePreset;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const width = body.width ?? body.preset?.width ?? 1080;
  const height = body.height ?? body.preset?.height ?? 1080;
  const title = body.title ?? body.preset?.label ?? "Untitled";

  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return NextResponse.json({ error: "width and height must be positive integers" }, { status: 400 });
  }

  let doc = makeEmptyDoc(width, height);

  // If cloning from a template, fetch the template doc
  if (body.from_template_id) {
    const { data: tpl } = await supabase
      .from("design_templates")
      .select("doc")
      .eq("id", body.from_template_id)
      .single();
    if (tpl?.doc) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { cloneTemplateDoc } = await import("@/lib/design/templates");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      doc = cloneTemplateDoc(tpl.doc as any);
    }
  }

  // Validate client ownership if provided
  if (body.client_id) {
    const clientCtx = await requireOwnedClient(supabase, user.id, body.client_id);
    if (!clientCtx) return NextResponse.json({ error: "Forbidden: client not owned" }, { status: 403 });
  }

  const { data: design, error } = await supabase
    .from("designs")
    .insert({
      user_id: ctx.ownerId,
      client_id: body.client_id ?? null,
      title,
      width,
      height,
      doc,
    })
    .select()
    .single();

  if (error) {
    console.error("[design-studio/designs] insert error", error);
    return NextResponse.json({ error: "Failed to create design" }, { status: 500 });
  }

  return NextResponse.json({ data: design }, { status: 201 });
}
