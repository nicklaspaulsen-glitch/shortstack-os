"use client";

import { SlidersHorizontal } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function AgentControlsPage() {
  return (
    <ComingSoon
      title="Agent Controls"
      tagline="Granular permission rails for every AI agent running in your org."
      icon={SlidersHorizontal}
      eta="~4 weeks"
      features={[
        "Permission matrix per agent: what data can it see, what actions can it take?",
        "Spend limits — cap per agent, per day, per customer",
        "Action approval gates for anything involving real money or external sends",
        "Time-of-day and day-of-week schedule restrictions",
        "Audit trail of every denied action with reasoning",
        "Instant kill switch to pause all agents during incidents",
      ]}
      alternatives={[
        { label: "Trinity Console", href: "/dashboard/trinity" },
        { label: "Settings → Security", href: "/dashboard/settings" },
        { label: "Automate Hub", href: "/dashboard/automate" },
      ]}
      gradient={["#4a2285", "#1a1033"]}
    />
  );
}
