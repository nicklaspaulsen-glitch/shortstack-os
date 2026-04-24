import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/admin/pro-services/vet
 *
 * Admin-only toggle to (un)vet a provider. When vetting flips true, the
 * provider appears in the public directory; flipping false hides them
 * immediately.
 *
 * Body: { provider_id, vetted }
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const provider_id = typeof body.provider_id === "string" ? body.provider_id : "";
  const vetted = Boolean(body.vetted);

  if (!provider_id) {
    return NextResponse.json({ error: "provider_id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pro_services_providers")
    .update({
      vetted,
      vetted_at: vetted ? new Date().toISOString() : null,
    })
    .eq("id", provider_id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ provider: data });
}
