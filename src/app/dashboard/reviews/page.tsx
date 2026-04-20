"use client";

import { Star } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function ReviewsPage() {
  return (
    <ComingSoon
      title="Review Manager"
      tagline="One inbox for every star rating across Google, Yelp, Trustpilot, and more."
      icon={Star}
      eta="~2 weeks"
      features={[
        "Aggregated feed from Google Business, Yelp, Trustpilot, Facebook, G2",
        "AI-drafted replies tuned to your brand voice and industry norms",
        "Auto-flag and route 1-2 star reviews to a human the moment they land",
        "Request-a-review campaigns by SMS, email, or post-purchase link",
        "Sentiment heatmap across location, time of day, and product line",
        "CSV export for monthly reputation reports",
      ]}
      alternatives={[
        { label: "Google Business", href: "/dashboard/google-business" },
        { label: "Tickets", href: "/dashboard/tickets" },
      ]}
      gradient={["#b45a23", "#2a0f13"]}
    />
  );
}
