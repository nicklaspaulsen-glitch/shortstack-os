/**
 * GET /api/cron/scope-creep  (Vercel cron, hourly)
 *
 * Scans recent messages + new files for every active project against
 * that project's brief, flags potential scope creep via Claude, writes
 * results to `scope_creep_flags`.
 *
 * Silent on missing upstream tables — team_chat / portal_messages /
 * client_files may not yet be on main.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendCached, MODEL_SONNET } from "@/lib/ai/claude-client";
import { safeJsonParse } from "@/lib/ai/claude-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface Signal {
  kind: "message" | "file";
  id: string;
  table: string;
  text: string;
  created_at: string;
}

interface Flag {
  flag_type: string;
  description: string;
  severity: "low" | "medium" | "high";
  source_index: number; // index into signals[]
}

async function fetchRecentMessages(
  supabase: SupabaseClient,
  projectId: string,
  sinceIso: string,
): Promise<Signal[]> {
  const out: Signal[] = [];
  // Try portal_messages (scoped by project_id if schema has it, otherwise skip).
  try {
    const { data } = await supabase
      .from("portal_messages")
      .select("id, body, created_at, project_id")
      .eq("project_id", projectId)
      .gte("created_at", sinceIso)
      .limit(50);
    for (const m of data ?? []) {
      out.push({
        kind: "message",
        id: m.id as string,
        table: "portal_messages",
        text: (m.body as string | null) || "",
        created_at: m.created_at as string,
      });
    }
  } catch {
    // table missing, skip
  }
  return out;
}

async function fetchRecentFiles(
  supabase: SupabaseClient,
  projectId: string,
  sinceIso: string,
): Promise<Signal[]> {
  const out: Signal[] = [];
  try {
    const { data } = await supabase
      .from("client_files")
      .select("id, name, description, created_at, project_id")
      .eq("project_id", projectId)
      .gte("created_at", sinceIso)
      .limit(50);
    for (const f of data ?? []) {
      out.push({
        kind: "file",
        id: f.id as string,
        table: "client_files",
        text: `${(f.name as string | null) || ""} ${(f.description as string | null) || ""}`.trim(),
        created_at: f.created_at as string,
      });
    }
  } catch {
    // table missing, skip
  }
  return out;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const sinceIso = new Date(Date.now() - 3600 * 1000).toISOString(); // last hour

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, brief")
    .eq("status", "active");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let totalFlags = 0;
  let scanned = 0;

  for (const project of projects ?? []) {
    const brief = (project.brief as string | null) || "";
    if (!brief.trim()) continue;

    const messages = await fetchRecentMessages(supabase, project.id as string, sinceIso);
    const files = await fetchRecentFiles(supabase, project.id as string, sinceIso);
    const signals = [...messages, ...files].filter((s) => s.text.trim().length > 0);
    if (signals.length === 0) continue;

    scanned++;

    const signalsForPrompt = signals
      .map((s, i) => `[${i}] (${s.kind}) ${s.text.slice(0, 400)}`)
      .join("\n");

    const system = `You detect scope creep in creative-agency projects. Compare recent messages and file uploads against the original brief. Return strict JSON only, no prose, no fences.

Schema:
{"flags": [{"flag_type": string, "description": string, "severity": "low|medium|high", "source_index": number}]}

Flag ONLY genuine out-of-scope asks, unauthorized expansions, or off-brief deliverables. If nothing is off-scope, return {"flags": []}. flag_type examples: "out_of_scope_request", "timeline_expansion", "additional_deliverable", "off_brief_asset".`;

    const userMsg = `Original brief:
${brief.slice(0, 4000)}

Recent signals (numbered):
${signalsForPrompt}`;

    let parsed: { flags?: Flag[] } | null;
    try {
      const { text } = await sendCached({
        system,
        messages: [{ role: "user", content: userMsg }],
        model: MODEL_SONNET,
        maxTokens: 1200,
        endpoint: "cron-scope-creep",
      });
      parsed = safeJsonParse<{ flags: Flag[] }>(text);
    } catch {
      parsed = null;
    }
    if (!parsed || !Array.isArray(parsed.flags) || parsed.flags.length === 0) continue;

    for (const f of parsed.flags) {
      const idx = Number(f.source_index);
      const src = Number.isInteger(idx) && idx >= 0 && idx < signals.length ? signals[idx] : null;
      const severity: "low" | "medium" | "high" =
        f.severity === "high" || f.severity === "low" ? f.severity : "medium";
      await supabase.from("scope_creep_flags").insert({
        project_id: project.id,
        flag_type: (f.flag_type || "out_of_scope_request").slice(0, 80),
        description: (f.description || "").slice(0, 1000),
        source_asset_id: src?.id ?? null,
        source_asset_table: src?.table ?? null,
        severity,
      });
      totalFlags++;
    }
  }

  return NextResponse.json({
    success: true,
    projects_scanned: scanned,
    flags_created: totalFlags,
  });
}
