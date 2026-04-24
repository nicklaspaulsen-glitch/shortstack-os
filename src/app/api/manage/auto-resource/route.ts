/**
 * POST /api/manage/auto-resource
 * Body: { project_id, requirements: string[] | string }
 *
 * Ranks available org members + hirable marketplace freelancers by
 * skill-match + current workload. Returns a ranked list.
 *
 * Workload = open tasks assigned to the member across projects.
 * Skill-match = naive lowercase overlap against requirement tokens.
 *
 * Marketplace freelancers are pulled from the `marketplace_freelancers`
 * table if present; silently skipped if the table doesn't exist yet.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManage, getProjectRole } from "@/lib/manage/access";
import type { SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 30;

interface Candidate {
  id: string;
  name: string;
  source: "member" | "freelancer";
  skills: string[];
  skill_match_score: number; // 0..1
  open_tasks: number;
  workload_score: number;    // 0..1 (lower = better)
  overall_score: number;     // 0..1 (higher = better)
  rate?: number | null;
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[\s,;/|]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
}

function skillMatch(reqTokens: string[], skills: string[]): number {
  if (reqTokens.length === 0) return 0;
  const skillSet = new Set(skills.map((s) => s.toLowerCase()));
  let hits = 0;
  for (const tok of reqTokens) {
    if (skillSet.has(tok)) { hits++; continue; }
    for (const sk of Array.from(skillSet)) {
      if (sk.includes(tok) || tok.includes(sk)) { hits++; break; }
    }
  }
  return hits / reqTokens.length;
}

async function fetchMembers(
  supabase: SupabaseClient,
  projectId: string,
): Promise<Array<{ id: string; name: string; skills: string[] }>> {
  // Org-wide members = project_members union project owner. We also pull
  // any profiles linked to the same org via the projects table.
  const { data: members } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);

  const { data: project } = await supabase
    .from("projects")
    .select("owner_id, org_id")
    .eq("id", projectId)
    .single();

  const userIds = new Set<string>();
  if (project?.owner_id) userIds.add(project.owner_id as string);
  for (const m of members ?? []) userIds.add(m.user_id as string);

  // Widen net to org-mates if org_id is set.
  if (project?.org_id) {
    const { data: orgMates } = await supabase
      .from("profiles")
      .select("id")
      .eq("org_id", project.org_id);
    for (const p of orgMates ?? []) userIds.add(p.id as string);
  }

  if (userIds.size === 0) return [];

  const { data: profs } = await supabase
    .from("profiles")
    .select("id, full_name, email, skills")
    .in("id", Array.from(userIds));

  return (profs ?? []).map((p) => ({
    id: p.id as string,
    name: (p.full_name as string | null) || (p.email as string | null) || "Unknown",
    skills: Array.isArray(p.skills) ? (p.skills as string[]) : [],
  }));
}

async function fetchFreelancers(
  supabase: SupabaseClient,
): Promise<Array<{ id: string; name: string; skills: string[]; rate: number | null }>> {
  const { data, error } = await supabase
    .from("marketplace_freelancers")
    .select("id, name, display_name, skills, hourly_rate")
    .eq("active", true)
    .limit(100);
  if (error) return []; // silently skip — table may not exist yet
  return (data ?? []).map((f) => ({
    id: f.id as string,
    name: ((f.display_name as string | null) || (f.name as string | null) || "Freelancer"),
    skills: Array.isArray(f.skills) ? (f.skills as string[]) : [],
    rate: (f.hourly_rate as number | null) ?? null,
  }));
}

async function workloadFor(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (userIds.length === 0) return out;
  const { data } = await supabase
    .from("tasks")
    .select("assignee_id, status")
    .in("assignee_id", userIds)
    .in("status", ["todo", "in_progress", "review"]);
  for (const t of data ?? []) {
    const id = t.assignee_id as string | null;
    if (!id) continue;
    out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { project_id?: unknown; requirements?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = typeof body.project_id === "string" ? body.project_id : "";
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const role = await getProjectRole(supabase, projectId, user.id);
  if (!canManage(role)) {
    return NextResponse.json({ error: "Only owners and leads can auto-resource" }, { status: 403 });
  }

  // Requirements accepted as string or string[]
  let reqText = "";
  if (Array.isArray(body.requirements)) {
    reqText = body.requirements.filter((r) => typeof r === "string").join(" ");
  } else if (typeof body.requirements === "string") {
    reqText = body.requirements;
  }
  const reqTokens = tokens(reqText);
  if (reqTokens.length === 0) {
    return NextResponse.json({ error: "requirements must be a non-empty string or string[]" }, { status: 400 });
  }

  const members = await fetchMembers(supabase, projectId);
  const freelancers = await fetchFreelancers(supabase);
  const workload = await workloadFor(supabase, members.map((m) => m.id));

  // Max workload for normalization.
  const maxLoad = Math.max(1, ...Array.from(workload.values()));

  const memberCandidates: Candidate[] = members.map((m) => {
    const open = workload.get(m.id) ?? 0;
    const skill = skillMatch(reqTokens, m.skills);
    const wl = open / maxLoad;
    // overall = 70% skill, 30% (1 - workload)
    const overall = 0.7 * skill + 0.3 * (1 - wl);
    return {
      id: m.id,
      name: m.name,
      source: "member",
      skills: m.skills,
      skill_match_score: Number(skill.toFixed(3)),
      open_tasks: open,
      workload_score: Number(wl.toFixed(3)),
      overall_score: Number(overall.toFixed(3)),
    };
  });

  const freelancerCandidates: Candidate[] = freelancers.map((f) => {
    const skill = skillMatch(reqTokens, f.skills);
    // Freelancers start at neutral workload (we don't track it here).
    const overall = 0.7 * skill + 0.3 * 0.5;
    return {
      id: f.id,
      name: f.name,
      source: "freelancer",
      skills: f.skills,
      skill_match_score: Number(skill.toFixed(3)),
      open_tasks: 0,
      workload_score: 0.5,
      overall_score: Number(overall.toFixed(3)),
      rate: f.rate,
    };
  });

  const ranked = [...memberCandidates, ...freelancerCandidates]
    .sort((a, b) => b.overall_score - a.overall_score)
    .slice(0, 20);

  return NextResponse.json({
    success: true,
    requirements: reqTokens,
    candidates: ranked,
    counts: {
      members: memberCandidates.length,
      freelancers: freelancerCandidates.length,
    },
  });
}
