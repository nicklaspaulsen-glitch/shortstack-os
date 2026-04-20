"use client";

import { MessagesSquare } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function ConversationsPage() {
  return (
    <ComingSoon
      title="Unified Conversations"
      tagline="Every DM, email, SMS, and WhatsApp thread in one AI-ranked inbox."
      icon={MessagesSquare}
      eta="~3 weeks"
      features={[
        "Instagram, LinkedIn, Email, SMS, WhatsApp, and Telegram in one thread view",
        "AI ranks replies by urgency and revenue likelihood",
        "One-click AI reply suggestions tuned to your brand voice",
        "Auto-escalate hot leads straight into CRM + Deals",
        "Shared inbox assignments with internal notes and mentions",
        "Full conversation search across every channel, forever",
      ]}
      alternatives={[
        { label: "Inbox", href: "/dashboard/inbox" },
        { label: "DM Controller", href: "/dashboard/dm-controller" },
        { label: "Outreach Logs", href: "/dashboard/outreach-logs" },
      ]}
      gradient={["#112447", "#0a1428"]}
    />
  );
}
