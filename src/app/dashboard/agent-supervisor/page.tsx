"use client";

import { ShieldCheck } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function AgentSupervisorPage() {
  return (
    <ComingSoon
      title="Agent Supervisor"
      tagline="Watch every AI agent's work in real time — approve, coach, or intervene on the fly."
      icon={ShieldCheck}
      eta="~3 weeks"
      features={[
        "Live stream of every agent action with video-like playback",
        "Approval queue for high-stakes actions (emails, payments, deletes)",
        "Quality scoring per agent run with trend charts",
        "Intervention mode — pause, edit, or re-run any agent step",
        "Coaching feedback loop trains agents against your rubric",
        "Incident log with root-cause analysis when an agent misfires",
      ]}
      alternatives={[
        { label: "Trinity Console", href: "/dashboard/trinity" },
        { label: "Agent Office", href: "/dashboard/automate" },
        { label: "Workflows", href: "/dashboard/workflows" },
      ]}
      gradient={["#14596c", "#041926"]}
    />
  );
}
