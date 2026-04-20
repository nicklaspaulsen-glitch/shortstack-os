"use client";

import { Gift } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function ReferralsPage() {
  return (
    <ComingSoon
      title="Referral Program"
      tagline="Turn every happy client into a referral engine — with tracked links and payouts."
      icon={Gift}
      eta="~4 weeks"
      features={[
        "Auto-generated referral links per client, rep, or partner",
        "Attribution across first-click, last-click, and multi-touch models",
        "Configurable rewards: flat cash, % commission, credits, or custom",
        "Automatic payouts via Stripe, PayPal, or platform credits",
        "Leaderboards and gamification to drive referrals from power users",
        "Embeddable widget for client dashboards and email signatures",
      ]}
      alternatives={[
        { label: "CRM", href: "/dashboard/crm" },
        { label: "Commission Tracker", href: "/dashboard/commission-tracker" },
        { label: "Clients", href: "/dashboard/clients" },
      ]}
      gradient={["#4a2285", "#1a1033"]}
    />
  );
}
