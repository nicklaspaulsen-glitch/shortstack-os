/**
 * Cold-email jobs collection.
 *
 *   GET  /api/cold-email/jobs   - list jobs for the caller
 *   POST /api/cold-email/jobs   - create a new job (does NOT auto-start)
 *
 * Lead selection options on POST:
 *   - lead_ids: explicit list of lead UUIDs (max 5000)
 *   - tag:      pull every lead with this tag value (TODO future)
 *   - status:   pull every lead matching this status
 *
 * The route only enqueues — it does not call any LLM or send any email.
 * Use POST /api/cold-email/jobs/{id}/start to begin processing.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

interface CreateJobBody {
  name?: unknown;
  template_seed?: unknown;
  research_depth?: unknown;
  throttle_per_hour?: unknown;
  lead_ids?: unknown;
  status_filter?: unknown;
}

const VALID_DEPTHS = new Set(["shallow", "medium", "deep"]);

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) ?? user.id;
  const { data, error } = await supabase
    .from("cold_email_jobs")
    .select("*")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) ?? user.id;

  let body: CreateJobBody;
  try {
    body = (await request.json()) as CreateJobBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  const templateSeed =
    typeof body.template_seed === "string" && body.template_seed.trim()
      ? body.template_seed.trim()
      : null;
  if (!name || !templateSeed) {
    return NextResponse.json(
      { error: "name and template_seed are required" },
      { status: 400 },
    );
  }

  const depthRaw = typeof body.research_depth === "string" ? body.research_depth : "medium";
  const researchDepth = VALID_DEPTHS.has(depthRaw) ? depthRaw : "medium";

  const throttleRaw = body.throttle_per_hour;
  const throttle =
    typeof throttleRaw === "number" && throttleRaw > 0 && throttleRaw <= 5000
      ? Math.floor(throttleRaw)
      : 100;

  // Resolve lead pool
  const leadIdsRaw = Array.isArray(body.lead_ids) ? body.lead_ids : null;
  const statusFilter =
    typeof body.status_filter === "string" && body.status_filter.trim()
      ? body.status_filter.trim()
      : null;

  let leadIds: string[] = [];
  if (leadIdsRaw && leadIdsRaw.length > 0) {
    leadIds = leadIdsRaw.filter((v): v is string => typeof v === "string");
  } else if (statusFilter) {
    const { data: matched, error: matchErr } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", ownerId)
      .eq("status", statusFilter)
      .not("email", "is", null)
      .limit(5000);
    if (matchErr) {
      return NextResponse.json({ error: matchErr.message }, { status: 500 });
    }
    leadIds = (matched ?? []).map((r) => r.id as string);
  } else {
    return NextResponse.json(
      { error: "Provide lead_ids[] or status_filter" },
      { status: 400 },
    );
  }

  if (leadIds.length === 0) {
    return NextResponse.json(
      { error: "No leads matched. Refine your selection." },
      { status: 400 },
    );
  }
  if (leadIds.length > 5000) {
    return NextResponse.json(
      { error: "Maximum 5000 leads per job" },
      { status: 400 },
    );
  }

  const { data: job, error: jobErr } = await supabase
    .from("cold_email_jobs")
    .insert({
      user_id: ownerId,
      name,
      template_seed: templateSeed,
      research_depth: researchDepth,
      recipients_count: leadIds.length,
      throttle_per_hour: throttle,
      status: "pending",
    })
    .select()
    .single();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });

  // Pre-create the personalizations in pending state. Cron will pick them up.
  const personalizations = leadIds.map((id) => ({
    job_id: job.id as string,
    lead_id: id,
    status: "pending" as const,
  }));

  // Chunk inserts (Supabase max ~1000 per insert).
  for (let i = 0; i < personalizations.length; i += 500) {
    const chunk = personalizations.slice(i, i + 500);
    const { error } = await supabase.from("cold_email_personalizations").insert(chunk);
    if (error) {
      console.error("[cold-email] personalization insert failed", error);
      // Mark job failed and bail
      await supabase
        .from("cold_email_jobs")
        .update({ status: "failed" })
        .eq("id", job.id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ job }, { status: 201 });
}
