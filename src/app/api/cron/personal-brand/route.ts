import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generatePersonalBrandIdeas } from "@/lib/services/content-ai";

// Runs every Sunday at 09:00 CET
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const batchDate = new Date().toISOString().split("T")[0];

  try {
    const ideas = await generatePersonalBrandIdeas();

    // Insert long-form ideas
    for (const idea of ideas.longForm) {
      await supabase.from("personal_brand_ideas").insert({
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

    // Insert short-form ideas
    for (const idea of ideas.shortForm) {
      await supabase.from("personal_brand_ideas").insert({
        idea_type: "short_form",
        title: idea.title,
        hook: idea.hook,
        core_concept: idea.core_concept,
        platform_recommendation: idea.platform_recommendation,
        trending_angle: idea.trending_angle,
        batch_date: batchDate,
      });
    }

    return NextResponse.json({
      success: true,
      longFormCount: ideas.longForm.length,
      shortFormCount: ideas.shortForm.length,
      batchDate,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
