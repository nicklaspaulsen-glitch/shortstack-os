"use client";

import { ClipboardCheck } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function SurveysPage() {
  return (
    <ComingSoon
      title="Surveys"
      tagline="NPS, CSAT, and custom feedback surveys — written by AI, sent on autopilot."
      icon={ClipboardCheck}
      eta="~3 weeks"
      features={[
        "Template library: NPS, CSAT, CES, onboarding, post-campaign",
        "AI writes question wording tuned to your industry and tone",
        "Trigger based on events: deal closed, ticket resolved, invoice paid",
        "Multi-channel delivery — email, SMS, in-app widget, public link",
        "Auto-route detractors (low scores) into a priority ticket queue",
        "Trend analysis with AI-surfaced recurring themes in open-text responses",
      ]}
      alternatives={[
        { label: "Forms", href: "/dashboard/forms" },
        { label: "Reviews", href: "/dashboard/reviews" },
        { label: "Client Portal", href: "/dashboard/portal" },
      ]}
      gradient={["#b45a23", "#2a0f13"]}
    />
  );
}
