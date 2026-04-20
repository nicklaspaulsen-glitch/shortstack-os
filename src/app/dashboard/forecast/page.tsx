"use client";

import { TrendingUp } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function ForecastPage() {
  return (
    <ComingSoon
      title="Revenue Forecast"
      tagline="Know your next three months of revenue before the month begins."
      icon={TrendingUp}
      eta="~10 days"
      features={[
        "Pulls live MRR from your client roster and open deal pipeline",
        "Monte Carlo projections with best / expected / worst scenarios",
        "AI commentary on which deals are at risk and why",
        "Per-service breakdown (retainers, projects, one-offs)",
        "Target vs. actual with monthly variance tracking",
        "Export to PDF for investors or sync to Google Sheets",
      ]}
      alternatives={[
        { label: "CRM → Deals", href: "/dashboard/deals" },
        { label: "Clients", href: "/dashboard/clients" },
        { label: "Financials", href: "/dashboard/financials" },
      ]}
      gradient={["#0c3d2c", "#07231a"]}
    />
  );
}
