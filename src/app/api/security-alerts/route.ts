import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET — list caller's security alerts
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const resolvedParam = searchParams.get("resolved");
  const severity = searchParams.get("severity");
  const limitRaw = Number(searchParams.get("limit") ?? 100);
  const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 100), 500);

  let query = supabase
    .from("security_alerts")
    .select("*")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (resolvedParam === "true") query = query.eq("resolved", true);
  if (resolvedParam === "false") query = query.eq("resolved", false);
  if (severity && ["low", "medium", "high", "critical"].includes(severity)) {
    query = query.eq("severity", severity);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ alerts: data ?? [], total: (data ?? []).length });
}

// PATCH — resolve an alert by id
// Body: { id: string, resolved: boolean }
export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; resolved?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  if (typeof body.resolved !== "boolean") {
    return NextResponse.json({ error: "resolved must be boolean" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("security_alerts")
    .update({
      resolved: body.resolved,
      resolved_at: body.resolved ? new Date().toISOString() : null,
    })
    .eq("id", body.id)
    .eq("profile_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ alert: data });
}
