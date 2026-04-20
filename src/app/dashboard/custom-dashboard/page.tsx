"use client";

import { LayoutDashboard } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function CustomDashboardPage() {
  return (
    <ComingSoon
      title="Custom Dashboards"
      tagline="Build the view YOU need — drag widgets, pin metrics, save per role."
      icon={LayoutDashboard}
      eta="~4 weeks"
      features={[
        "Drag-and-drop widget grid with 30+ prebuilt cards",
        "Save multiple layouts (CEO view, SDR view, Client-facing view)",
        "Per-widget filters — show this KPI for this client only",
        "Share a read-only link with clients or teammates",
        "Embed any external chart from Looker, Sheets, or Metabase",
        "AI widget: \"Explain what changed this week\" in plain English",
      ]}
      alternatives={[
        { label: "Dashboard Home", href: "/dashboard" },
        { label: "Analytics", href: "/dashboard/analytics" },
        { label: "Reports", href: "/dashboard/reports" },
      ]}
      gradient={["#14633e", "#07231a"]}
    />
  );
}
