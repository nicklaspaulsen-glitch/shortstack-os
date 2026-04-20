"use client";

import { useAuth } from "@/lib/auth-context";
import SectionHub from "@/components/dashboard/section-hub";
import {
  DollarSign, Send, Search, Phone, Headphones, MessagesSquare,
  ClipboardList, ListOrdered, Users, CreditCard, FileCheck,
  TrendingUp, Award, Target, Calendar, FileText, Plus,
  MessageSquare, Users2, Activity,
} from "lucide-react";

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
