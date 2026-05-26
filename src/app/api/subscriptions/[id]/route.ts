import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Allowlist of fields the caller may update — prevents mass assignment
// (e.g. setting profile_id to another user's ID to hijack their record).
const UPDATABLE_FIELDS = [
  "name", "url", "price", "billing_period", "category", "notes",
  "renewal_date", "status", "is_active", "icon_url", "color",
] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.json();
  // Only pick allowlisted fields to prevent mass assignment
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of UPDATABLE_FIELDS) {
    if (field in raw) patch[field] = raw[field];
  }
  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("software_subscriptions")
    .update(patch)
    .eq("id", params.id)
    .eq("profile_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ success: true, subscription: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("software_subscriptions")
    .delete()
    .eq("id", params.id)
    .eq("profile_id", user.id);

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ success: true });
}
