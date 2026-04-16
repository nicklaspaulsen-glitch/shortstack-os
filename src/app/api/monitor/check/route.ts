import { NextRequest, NextResponse } from "next/server";

// POST — Run a competitive monitoring check on a given URL
// In production this would: fetch the URL, compare with stored snapshot,
// use Anthropic to summarize differences, store new snapshot, return changes.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { competitor_url, check_type = "full" } = body;

    if (!competitor_url) {
      return NextResponse.json({ error: "competitor_url is required" }, { status: 400 });
    }

    // --- Mock implementation ---
    // In a real implementation:
    //   1. Fetch the competitor URL via headless browser / fetch
    //   2. Retrieve the previous snapshot from Supabase
    //   3. Diff the HTML/content against the snapshot
    //   4. Send diff to Anthropic for summarization
    //   5. Classify change type and severity
    //   6. Store new snapshot + detected changes
    //   7. Fire alert rules if matched

    const changeTypes = [
      "content_update", "pricing_change", "new_feature",
      "new_blog_post", "new_page", "tech_stack_change",
      "social_post", "job_posting",
    ] as const;

    const severities = ["high", "medium", "low"] as const;

    const mockChanges = generateMockChanges(competitor_url, check_type, changeTypes, severities);

    return NextResponse.json({
      success: true,
      competitor_url,
      check_type,
      checked_at: new Date().toISOString(),
      changes_detected: mockChanges.length,
      changes: mockChanges,
      snapshot_id: `snap_${Date.now()}`,
      credits_used: check_type === "full" ? 3 : 1,
    });
  } catch (error) {
    console.error("Monitor check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function generateMockChanges(
  url: string,
  checkType: string,
  changeTypes: readonly string[],
  severities: readonly string[]
) {
  const domain = url.replace(/https?:\/\//, "").replace(/\/$/, "");
  const count = checkType === "full" ? Math.floor(Math.random() * 4) + 1 : Math.floor(Math.random() * 2) + 1;

  const descriptions: Record<string, string[]> = {
    content_update: [
      "Homepage hero section copy updated",
      "About page team section modified",
      "Services descriptions rewritten",
    ],
    pricing_change: [
      "Pro plan price increased from $49 to $59/mo",
      "New Enterprise tier added at $199/mo",
      "Free trial extended from 7 to 14 days",
    ],
    new_feature: [
      "AI-powered analytics dashboard released",
      "New Slack integration announced",
      "White-label reporting feature added",
    ],
    new_blog_post: [
      `Published: "2026 Marketing Trends You Can't Ignore"`,
      `Published: "How We Scaled to 10K Users"`,
      `Published: "Agency Growth Playbook"`,
    ],
    new_page: [
      "/enterprise landing page created",
      "/integrations directory added",
      "/case-studies page launched",
    ],
    tech_stack_change: [
      "Migrated from Intercom to Drift for chat",
      "Added Segment analytics tracking",
      "Switched CDN provider to Cloudflare",
    ],
    social_post: [
      "LinkedIn post announcing Series A funding",
      "Twitter thread on product roadmap",
      "Instagram carousel on client success stories",
    ],
    job_posting: [
      "Hiring Senior Full-Stack Engineer (remote)",
      "VP of Sales position posted",
      "3 new marketing roles opened",
    ],
  };

  const changes = [];
  for (let i = 0; i < count; i++) {
    const type = changeTypes[Math.floor(Math.random() * changeTypes.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const descs = descriptions[type] || descriptions.content_update;
    const desc = descs[Math.floor(Math.random() * descs.length)];

    changes.push({
      id: `chg_${Date.now()}_${i}`,
      type,
      severity,
      description: desc,
      url: `https://${domain}${type === "new_page" ? "/new-page" : ""}`,
      detected_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      ai_summary: `This ${type.replace(/_/g, " ")} on ${domain} suggests ${
        severity === "high"
          ? "a significant strategic shift that may impact your competitive positioning"
          : severity === "medium"
          ? "an incremental improvement worth monitoring"
          : "a minor update with limited competitive impact"
      }.`,
    });
  }

  return changes;
}
