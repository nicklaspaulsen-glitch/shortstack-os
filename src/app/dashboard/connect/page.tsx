"use client";

import { useAuth } from "@/lib/auth-context";
import SectionHub from "@/components/dashboard/section-hub";
import type { RollingPreviewItem } from "@/components/RollingPreview";
import {
  Link2, Globe, MessageSquare, FileText, Target, Bot, Bell,
  ShieldCheck, Settings, Puzzle, Webhook, Key, Store, Plus,
  Users as UsersIcon,
} from "lucide-react";

// Blueprint cards of integrations the agency can wire up. Teal/green
// gradient in the hero so it reads as "plug into the world".
const CONNECT_HUB_PREVIEW: RollingPreviewItem[] = [
  { id: "ch1", tag: "Integration", title: "Google Business Profile linked", text: "Auto-publishing posts, tracking reviews, responding to Q&A." },
  { id: "ch2", tag: "Discord", title: "ShortStack bot deployed to 3 servers", text: "Moderates spam, answers FAQs, logs leads from #general." },
  { id: "ch3", tag: "Notion", title: "Synced 42 client pages → Notion", text: "Two-way sync: content plans live in Notion, jobs execute here." },
  { id: "ch4", tag: "Socials", title: "IG, TikTok, LinkedIn all connected", text: "Single scheduler pushes to all three with platform-native formatting." },
  { id: "ch5", tag: "Competitors", title: "Tracking 18 competitor accounts", text: "Daily digest of their new ads, pricing changes, and viral posts." },
  { id: "ch6", tag: "Telegram", title: "@leadengine_bot answering 24/7", text: "Qualifies leads in DMs, hands off to a human on complex asks." },
  { id: "ch7", tag: "Webhook", title: "Stripe → CRM → Slack alert", text: "Every new paying customer triggers a celebration + pipeline update." },
  { id: "ch8", tag: "API Key", title: "Chrome extension key rotated", text: "Old key revoked, new one pushed to all installed extensions." },
  { id: "ch9", tag: "Notifications", title: "Sub only to P0/P1 events", text: "Slack + email for critical, email-only for the rest." },
  { id: "ch10", tag: "Marketplace", title: "Installed: HubSpot CRM sync", text: "Contacts bi-directional, deals one-way (HubSpot is source of truth)." },
  { id: "ch11", tag: "System", title: "All integrations green · 4h ago", text: "Zernio, Resend, Stripe, Supabase, OpenRouter — nominal." },
  { id: "ch12", tag: "OAuth", title: "Meta Ads token refreshed", text: "Silent refresh ran at 03:12 UTC — zero API downtime." },
];

export default function ConnectHubPage() {
  useAuth();

  return (
    <SectionHub
      section="connect"
      title="Connect"
      eyebrow="Section · Integrations"
      subtitle="Plug ShortStack into the apps your agency already uses."
      heroIcon={<Puzzle size={22} />}
      heroGradient="ocean"
      preview={{
        items: CONNECT_HUB_PREVIEW,
        variant: "text",
        aspectRatio: "16:9",
        opacity: 0.5,
        caption: "Socials, chat bots, webhooks, marketplace — one hub",
      }}
      quickActions={[
        { label: "New Integration", href: "/dashboard/integrations", icon: Plus },
        { label: "Install Extension", href: "/downloads/shortstack-extension.zip", icon: Puzzle },
        { label: "Configure Webhook", href: "/dashboard/webhooks", icon: Webhook },
        { label: "Browse Marketplace", href: "/dashboard/marketplace", icon: Store },
      ]}
      stats={[
        { label: "Integrations", key: "active_integrations", icon: Link2, color: "text-emerald-400" },
        { label: "Connected Accounts", key: "social_accounts", icon: UsersIcon, color: "text-blue-400" },
        { label: "Webhooks Live", key: "webhooks_live", icon: Webhook, color: "text-purple-400" },
        { label: "API Keys", key: "api_keys", icon: Key, color: "text-amber-400" },
      ]}
      tools={[
        {
          slug: "google-business",
          label: "Google Biz",
          description: "Manage your Google Business Profile from here.",
          href: "/dashboard/google-business",
          icon: Globe,
        },
        {
          slug: "discord",
          label: "Discord",
          description: "Deploy the ShortStack bot to your Discord servers.",
          href: "/dashboard/discord",
          icon: MessageSquare,
        },
        {
          slug: "notion-sync",
          label: "Notion",
          description: "Two-way sync with your Notion workspace.",
          href: "/dashboard/notion-sync",
          icon: FileText,
        },
        {
          slug: "integrations",
          label: "Socials",
          description: "IG, TikTok, LinkedIn, Facebook — one click each.",
          href: "/dashboard/integrations",
          icon: Link2,
        },
        {
          slug: "competitive-monitor",
          label: "Competitors",
          description: "Track competitor ads, posts, and pricing.",
          href: "/dashboard/competitive-monitor",
          icon: Target,
        },
        {
          slug: "telegram-bot",
          label: "Telegram Bot",
          description: "Run a 24/7 Telegram bot for each client.",
          href: "/dashboard/telegram-bot",
          icon: Bot,
        },
        {
          slug: "notifications",
          label: "Notifications",
          description: "Route alerts to Slack, email, and more.",
          href: "/dashboard/notifications",
          icon: Bell,
        },
        {
          slug: "system-status",
          label: "System Status",
          description: "Live health of every connected provider.",
          href: "/dashboard/system-status",
          icon: ShieldCheck,
        },
        {
          slug: "settings",
          label: "Settings",
          description: "Global preferences, API keys, and more.",
          href: "/dashboard/settings",
          icon: Settings,
        },
      ]}
    />
  );
}
