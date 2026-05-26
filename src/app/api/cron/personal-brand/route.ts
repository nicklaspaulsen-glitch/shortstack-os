import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generatePersonalBrandIdeas } from "@/lib/services/content-ai";
import { pingCron } from "@/lib/cron-ping";
import { secureCompare } from "@/lib/security/ssrf-guard";

// Generates a fresh batch of long-form + short-form personal brand content
// ideas for every active admin via generatePersonalBrandIdeas() and inserts
// them into personal_brand_ideas keyed by user_id for multi-tenant isolation.
//
// Schedule: "0 8 * * 0" — every Sunday 08:00 UTC = 09:00 CET (set in
// vercel.json Apr 27).
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const rawToken = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !secureCompare(rawToken, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const done = await pingCron("personal-brand");
  const supabase = createServiceClient();
  const batchDate = new Date().toISOString().split("T")[0];

  // Pull every active admin — one idea batch per owner.
  const { data: admins, error: adminsError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "admin")
    .eq("is_active", true);

  if (adminsError) {
    await done("fail");
    return NextResponse.json({ error: adminsError.message }, { status: 500 });
  }

  let totalLong = 0;
  let totalShort = 0;
  let failed = 0;

  for (const admin of admins ?? []) {
    try {
      const ideas = await generatePersonalBrandIdeas();

      // Insert long-form ideas scoped to this owner.
      for (const idea of ideas.longForm) {
        await supabase.from("personal_brand_ideas").insert({
          user_id: admin.id,
          idea_type: "long_form",
          title: idea.title,
          hook: idea.hook,
          outline: idea.outline,
          thumbnail_concept: idea.thumbnail_concept,
          estimated_length: idea.estimated_length,
          target_keyword: idea.target_keyword,
          batch_date: batchDate,
        });
      }

      // Insert short-form ideas scoped to this owner.
      for (const idea of ideas.shortForm) {
        await supabase.from("personal_brand_ideas").insert({
          user_id: admin.id,
          idea_type: "short_form",
          title: idea.title,
          hook: idea.hook,
          core_concept: idea.core_concept,
          platform_recommendation: idea.platform_recommendation,
          trending_angle: idea.trending_angle,
          batch_date: batchDate,
        });
      }

      totalLong += ideas.longForm.length;
      totalShort += ideas.shortForm.length;
    } catch (err) {
      console.error(`[cron/personal-brand] failed for user ${admin.id}:`, err);
      failed++;
    }
  }

  await done("complete");
  return NextResponse.json({
    success: true,
    admins: admins?.length ?? 0,
    longFormCount: totalLong,
    shortFormCount: totalShort,
    failed,
    batchDate,
  });
}
