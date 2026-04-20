"use client";

import { MessageCircle } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function WhatsAppPage() {
  return (
    <ComingSoon
      title="WhatsApp Business"
      tagline="Native WhatsApp Cloud API — templated outbound, inbound routing, and agent replies."
      icon={MessageCircle}
      eta="~2 weeks"
      features={[
        "Direct WhatsApp Cloud API connection — no third-party gateway",
        "Template library pre-approved for transactional, marketing, and OTP",
        "Inbound threads flow into Conversations inbox with AI triage",
        "Bulk send with throttling to respect Meta quality rating",
        "Auto-reply agent handles FAQs, books calls, qualifies leads",
        "Delivery, read, and response metrics per template",
      ]}
      alternatives={[
        { label: "Integrations", href: "/dashboard/integrations" },
        { label: "DM Controller", href: "/dashboard/dm-controller" },
        { label: "Phone / Email", href: "/dashboard/phone-email" },
      ]}
      gradient={["#0c3d2c", "#07231a"]}
    />
  );
}
