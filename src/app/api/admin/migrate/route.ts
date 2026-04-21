import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// One-time migration endpoint — adds missing columns
// POST /api/admin/migrate
// SECURITY: admin session only. Migrations are a DDL-execution surface
// and should never be triggerable by a cron/leaked shared secret.
// (bug-hunt-apr20-v2 MEDIUM #4 — removed CRON_SECRET fallback.)
export async function POST() {
  const serverSupabase = createServerSupabase();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await serverSupabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "founder") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const supabase = createServiceClient();

  // Try adding plan_tier column — use raw SQL via rpc if available,
  // otherwise do it via the upsert trick
  const results: string[] = [];

  // First check if column exists by trying to select it
  const { error: checkErr } = await supabase
    .from("profiles")
    .select("plan_tier")
    .limit(1);

  if (checkErr?.message?.includes("does not exist")) {
    // Column doesn't exist — we need to add it
    // Try creating a temp function to add it
    results.push("plan_tier column missing — attempting to add via SQL...");

    // Use the Supabase Management API
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
    const sbAccessToken = process.env.SUPABASE_ACCESS_TOKEN;

    if (projectRef && sbAccessToken) {
      const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sbAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_tier text DEFAULT NULL;
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text DEFAULT NULL;
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS client_label text DEFAULT NULL;
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text DEFAULT NULL;
          `,
        }),
      });
      const data = await res.json();
      results.push(`Management API response: ${JSON.stringify(data).slice(0, 200)}`);
    } else {
      results.push("No SUPABASE_ACCESS_TOKEN — need to add column manually in Supabase dashboard SQL editor");
      results.push("Run: ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_tier text DEFAULT NULL;");
    }
  } else {
    results.push("plan_tier column already exists");

    // Set admin user to Founder plan
    const { data: admins } = await supabase
      .from("profiles")
      .select("id, email, plan_tier")
      .eq("role", "admin");

    if (admins?.length) {
      for (const admin of admins) {
        if (!admin.plan_tier || admin.plan_tier !== "Founder") {
          await supabase
            .from("profiles")
            .update({ plan_tier: "Founder" })
            .eq("id", admin.id);
          results.push(`Updated ${admin.email} to Founder plan`);
        } else {
          results.push(`${admin.email} already on Founder plan`);
        }
      }
    }
  }

  return NextResponse.json({ results });
}
