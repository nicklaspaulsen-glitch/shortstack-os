"use client";

import { Calculator } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function RoiCalculatorPage() {
  return (
    <ComingSoon
      title="ROI Calculator"
      tagline="Prove the money. Client-ready ROI math in 60 seconds — no spreadsheet surgery."
      icon={Calculator}
      eta="~1 week"
      features={[
        "Plug in ad spend, retainer, and deliverables — get net ROI by month",
        "Pre-built models for ads, SEO, content, cold outreach, and CRO",
        "Assumption sliders clients can play with themselves in shared view",
        "AI-written executive summary of why the number is what it is",
        "Export to PDF with your logo for pitch decks",
        "Save scenarios per client to revisit at renewal",
      ]}
      alternatives={[
        { label: "Reports", href: "/dashboard/reports" },
        { label: "Analytics", href: "/dashboard/analytics" },
        { label: "Proposals", href: "/dashboard/proposals" },
      ]}
      gradient={["#14596c", "#041926"]}
    />
  );
}
