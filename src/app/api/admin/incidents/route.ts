/**
 * Incident management API for the admin status page.
 *
 *   GET  /api/admin/incidents — list owner's incidents (active first, then
 *                               recent resolved, capped at 50 most recent).
 *   POST /api/admin/incidents — create a new incident.
 *
 * Single-incident operations live at /api/admin/incidents/[id]/route.ts.
 *
 * Auth: createServerSupabase() — RLS enforces ownership via the
 * `incidents_owner_all` policy. We deliberately re-check `user.id` against
 * the row's owner_id in the API layer too, belt-and-suspenders.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SEVERITY_VALUES = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;

const createIncidentSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(8000).default(""),
  severity: z.enum(SEVERITY_VALUES),
  affected_components: z.array(z.string().max(80)).max(20).default([]),
  started_at: z.string().datetime().optional(),
});

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (
    profile?.role !== "admin" &&
    profile?.role !== "founder" &&
    profile?.role !== "agency"
  ) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // RLS limits this to incidents owned by the caller. We still pass the
  // owner_id filter to make the query plan obvious + use the index.
  const { data, error } = await supabase
    .from("incidents")
    .select(
      "id, title, body, severity, affected_components, started_at, resolved_at, created_at",
    )
    .eq("owner_id", user.id)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[admin/incidents] list failed:", error.message);
    return NextResponse.json({ error: "List failed" }, { status: 500 });
  }

  return NextResponse.json({ incidents: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (
    profile?.role !== "admin" &&
    profile?.role !== "founder" &&
    profile?.role !== "agency"
  ) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let parsed: z.infer<typeof createIncidentSchema>;
  try {
    const json = await request.json();
    parsed = createIncidentSchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  // If the caller marks it `resolved` at create time, set resolved_at too.
  const resolved_at =
    parsed.severity === "resolved" ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("incidents")
    .insert({
      owner_id: user.id,
      title: parsed.title,
      body: parsed.body,
      severity: parsed.severity,
      affected_components: parsed.affected_components,
      started_at: parsed.started_at ?? new Date().toISOString(),
      resolved_at,
    })
    .select()
    .single();

  if (error) {
    console.error("[admin/incidents] insert failed:", error.message);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ incident: data }, { status: 201 });
}
