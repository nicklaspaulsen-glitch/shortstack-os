"use client";

import { Tag } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function TagsPage() {
  return (
    <ComingSoon
      title="Tag Manager"
      tagline="One place to organize every tag across leads, clients, content, and deals."
      icon={Tag}
      eta="~1 week"
      features={[
        "Unified tag namespace across leads, clients, content, and deals",
        "Merge, rename, or bulk-apply tags across thousands of records",
        "Tag hierarchy with parent / child relationships (e.g. Industry → SaaS)",
        "Tag-based segmentation for outreach, analytics, and automation triggers",
        "Auto-tag rules powered by Claude (\"tag any lead whose site mentions Shopify\")",
        "Color coding and icons for at-a-glance sorting",
      ]}
      alternatives={[
        { label: "CRM", href: "/dashboard/crm" },
        { label: "Leads", href: "/dashboard/leads" },
        { label: "Content Library", href: "/dashboard/content-library" },
      ]}
      gradient={["#3d3020", "#1a1611"]}
    />
  );
}
