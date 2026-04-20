"use client";

import { LifeBuoy } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function TicketsPage() {
  return (
    <ComingSoon
      title="Client Support Tickets"
      tagline="Shared helpdesk for every client account — with SLA timers baked in."
      icon={LifeBuoy}
      eta="~3 weeks"
      features={[
        "Email, portal, and in-app ticket intake with automatic deduplication",
        "SLA timers per client plan — visual countdown and auto-escalation",
        "AI triage suggests priority, category, and next-best response",
        "Macros and canned responses tuned to your brand voice",
        "CSAT survey on resolution with trend reporting",
        "Billable time capture directly on each ticket for retainer tracking",
      ]}
      alternatives={[
        { label: "Inbox", href: "/dashboard/inbox" },
        { label: "Client Portal", href: "/dashboard/portal" },
      ]}
      gradient={["#112447", "#0a1428"]}
    />
  );
}
