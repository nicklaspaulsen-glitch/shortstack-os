"use client";

import { Crosshair } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function CompetitorTrackerPage() {
  return (
    <ComingSoon
      title="Competitor Tracker"
      tagline="Know what your top competitors post, price, and promote — before your clients ask."
      icon={Crosshair}
      eta="~3 weeks"
      features={[
        "Track up to 50 competitors across web, ads, and social",
        "Weekly AI-written competitive brief delivered Monday morning",
        "Price change alerts and pricing page diff history",
        "New landing page and ad campaign detection",
        "Shared content angles you can counter or match",
        "Swipe file — save any competitor ad or post into your content library",
      ]}
      alternatives={[
        { label: "Competitive Monitor", href: "/dashboard/competitive-monitor" },
        { label: "Competitor", href: "/dashboard/competitor" },
        { label: "Content Library", href: "/dashboard/content-library" },
      ]}
      gradient={["#4f1e1d", "#2a0f13"]}
    />
  );
}
