"use client";

import { Activity } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function MonitorPage() {
  return (
    <ComingSoon
      title="System Monitor"
      tagline="Real-time health for every integration, agent, and cron in your stack."
      icon={Activity}
      eta="~2 weeks"
      features={[
        "Live status board for every third-party integration (Stripe, Twilio, Meta, etc.)",
        "Cron and background-job dashboard with last-run timestamps",
        "Alert rules: page you on Slack, email, or SMS when things break",
        "P95 latency and error-rate trendlines for each AI endpoint",
        "Downtime timeline with incident postmortems",
        "One-click retry for failed webhooks and workflow runs",
      ]}
      alternatives={[
        { label: "System Status", href: "/dashboard/system-status" },
        { label: "Audit Log", href: "/dashboard/audit" },
        { label: "Activity Log", href: "/dashboard/activity-log" },
      ]}
      gradient={["#1f7a87", "#041926"]}
    />
  );
}
