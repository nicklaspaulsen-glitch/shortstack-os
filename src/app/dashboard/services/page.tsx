"use client";

import { Package } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function ServicesPage() {
  return (
    <ComingSoon
      title="Service Catalog"
      tagline="Define your productized services once — price them, scope them, sell them anywhere."
      icon={Package}
      eta="~3 weeks"
      features={[
        "Service library with description, scope, deliverables, and default pricing",
        "Variable pricing models: fixed, hourly, retainer, % of ad spend",
        "Attach services directly to proposals, invoices, and contracts",
        "Margin and profitability per service with actual-vs-budget tracking",
        "Bundles and upsell combos with smart recommendations",
        "Public service menu pages clients can browse and request",
      ]}
      alternatives={[
        { label: "Pricing", href: "/dashboard/pricing" },
        { label: "CRM → Deals", href: "/dashboard/deals" },
        { label: "Client Portal", href: "/dashboard/portal" },
      ]}
      gradient={["#1a3e7a", "#0a1428"]}
    />
  );
}
