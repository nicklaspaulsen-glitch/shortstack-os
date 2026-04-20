"use client";

import { Monitor } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function AgentDesktopPage() {
  return (
    <ComingSoon
      title="Agent Desktop"
      tagline="Your AI agents, living on your actual desktop — clicking, typing, and working alongside you."
      icon={Monitor}
      eta="~6 weeks"
      features={[
        "Electron-based companion app runs agents locally against any desktop tool",
        "Stream a live view of what each agent is clicking and reading",
        "Agents can operate browser tabs, Slack, Notion, Excel — anything on screen",
        "Per-client isolated sandboxes so no data ever crosses",
        "Record and replay any agent session for training and audits",
        "Hybrid mode: take over the cursor at any time and hand back to the agent",
      ]}
      alternatives={[
        { label: "Trinity Console", href: "/dashboard/trinity" },
        { label: "Automate Hub", href: "/dashboard/automate" },
        { label: "Download Desktop App", href: "/dashboard/download" },
      ]}
      gradient={["#2c1a55", "#1a1033"]}
    />
  );
}
