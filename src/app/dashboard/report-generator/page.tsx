"use client";

import { FileBarChart } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function ReportGeneratorPage() {
  return (
    <ComingSoon
      title="Report Generator"
      tagline="Polished, white-labeled client reports — built in 30 seconds, not 3 hours."
      icon={FileBarChart}
      eta="~3 weeks"
      features={[
        "Pick a template, pick a client, pick a date range — Claude writes the rest",
        "AI-written executive summary and per-section commentary",
        "Your logo, your colors, your fonts — on every page automatically",
        "Pulls from ads, social, email, SEO, and CRM in one report",
        "Schedule auto-delivery by email every Monday at 9am",
        "Export as PDF, PPTX, or branded client-portal link",
      ]}
      alternatives={[
        { label: "Reports", href: "/dashboard/reports" },
        { label: "Client Reports", href: "/dashboard/client-reports" },
        { label: "Analytics", href: "/dashboard/analytics" },
      ]}
      gradient={["#1a3e7a", "#0a1428"]}
    />
  );
}
