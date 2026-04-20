"use client";

import { useAuth } from "@/lib/auth-context";
import SectionHub from "@/components/dashboard/section-hub";
import type { RollingPreviewItem } from "@/components/RollingPreview";
import {
  Zap, GitBranch, Bot, ListOrdered, Clock,
  Link2, Webhook, Plus, RotateCcw,
} from "lucide-react";

// Text-card previews — automations are workflows and triggers, so we
// render them as "blueprint" cards rather than images.
const AUTOMATE_HUB_PREVIEW: RollingPreviewItem[] = [
  { id: "ah1", tag: "Workflow", title: "New lead → Slack + CRM + first-touch email", text: "Triggered when a prospect fills your contact form. Fires in under 2s." },
  { id: "ah2", tag: "Sequence", title: "5-step nurture after trial signup", text: "Days 1 / 3 / 7 / 14 / 21 — adjusts cadence based on engagement." },
  { id: "ah3", tag: "Scheduled", title: "Post LinkedIn carousel every Tue 9am", text: "Auto-generates graphic from latest blog post and schedules in buffer." },
  { id: "ah4", tag: "Webhook", title: "Stripe charge → send invoice + issue license", text: "End-to-end checkout plumbing with no servers to manage." },
  { id: "ah5", tag: "Agent", title: "Inbox triage every 15 minutes", text: "Classifies, auto-replies to simple asks, flags priority messages for you." },
  { id: "ah6", tag: "Integration", title: "Sync Notion tasks ↔ Todoist ↔ Calendar", text: "Bi-directional sync with conflict-resolution and change history." },
  { id: "ah7", tag: "Workflow", title: "Cold DM → auto-book a Cal.com demo", text: "Replies with availability, books the slot, adds to CRM — all autonomous." },
  { id: "ah8", tag: "Sequence", title: "Win-back sleeping customers (30+ days)", text: "Detects dormancy, sends 3 personalised touches, re-engages 18% on avg." },
  { id: "ah9", tag: "Scheduled", title: "Monthly revenue report to the team", text: "Pulls Stripe, GA4 and HubSpot data; ships a branded PDF on day 1." },
  { id: "ah10", tag: "Webhook", title: "GitHub issue → create Linear ticket", text: "With assignee mapping and label inheritance — no more duplicate entry." },
  { id: "ah11", tag: "Agent", title: "Daily brief: what moved, what's next", text: "Agent aggregates KPIs and blockers across tools and ships a 60-second read." },
  { id: "ah12", tag: "Integration", title: "Shopify refund → Zendesk + accounting", text: "Closes the loop on refunds so nothing slips through the cracks." },
];

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
      preview={{
        items: AUTOMATE_HUB_PREVIEW,
        variant: "text",
        aspectRatio: "16:9",
        opacity: 0.5,
        caption: "Workflows, agents, sequences — building blocks of autopilot",
      }}
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
