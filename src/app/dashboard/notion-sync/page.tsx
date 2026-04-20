"use client";

import { RefreshCw } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function NotionSyncPage() {
  return (
    <ComingSoon
      title="Notion Sync"
      tagline="Two-way sync between your CRM, content library, and Notion databases."
      icon={RefreshCw}
      eta="~3 weeks"
      features={[
        "Map CRM clients, leads, or content items to any Notion database",
        "Two-way sync — edits in Notion push back to ShortStack and vice versa",
        "Field-level mapping UI with type conversion and custom formulas",
        "Realtime change detection via Notion webhooks",
        "Conflict resolution policy per collection (last-write-wins or prompt)",
        "Backfill existing databases on first connect",
      ]}
      alternatives={[
        { label: "Integrations", href: "/dashboard/integrations" },
        { label: "Content Library", href: "/dashboard/content-library" },
        { label: "CRM", href: "/dashboard/crm" },
      ]}
      gradient={["#3d3020", "#1a1611"]}
    />
  );
}
