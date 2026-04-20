"use client";

import { Palette } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function WhiteLabelSettingsPage() {
  return (
    <ComingSoon
      title="White Label"
      tagline="Custom domain, logo, and branded client portals — sell ShortStack as your own product."
      icon={Palette}
      eta="~2 weeks"
      features={[
        "Custom domain on your client portal (app.yourbrand.com)",
        "Your logo, colors, and favicons applied platform-wide",
        "Remove or rename \"ShortStack\" references in the client-facing UI",
        "Send emails from your domain via configured Resend / SMTP credentials",
        "Per-workspace white-label overrides for agency + sub-brand setups",
        "Reseller pricing plan with bulk client seats",
      ]}
      alternatives={[
        { label: "Settings", href: "/dashboard/settings" },
        { label: "Brand Kit", href: "/dashboard/brand-kit" },
        { label: "Domains", href: "/dashboard/domains" },
      ]}
      gradient={["#2a1e4a", "#120b24"]}
    />
  );
}
