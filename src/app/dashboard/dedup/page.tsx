"use client";

import { Copy } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function DedupPage() {
  return (
    <ComingSoon
      title="Lead Deduplication"
      tagline="Fuzzy-match, merge, and keep your CRM clean — automatically."
      icon={Copy}
      eta="~1 week"
      features={[
        "Fuzzy matching on name, email, phone, and company domain",
        "Preview diffs before merging — no surprise overwrites",
        "Merge history log with one-click undo for 30 days",
        "Scheduled nightly scan to catch duplicates as they land",
        "Custom rules: treat @gmail.com vs work email as same person?",
        "CSV bulk dedupe for imports from scrapers or lead lists",
      ]}
      alternatives={[
        { label: "CRM", href: "/dashboard/crm" },
        { label: "Leads", href: "/dashboard/leads" },
        { label: "Settings → Data hygiene", href: "/dashboard/settings" },
      ]}
      gradient={["#0c3d2c", "#07231a"]}
    />
  );
}
