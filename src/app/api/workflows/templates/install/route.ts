/**
 * Install a workflow template — `POST /api/workflows/templates/install`
 *
 * Body: `{ template_id: string, customize?: { name?: string, active?: boolean } }`
 *
 * Creates two rows:
 *   - `workflows`        — { name, nodes, installed_from_template_id, active }
 *   - `workflow_triggers`— { workflow_id, trigger_type, config }
 *
 * Re-installing the same template upserts onto the existing workflow row
 * (matched by `(user_id, installed_from_template_id)`) so the user can
 * re-pull the latest copy of a template after the registry version bumps.
 *
 * Returns the new workflow id + a short summary.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  getTemplateById,
  templateStepsToNodes,
} from "@/lib/workflows/templates";

export const dynamic = "force-dynamic";

interface InstallBody {
  template_id?: unknown;
  customize?: { name?: unknown; active?: unknown };
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: InstallBody = {};
  try {
    body = (await request.json()) as InstallBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const templateId =
    typeof body.template_id === "string" ? body.template_id : "";
  if (!templateId) {
    return NextResponse.json({ error: "template_id required" }, { status: 400 });
  }
  const template = getTemplateById(templateId);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const customName =
    body.customize?.name && typeof body.customize.name === "string"
      ? body.customize.name.trim()
      : "";
  const name = customName || template.name;
  const active =
    typeof body.customize?.active === "boolean" ? body.customize.active : true;

  const nodes = templateStepsToNodes(template.steps);

  // Look for an existing install of this template for this user; we want
  // re-install to overwrite (not duplicate). Matching by template id, not
  // by name, so renaming the workflow doesn't break the upgrade path.
  const { data: existing } = await supabase
    .from("workflows")
    .select("id")
    .eq("user_id", user.id)
    .eq("installed_from_template_id", templateId)
    .maybeSingle();

  let workflowId: string;
  if (existing?.id) {
    const { error } = await supabase
      .from("workflows")
      .update({
        name,
        description: template.description,
        nodes,
        edges: [],
        active,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    workflowId = existing.id;
  } else {
    // Find a unique name (the (user_id, name) uniqueness constraint will
    // otherwise reject re-installs after a rename).
    let candidateName = name;
    let suffix = 0;
    while (true) {
      const { data: clash } = await supabase
        .from("workflows")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", candidateName)
        .maybeSingle();
      if (!clash) break;
      suffix += 1;
      candidateName = `${name} (${suffix})`;
      if (suffix > 50) {
        return NextResponse.json(
          { error: "could not find a unique name; try renaming existing" },
          { status: 409 },
        );
      }
    }

    const { data: created, error } = await supabase
      .from("workflows")
      .insert({
        user_id: user.id,
        name: candidateName,
        description: template.description,
        nodes,
        edges: [],
        active,
        installed_from_template_id: templateId,
      })
      .select("id")
      .single();
    if (error || !created) {
      return NextResponse.json(
        { error: error?.message || "create failed" },
        { status: 500 },
      );
    }
    workflowId = created.id;
  }

  // Replace any existing trigger rows for this workflow with the new spec.
  await supabase.from("workflow_triggers").delete().eq("workflow_id", workflowId);
  const { error: trigErr } = await supabase.from("workflow_triggers").insert({
    workflow_id: workflowId,
    user_id: user.id,
    trigger_type: template.trigger.type,
    config: template.trigger.config ?? {},
    is_active: active,
  });
  if (trigErr) {
    return NextResponse.json({ error: trigErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    workflow_id: workflowId,
    template: {
      id: template.id,
      name: template.name,
      step_count: template.steps.length,
      trigger_type: template.trigger.type,
    },
  });
}
