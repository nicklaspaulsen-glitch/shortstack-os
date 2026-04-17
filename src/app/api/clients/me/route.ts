import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET — Return the client record associated with the logged-in user
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: client } = await supabase
    .from("clients")
    .select("id, business_name, email, phone, stripe_customer_id, package_tier, cancelled_at, scheduled_deletion_at, cancellation_reason, status")
    .eq("profile_id", user.id)
    .maybeSingle();

  return NextResponse.json({ client });
}
