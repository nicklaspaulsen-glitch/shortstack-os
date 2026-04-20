"use client";

import { ClipboardList } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function ClientReportsPage() {
  return (
    <ComingSoon
      title="Client Reports"
      tagline="Every client gets a beautiful monthly report — no spreadsheet duty required."
      icon={ClipboardList}
      eta="~3 weeks"
      features={[
        "Per-client recurring reports with their logo and brand kit",
        "Include ads performance, content engagement, leads generated, and ROI",
        "AI-written narrative comparing month-over-month performance",
        "Clients view reports live in their portal with drill-down charts",
        "Signature & approval flow so clients can sign off on deliverables",
        "Auto-generated invoices attached when retainer hours are billable",
      ]}
      alternatives={[
        { label: "Reports", href: "/dashboard/reports" },
        { label: "Client Portal", href: "/dashboard/portal" },
        { label: "Clients", href: "/dashboard/clients" },
      ]}
      gradient={["#2c1a55", "#1a1033"]}
    />
  );
}
