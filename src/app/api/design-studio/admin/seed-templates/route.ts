/**
 * POST /api/design-studio/admin/seed-templates
 *
 * Seed the global Design Studio templates (`design_templates.is_global=true`)
 * from the in-code SEED_TEMPLATES list. Idempotent — uses ON CONFLICT
 * (name, is_global) DO NOTHING via Supabase upsert(ignoreDuplicates).
 *
 * Auth: bearer CRON_SECRET (for one-shot ops) OR a Supabase session whose
 * profile.role ∈ ('admin','founder'). Any other caller gets 401/403.
 *
 * History: replaces the in-line lazy-seed that lived in GET /templates.
 * Sonnet's round-2 fix removed the lazy seed (service-role write inside a
 * user-facing GET handler is unsafe), and Opus flagged the missing
 * onConflict constraint — both addressed in `20260427_design_studio_followup.sql`
 * + this endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { SEED_TEMPLATES } from "@/lib/design/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Auth: either CRON_SECRET bearer, OR admin/founder session.
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";
  const secretOk = cronSecret.length > 0 && bearer === cronSecret;

  if (!secretOk) {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile || !["admin", "founder"].includes(profile.role ?? "")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  // Service role bypasses RLS for the upsert — necessary because
  // is_global rows have owner_id=NULL and don't satisfy templates_insert_own.
  const service = createServiceClient();
  const rows = SEED_TEMPLATES.map((t) => ({
    is_global: true,
    category: t.category,
    name: t.name,
    doc: t.doc,
    preview_url: null,
  }));

  const { error, count } = await service
    .from("design_templates")
    .upsert(rows, { onConflict: "name,is_global", ignoreDuplicates: true, count: "exact" });

  if (error) {
    console.error("[design-studio/admin/seed-templates] upsert failed:", error);
    return NextResponse.json(
      { error: "seed failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    attempted: rows.length,
    inserted: count ?? null,
  });
}
