"use client";

import { Filter } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function LeadSourcesPage() {
  return (
    <ComingSoon
      title="Lead Sources"
      tagline="Track exactly where every lead came from — and what each source is really worth."
      icon={Filter}
      eta="~2 weeks"
      features={[
        "Auto-detect source from UTM, referrer, form, or integration origin",
        "Revenue attribution per source with CAC and LTV calculations",
        "Custom source tagging rules to reclassify noisy traffic",
        "Compare conversion rates, deal sizes, and sales cycles per source",
        "Budget reallocation suggestions from the AI recommender",
        "Monthly source performance report delivered to your inbox",
      ]}
      alternatives={[
        { label: "Scraper", href: "/dashboard/scraper" },
        { label: "Analytics", href: "/dashboard/analytics" },
        { label: "Integrations", href: "/dashboard/integrations" },
      ]}
      gradient={["#0c3d2c", "#07231a"]}
    />
  );
}
