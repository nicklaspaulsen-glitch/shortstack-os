"use client";

import { Store } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function IntegrationsMarketplacePage() {
  return (
    <ComingSoon
      title="Integrations Marketplace"
      tagline="A browseable catalog of every integration, with user reviews and one-click install."
      icon={Store}
      eta="~5 weeks"
      features={[
        "200+ integrations across CRM, marketing, finance, ops, and dev tools",
        "Categorized browsing with screenshots and real user reviews",
        "\"Install template\" workflows that ship pre-configured with setup wizards",
        "Community-submitted integrations with sandbox testing",
        "Developer portal to publish your own integration for the ShortStack community",
        "Revenue share for published integrations with active subscribers",
      ]}
      alternatives={[
        { label: "Integrations", href: "/dashboard/integrations" },
        { label: "Webhooks", href: "/dashboard/webhooks" },
        { label: "Connect Hub", href: "/dashboard/connect" },
      ]}
      gradient={["#3d3020", "#1a1611"]}
    />
  );
}
