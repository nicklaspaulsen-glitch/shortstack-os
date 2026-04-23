import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

/**
 * Progress poll endpoint for Domain-as-Hub.
 *
 * GET /api/domains/hub-setup/job/:jobId → current state of all 5 sub-tasks.
 * POST → retry a single failed sub-task (body: { service: 'email' | ... }).
 *
 * The UI polls this every 1-2 seconds while anything is in progress.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const svc = createServiceClient();
  const { data: job } = await svc
    .from("domain_setup_jobs")
    .select("*")
    .eq("id", params.jobId)
    .eq("profile_id", ownerId)
    .maybeSingle();

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Flatten the 5 sub-tasks into an array so the UI can .map() and render
  // 5 colored dots without hand-writing each field.
  const services = ["email", "phone", "website", "portal", "chat"] as const;
  const summary = services.map(s => ({
    service: s,
    enabled: job[`enable_${s}` as keyof typeof job] as boolean,
    status: job[`${s}_status` as keyof typeof job] as string,
    result: job[`${s}_result` as keyof typeof job] ?? null,
  }));

  const done = summary.every(s => ["done", "failed", "skipped"].includes(s.status));
  const anyFailed = summary.some(s => s.status === "failed");

  return NextResponse.json({
    id: job.id,
    domain: job.domain,
    services: summary,
    errors: job.errors || [],
    completed_at: job.completed_at,
    created_at: job.created_at,
    all_done: done,
    any_failed: anyFailed,
    all_green: done && !anyFailed,
  });
}

/**
 * Retry a single failed sub-task. Flips status back to `pending` then
 * re-fires the sub-route, same pattern as `provision-hub`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { service?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = ["email", "phone", "website", "portal", "chat"];
  const service = body.service?.toLowerCase();
  if (!service || !allowed.includes(service)) {
    return NextResponse.json({ error: "Invalid service" }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: job } = await svc
    .from("domain_setup_jobs")
    .select("id, domain")
    .eq("id", params.jobId)
    .eq("profile_id", ownerId)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await svc
    .from("domain_setup_jobs")
    .update({ [`${service}_status`]: "pending" })
    .eq("id", job.id);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const cookie = request.headers.get("cookie") || "";

  // Fire-and-forget — same pattern as initial provision.
  fetch(`${baseUrl}/api/domains/hub-setup/${service}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ job_id: job.id, domain: job.domain }),
  }).catch(err => console.error(`[hub-retry] ${service} failed to fire:`, err));

  return NextResponse.json({ success: true, service });
}
