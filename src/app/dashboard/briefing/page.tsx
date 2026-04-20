"use client";

import { Coffee } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function BriefingPage() {
  return (
    <ComingSoon
      title="Daily Briefing"
      tagline="Your morning standup — written by Claude from last night's numbers."
      icon={Coffee}
      eta="~1 week"
      features={[
        "One-paragraph executive summary of yesterday's revenue, leads, and outreach",
        "Three priorities for today ranked by AI against your goals",
        "At-risk items surfaced: stalled deals, missed SLAs, churn signals",
        "What Trinity and your agents did overnight",
        "Optional voice briefing piped to Alexa / Google Home at 7am",
        "Delivered to your inbox before you open the laptop",
      ]}
      alternatives={[
        { label: "Dashboard Home", href: "/dashboard" },
        { label: "Analytics", href: "/dashboard/analytics" },
        { label: "Trinity", href: "/dashboard/trinity" },
      ]}
      gradient={["#4f1e1d", "#2a0f13"]}
    />
  );
}
