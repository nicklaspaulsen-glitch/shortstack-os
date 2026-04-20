"use client";

import { FileCheck } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function ProposalsPage() {
  return (
    <ComingSoon
      title="Proposals"
      tagline="AI-drafted, client-signed, hooked straight into your CRM."
      icon={FileCheck}
      eta="~2 weeks"
      features={[
        "Claude drafts tailored proposals from a client brief in under 60 seconds",
        "Inline comments, version history, and e-signature via Stripe",
        "Auto-fire workflows on signed (onboarding, invoice, welcome doc)",
        "Template library prebuilt with your brand kit and pricing",
        "Win/loss analytics with AI-written reason tracking",
      ]}
      alternatives={[
        { label: "CRM → Deals", href: "/dashboard/deals" },
        { label: "Clients → Invoices", href: "/dashboard/clients" },
      ]}
      gradient={["#2a1e4a", "#120b24"]}
    />
  );
}
