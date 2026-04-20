"use client";

import { LayoutGrid } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function WorkspacesPage() {
  return (
    <ComingSoon
      title="Workspaces"
      tagline="Isolated environments per client, brand, or business line — with their own agents and data."
      icon={LayoutGrid}
      eta="~5 weeks"
      features={[
        "One-click workspace switcher in the top nav",
        "Strictly isolated data: clients, leads, invoices never bleed across",
        "Per-workspace brand kit, AI voice, and agent personalities",
        "Team seats assignable per-workspace with role-based access",
        "Unified billing with per-workspace usage split on invoice",
        "Export or clone an entire workspace for onboarding new teams",
      ]}
      alternatives={[
        { label: "Clients", href: "/dashboard/clients" },
        { label: "Team", href: "/dashboard/team" },
        { label: "Settings", href: "/dashboard/settings" },
      ]}
      gradient={["#3d3020", "#1a1611"]}
    />
  );
}
