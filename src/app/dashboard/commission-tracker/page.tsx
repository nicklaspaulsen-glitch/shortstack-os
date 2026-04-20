"use client";

import { Percent } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function CommissionTrackerPage() {
  return (
    <ComingSoon
      title="Commission Tracker"
      tagline="Automatic commission calculation for every rep, partner, and affiliate."
      icon={Percent}
      eta="~4 weeks"
      features={[
        "Define commission plans: flat %, tiered, split across multiple reps",
        "Auto-attribution on deals closed — no spreadsheet reconciliation",
        "Clawback rules for refunds, churn, and unpaid invoices",
        "Per-rep dashboards showing earned, pending, and projected",
        "Monthly payout reports signed off by finance",
        "Sync earnings to Gusto, Rippling, or export CSV for payroll",
      ]}
      alternatives={[
        { label: "CRM → Deals", href: "/dashboard/deals" },
        { label: "Team", href: "/dashboard/team" },
        { label: "Financials", href: "/dashboard/financials" },
      ]}
      gradient={["#14633e", "#07231a"]}
    />
  );
}
