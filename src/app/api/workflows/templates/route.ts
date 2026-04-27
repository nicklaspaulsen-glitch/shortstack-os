/**
 * Workflow template gallery — `GET /api/workflows/templates`
 *
 * Returns the in-source template registry (no DB read needed). The caller
 * can filter client-side by category/vertical. Authed because the gallery
 * is dashboard-only — public users don't browse templates.
 */
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { TEMPLATES, listTemplates, type TemplateCategory } from "@/lib/workflows/templates";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const categoryRaw = searchParams.get("category") || undefined;
  const vertical = searchParams.get("vertical") || undefined;
  const validCategories: TemplateCategory[] = [
    "sales",
    "onboarding",
    "retention",
    "recovery",
    "social",
    "support",
    "marketing",
  ];
  const category =
    categoryRaw && validCategories.includes(categoryRaw as TemplateCategory)
      ? (categoryRaw as TemplateCategory)
      : undefined;
  const filtered = listTemplates({ category, vertical });

  // Tell the client which templates are already installed for them so the UI
  // can show "Installed" instead of "Install".
  const ids = TEMPLATES.map((t) => t.id);
  const { data: installed } = await supabase
    .from("workflows")
    .select("id, installed_from_template_id, active")
    .eq("user_id", user.id)
    .in("installed_from_template_id", ids);

  const installedById = new Map(
    (installed || []).map((row: { id: string; installed_from_template_id: string | null; active: boolean }) => [
      row.installed_from_template_id ?? "",
      { workflow_id: row.id, active: row.active },
    ]),
  );

  return NextResponse.json({
    templates: filtered.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      version: t.version,
      trigger_type: t.trigger.type,
      step_count: t.steps.length,
      required_integrations: t.required_integrations,
      vertical_tags: t.vertical_tags,
      estimated_setup_minutes: t.estimated_setup_minutes,
      installed: installedById.has(t.id),
      installed_workflow_id: installedById.get(t.id)?.workflow_id ?? null,
      installed_active: installedById.get(t.id)?.active ?? null,
    })),
  });
}
