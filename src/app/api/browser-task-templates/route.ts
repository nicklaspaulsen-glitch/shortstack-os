/**
 * Browser Worker — task templates CRUD.
 *
 *   GET  /api/browser-task-templates          — list owner's templates
 *                                                (auto-seeds starter templates
 *                                                 on first call if empty)
 *   POST /api/browser-task-templates          — create new custom template
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { seedStarterTemplates } from "@/lib/browser-worker/starter-templates";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set(["scraping", "posting", "data_entry", "monitoring"]);

interface CreateTemplateBody {
  name?: unknown;
  description?: unknown;
  goal_template?: unknown;
  start_url?: unknown;
  default_max_steps?: unknown;
  category?: unknown;
  variables?: unknown;
}

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) ?? user.id;

  // Auto-seed on first list — non-blocking failure (just log).
  await seedStarterTemplates(ownerId);

  const { data, error } = await supabase
    .from("browser_task_templates")
    .select("*")
    .eq("agency_owner_id", ownerId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) ?? user.id;

  let body: CreateTemplateBody;
  try {
    body = (await request.json()) as CreateTemplateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof body.goal_template !== "string" || !body.goal_template.trim()) {
    return NextResponse.json({ error: "goal_template is required" }, { status: 400 });
  }

  const category =
    typeof body.category === "string" && VALID_CATEGORIES.has(body.category)
      ? body.category
      : null;

  const variables = Array.isArray(body.variables) ? body.variables : [];

  const { data: created, error } = await supabase
    .from("browser_task_templates")
    .insert({
      agency_owner_id: ownerId,
      name: body.name.trim(),
      description: typeof body.description === "string" ? body.description : null,
      goal_template: body.goal_template.trim(),
      start_url: typeof body.start_url === "string" ? body.start_url : null,
      default_max_steps:
        typeof body.default_max_steps === "number" && body.default_max_steps > 0
          ? body.default_max_steps
          : 30,
      category,
      variables,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: created }, { status: 201 });
}
