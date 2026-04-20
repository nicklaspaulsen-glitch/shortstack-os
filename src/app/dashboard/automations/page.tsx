"use client";

import { Zap } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function AutomationsPage() {
  return (
    <ComingSoon
      title="Automations"
      tagline="Simple if-this-then-that recipes — without opening Workflow Builder."
      icon={Zap}
      eta="~2 weeks"
      features={[
        "One-click recipes: new lead → Slack ping, deal won → invoice, reply received → CRM note",
        "Natural-language recipe builder (\"when a Stripe payment fails, text me\")",
        "50+ pre-built templates for the most common agency ops",
        "Run history with success/fail replay and per-step metrics",
        "Enable/disable any recipe without rebuilding it",
        "Graduate any recipe to a full n8n workflow in one click",
      ]}
      alternatives={[
        { label: "Workflows", href: "/dashboard/workflows" },
        { label: "Workflow Builder", href: "/dashboard/workflow-builder" },
        { label: "Integrations", href: "/dashboard/integrations" },
      ]}
      gradient={["#b45a23", "#2a0f13"]}
    />
  );
}
