"use client";

import { useAuth } from "@/lib/auth-context";
import SectionHub from "@/components/dashboard/section-hub";
import type { RollingPreviewItem } from "@/components/RollingPreview";
import {
  DollarSign, Send, Search, Phone, Headphones, MessagesSquare,
  ClipboardList, ListOrdered, Users, CreditCard, FileCheck,
  TrendingUp, Award, Target, Calendar, FileText, Plus,
  MessageSquare, Users2, Activity,
} from "lucide-react";

// Text-card previews representing live sales artefacts — cold emails,
// proposals, pipeline snapshots, booked demos — so it reads as a
// working pipeline rather than stock photography.
const SALES_HUB_PREVIEW: RollingPreviewItem[] = [
  { id: "sh1", tag: "Cold Email", title: "Quick idea for {Company}'s Q2", text: "14-line outbound with problem framing + 2 proof points. 8.4% reply rate in our test set." },
  { id: "sh2", tag: "AI Caller", title: "Outbound to 400 warm leads today", text: "ElevenLabs voice agent handling discovery calls + booking demos. 22 booked so far." },
  { id: "sh3", tag: "DM Sequence", title: "IG → DM → Cal.com in 3 touches", text: "Engages on story → replies to poll → books 15-min fit call. Autopilot." },
  { id: "sh4", tag: "Proposal", title: "$12k retainer: 90-day growth sprint", text: "Branded proposal with e-signature, scope, milestones and an embedded Loom walkthrough." },
  { id: "sh5", tag: "Forecast", title: "Pipeline: $184k weighted, $412k raw", text: "32 deals in flight across 4 stages — win-probability adjusted monthly." },
  { id: "sh6", tag: "Scraper", title: "650 coffee-shop owners, LA area", text: "Enriched with owner name, email, IG handle and last Yelp review." },
  { id: "sh7", tag: "Sequence", title: "5-step outbound: email → DM → call", text: "Branching sequence that stops on reply and hands off to Slack for human takeover." },
  { id: "sh8", tag: "CRM", title: "+18 new contacts synced from Gmail", text: "Auto-enriched with company, role, LinkedIn and last-touch timestamps." },
  { id: "sh9", tag: "Deals", title: "Acme Co. — Stage 4/5, close 15 May", text: "Won probability 72%. Next step: legal redline on MSA." },
  { id: "sh10", tag: "Scheduling", title: "12 demos on the books this week", text: "Round-robin across 3 reps with auto-reminders 24h and 1h out." },
  { id: "sh11", tag: "Ad Campaign", title: "Meta retarget: $2.14 CAC, 3.1x ROAS", text: "Creative rotation across 4 hooks. Reached 340k people at $7/1000." },
  { id: "sh12", tag: "Commissions", title: "Rep payouts: $18.4k due Friday", text: "Split by deal, stage and override — one click exports to payroll." },
];

export default function SalesHubPage() {
  // useAuth guards the page via the dashboard layout; access ctx so any
  // client-side personalization stays scoped to the active session.
  useAuth();

  return (
    <SectionHub
      section="sales"
      title="Sales"
      eyebrow="Section · Revenue pipeline"
      subtitle="Every tool you need to find leads, run outreach, close deals, and track MRR."
      heroIcon={<DollarSign size={22} />}
      heroGradient="green"
      preview={{
        items: SALES_HUB_PREVIEW,
        variant: "text",
        aspectRatio: "16:9",
        opacity: 0.5,
        caption: "Leads, outreach, deals, commissions — your revenue stack",
      }}
      quickActions={[
        { label: "Add Lead", href: "/dashboard/leads", icon: Plus },
        { label: "Find Leads", href: "/dashboard/scraper", icon: Search },
        { label: "Send Outreach", href: "/dashboard/outreach-hub", icon: Send },
        { label: "Create Proposal", href: "/dashboard/proposals", icon: FileText },
      ]}
      stats={[
        { label: "Leads", key: "leads", icon: Users2, color: "text-blue-400" },
        { label: "Outreach (7d)", key: "outreach_week", icon: Send, color: "text-purple-400" },
        { label: "Active Deals", key: "active_deals", icon: Activity, color: "text-amber-400" },
        { label: "MRR", key: "mrr", icon: DollarSign, color: "text-emerald-400", format: "currency" },
      ]}
      tools={[
        {
          slug: "outreach-hub",
          label: "Leads & Outreach",
          description: "Multi-channel cold outreach across email, DM, SMS.",
          href: "/dashboard/outreach-hub",
          icon: Send,
        },
        {
          slug: "scraper",
          label: "Lead Finder",
          description: "Scrape prospects from the web into your pipeline.",
          href: "/dashboard/scraper",
          icon: Search,
        },
        {
          slug: "eleven-agents",
          label: "AI Caller",
          description: "Let ElevenLabs voice agents call leads for you.",
          href: "/dashboard/eleven-agents",
          icon: Phone,
        },
        {
          slug: "voice-receptionist",
          label: "Voice AI",
          description: "24/7 AI receptionist answering inbound calls.",
          href: "/dashboard/voice-receptionist",
          icon: Headphones,
        },
        {
          slug: "dm-controller",
          label: "DM Controller",
          description: "Orchestrate outbound DMs across IG/FB/LinkedIn.",
          href: "/dashboard/dm-controller",
          icon: MessageSquare,
        },
        {
          slug: "conversations",
          label: "Conversations",
          description: "Unified inbox for every reply across channels.",
          href: "/dashboard/conversations",
          icon: MessagesSquare,
        },
        {
          slug: "outreach-logs",
          label: "Outreach Logs",
          description: "Raw log of every message sent and its status.",
          href: "/dashboard/outreach-logs",
          icon: ClipboardList,
        },
        {
          slug: "sequences",
          label: "Sequences",
          description: "Drip campaigns with branching and delays.",
          href: "/dashboard/sequences",
          icon: ListOrdered,
        },
        {
          slug: "crm",
          label: "CRM",
          description: "Contacts, stages, and pipeline health.",
          href: "/dashboard/crm",
          icon: Users,
        },
        {
          slug: "deals",
          label: "Deals",
          description: "Track deal value, stage, and win probability.",
          href: "/dashboard/deals",
          icon: CreditCard,
        },
        {
          slug: "proposals",
          label: "Proposals",
          description: "Branded proposals with e-signature and tracking.",
          href: "/dashboard/proposals",
          icon: FileCheck,
        },
        {
          slug: "forecast",
          label: "Forecast",
          description: "Pipeline forecasting with weighted stages.",
          href: "/dashboard/forecast",
          icon: TrendingUp,
        },
        {
          slug: "commission-tracker",
          label: "Commissions",
          description: "Calculate and pay out sales commissions.",
          href: "/dashboard/commission-tracker",
          icon: Award,
        },
        {
          slug: "ads-manager",
          label: "Ads Manager",
          description: "Plan, launch, and track paid ad campaigns.",
          href: "/dashboard/ads-manager",
          icon: Target,
        },
        {
          slug: "scheduling",
          label: "Scheduling",
          description: "Book calls with clients and prospects.",
          href: "/dashboard/scheduling",
          icon: Calendar,
        },
      ]}
    />
  );
}
