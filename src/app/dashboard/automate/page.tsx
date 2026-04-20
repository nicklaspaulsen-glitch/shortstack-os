"use client";

import { useAuth } from "@/lib/auth-context";
import SectionHub from "@/components/dashboard/section-hub";
import {
  Zap, GitBranch, Bot, ListOrdered, Clock,
  Link2, Webhook, Plus, RotateCcw,
} from "lucide-react";

export default function AutomateHubPage() {
  useAuth();

  return (
    <SectionHub
      section="automate"
      title="Automate"
      eyebrow="Section · AI & workflows"
      subtitle="Wire up agents, workflows, and integrations so your business runs itself."
      heroIcon={<Zap size={22} />}
      heroGradient="blue"
      quickActions={[
        { label: "Create Workflow", href: "/dashboard/workflows", icon: Plus },
        { label: "New Agent", href: "/dashboard/services", icon: Bot },
        { label: "Schedule Task", href: "/dashboard/automations", icon: Clock },
        { label: "Add Integration", href: "/dashboard/integrations", icon: Link2 },
      ]}
      stats={[
        { label: "Active Workflows", key: "active_workflows", icon: Zap, color: "text-blue-400" },
        { label: "Runs (7d)", key: "runs_week", icon: RotateCcw, color: "text-emerald-400" },
        { label: "Agents", key: "agents", icon: Bot, color: "text-purple-400" },
        { label: "Integrations", key: "integrations", icon: Link2, color: "text-amber-400" },
      ]}
      tools={[
        {
          slug: "workflows",
          label: "Workflows",
          description: "Multi-step automations that run on triggers.",
          href: "/dashboard/workflows",
          icon: Zap,
        },
        {
          slug: "workflow-builder",
          label: "Flow Builder",
          description: "Visual drag-and-drop workflow editor.",
          href: "/dashboard/workflow-builder",
          icon: GitBranch,
        },
        {
          slug: "agents",
          label: "Agents",
          description: "Long-running AI agents that act on your behalf.",
          href: "#",
          icon: Bot,
          comingSoon: true,
        },
        {
          slug: "sequences",
          label: "Sequences",
          description: "Timed drip sequences across channels.",
          href: "/dashboard/sequences",
          icon: ListOrdered,
        },
        {
          slug: "scheduled-tasks",
          label: "Scheduled Tasks",
          description: "Run tasks on a cron schedule.",
          href: "#",
          icon: Clock,
          comingSoon: true,
        },
        {
          slug: "integrations",
          label: "Integrations",
          description: "Connect your existing tools and socials.",
          href: "/dashboard/integrations",
          icon: Link2,
        },
        {
          slug: "webhooks",
          label: "Webhooks",
          description: "Trigger workflows from external events.",
          href: "/dashboard/webhooks",
          icon: Webhook,
        },
      ]}
    />
  );
}
