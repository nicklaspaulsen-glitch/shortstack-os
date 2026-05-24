"use client";

import type { Icon } from "@phosphor-icons/react";
import { ArrowCounterClockwise, ArrowUpRight, Bell, BookOpen, Briefcase, Buildings, Calculator, Calendar, CaretDown, CaretLeft, ChartBar, Chat, Chats, ClipboardText, CreditCard, Crown, CurrencyDollar, DeviceMobile, DownloadSimple, Envelope, EnvelopeSimple, FileText, FilmStrip, Flask, FolderOpen, Gear, Gift, GitBranch, Globe, GlobeHemisphereWest, Headphones, Heart, House, Image, Key, Layout, Lifebuoy, Lightning, ListNumbers, MagnifyingGlass, Medal, Microphone, Monitor, Newspaper, Palette, PaperPlaneTilt, PenNib, Pencil, Phone, Plug, PlugsConnected, Pulse, PushPin, PuzzlePiece, Receipt, Robot, ShareNetwork, ShieldCheck, SignOut, SlidersHorizontal, Sparkle, SquaresFour, Stack, Star, Storefront, Target, Tray, TrendUp, UploadSimple, Users, UsersThree, X } from "@phosphor-icons/react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useWhiteLabel } from "@/lib/white-label-context";
import { getPlanConfig } from "@/lib/plan-config";
import { BRAND } from "@/lib/brand-config";
import DesktopIndicator from "@/components/desktop-indicator";
import NavIcon3D from "@/components/brand/nav-icon-3d";
import { useState, useEffect, useMemo, useRef } from "react";
import AdminProfileSwitcher from "@/components/admin-profile-switcher";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
  section?: string;
  sub?: string;
  /**
   * Visibility tier:
   *   1 = Core — always visible (dashboard, clients, inbox, analytics, crm, calendar)
   *   2 = Main features — visible by default (~14 items)
   *   3 = Advanced — hidden until "Show more" is toggled
   *   4 = Gear/admin — always visible but rendered in footer section
   * Untagged items default to tier 3 to reduce noise.
   */
  tier?: 1 | 2 | 3 | 4;
  /**
   * settingsOnly = true means the item is tier 4 (excluded from main nav)
   * but also excluded from the sidebar footer strip. It is only reachable
   * from the /dashboard/settings hub page. Use this for pages that ARE
   * genuinely configuration (Billing, Domains, API Keys, etc.) but do not
   * need a permanent sidebar footprint.
   */
  settingsOnly?: boolean;
}

const navItems: NavItem[] = [
  // ── Core (tier 1 — always visible) ──
  { label: "Dashboard",  href: "/dashboard",           icon: <NavIcon3D name="SquaresFour" size={16} />, roles: ["admin", "team_member"], tier: 1 },
  { label: "Clients",    href: "/dashboard/clients",   icon: <NavIcon3D name="Users"           size={16} />, roles: ["admin", "team_member"], tier: 1 },
  { label: "Analytics",  href: "/dashboard/analytics", icon: <NavIcon3D name="ChartBar"       size={16} />, roles: ["admin"],                tier: 1 },

  // ── Create (video + AI content creation) ──
  { label: "AI Video",     href: "/dashboard/ai-video",            icon: <NavIcon3D name="FilmStrip"      size={16} />, roles: ["admin", "founder", "agency", "team_member"], section: "Create", tier: 2 },
  { label: "Video Editor", href: "/dashboard/video-editor",        icon: <NavIcon3D name="FilmStrip"      size={16} />, roles: ["admin", "founder", "agency", "team_member"],                   tier: 2 },
  { label: "Thumbnails",   href: "/dashboard/thumbnail-generator", icon: <NavIcon3D name="Image" size={16} />, roles: ["admin", "team_member"],                                       tier: 2 },
  { label: "AI Studio",    href: "/dashboard/ai-studio",           icon: <NavIcon3D name="Sparkle"  size={16} />, roles: ["admin", "team_member"],                                       tier: 2 },

  // ── Reach ──
  { label: "Social",   href: "/dashboard/social-manager",  icon: <NavIcon3D name="ShareNetwork" size={16} />, roles: ["admin", "team_member"], section: "Reach", tier: 2 },
  { label: "Websites", href: "/dashboard/websites",         icon: <NavIcon3D name="Globe"  size={16} />, roles: ["admin", "team_member"],                  tier: 2 },

  // ── Revenue ──
  { label: "Ads",      href: "/dashboard/ads-manager", icon: <NavIcon3D name="Target"  size={16} />, roles: ["admin"],                section: "Revenue", tier: 2 },
  { label: "CRM",      href: "/dashboard/crm",         icon: <NavIcon3D name="Users"   size={16} />, roles: ["admin", "team_member"],                    tier: 2 },
  { label: "Invoices", href: "/dashboard/invoices",    icon: <NavIcon3D name="Receipt" size={16} />, roles: ["admin"],                                   tier: 2 },

  // ── Operate ──
  { label: "Agents",       href: "/dashboard/agent-office",    icon: <NavIcon3D name="UsersThree" size={16} />, roles: ["admin", "team_member"], section: "Operate", tier: 2 },
  { label: "Agency 3D",   href: "/dashboard/3d",              icon: <NavIcon3D name="Boxes"      size={16} />, roles: ["admin", "team_member"],                    tier: 2 },
  { label: "Integrations", href: "/dashboard/integrations-hub",icon: <NavIcon3D name="Plug"       size={16} />, roles: ["admin"],                                   tier: 2 },

  // ── Gear / Admin ──
  { label: "Gear", href: "/dashboard/settings", icon: <NavIcon3D name="Gear" size={16} />, roles: ["admin"], tier: 4 },

  // ── Everything else — reachable via /dashboard/settings hub only ──
  { label: "Tray",              href: "/dashboard/inbox",              icon: <NavIcon3D name="Tray"           size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Calendar",           href: "/dashboard/calendar",           icon: <NavIcon3D name="Calendar"        size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Generations",        href: "/dashboard/generations",        icon: <NavIcon3D name="Sparkle"        size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  // Community — archived (May 2026)
  { label: "Content Plan",       href: "/dashboard/content-plan",       icon: <NavIcon3D name="Calendar"        size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Notifications",      href: "/dashboard/notifications",      icon: <NavIcon3D name="Bell"            size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Team",               href: "/dashboard/team",               icon: <NavIcon3D name="UsersThree"      size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Reports",            href: "/dashboard/reports",            icon: <NavIcon3D name="FileText"        size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Outreach",           href: "/dashboard/outreach-hub",       icon: <NavIcon3D name="PaperPlaneTilt"            size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Lead Pipeline",      href: "/dashboard/leadgen-pipeline",   icon: <NavIcon3D name="SquaresFour"          size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Lead Finder",        href: "/dashboard/scraper",            icon: <NavIcon3D name="MagnifyingGlass"          size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "AI Caller",          href: "/dashboard/eleven-agents",      icon: <NavIcon3D name="Phone"           size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Dialer",             href: "/dashboard/dialer",             icon: <NavIcon3D name="Phone"           size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Voice AI",           href: "/dashboard/voice-receptionist", icon: <NavIcon3D name="Headphones"      size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Voicemail Drop",     href: "/dashboard/voicemail-drop",     icon: <NavIcon3D name="Phone"           size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Voice Studio",       href: "/dashboard/voice-studio",       icon: <NavIcon3D name="Microphone"             size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "DM Controller",      href: "/dashboard/dm-controller",      icon: <NavIcon3D name="PaperPlaneTilt"            size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Conversations",      href: "/dashboard/conversations",      icon: <NavIcon3D name="Chats"  size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Outreach Feed",      href: "/dashboard/outreach-feed",      icon: <NavIcon3D name="Chats"  size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Sales Coach",        href: "/dashboard/coach",              icon: <NavIcon3D name="Medal"           size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Outreach Logs",      href: "/dashboard/outreach-logs",      icon: <NavIcon3D name="ClipboardText"   size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Cold Email",         href: "/dashboard/cold-email",         icon: <NavIcon3D name="EnvelopeSimple"        size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Sequences",          href: "/dashboard/sequences",          icon: <NavIcon3D name="ListNumbers"     size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Lead Sources",       href: "/dashboard/lead-sources",       icon: <NavIcon3D name="GitBranch"       size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Leads",              href: "/dashboard/leads",              icon: <NavIcon3D name="Target"          size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Deals",              href: "/dashboard/deals",              icon: <NavIcon3D name="CreditCard"      size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Proposals",          href: "/dashboard/proposals",          icon: <NavIcon3D name="FileText"       size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Trinity",            href: "/dashboard/trinity",            icon: <NavIcon3D name="Lightning"             size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Forecast",           href: "/dashboard/forecast",           icon: <NavIcon3D name="TrendUp"      size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Affiliates",         href: "/dashboard/affiliates",         icon: <NavIcon3D name="Medal"           size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Scheduling",         href: "/dashboard/scheduling",         icon: <NavIcon3D name="Calendar"        size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Meetings",           href: "/dashboard/meetings",           icon: <NavIcon3D name="Calendar"        size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  // Courses — archived (May 2026)
  { label: "Vertical Templates", href: "/dashboard/verticals",          icon: <NavIcon3D name="Briefcase"       size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "AI Copywriter",      href: "/dashboard/copywriter",         icon: <NavIcon3D name="Pencil"             size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Email Composer",     href: "/dashboard/email-composer",     icon: <NavIcon3D name="Envelope"            size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Email Templates",    href: "/dashboard/email-templates",    icon: <NavIcon3D name="EnvelopeSimple"        size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "SMS Templates",      href: "/dashboard/sms-templates",      icon: <NavIcon3D name="DeviceMobile"      size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Newsletter",         href: "/dashboard/newsletter",         icon: <NavIcon3D name="Newspaper"       size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Brand Voice",        href: "/dashboard/brand-voice",        icon: <NavIcon3D name="BookOpen"        size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Brand Kit",          href: "/dashboard/brand-kit",          icon: <NavIcon3D name="Palette"         size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Landing Pages",      href: "/dashboard/landing-pages",      icon: <NavIcon3D name="Layout"  size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Funnels",            href: "/dashboard/funnels",            icon: <NavIcon3D name="GitBranch"       size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Forms & Surveys",    href: "/dashboard/forms",              icon: <NavIcon3D name="ClipboardText"  size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Intake Forms",       href: "/dashboard/intake",             icon: <NavIcon3D name="Lightning"             size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Social Studio",      href: "/dashboard/social-studio",      icon: <NavIcon3D name="Sparkle"        size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Design Studio",      href: "/dashboard/design-studio",      icon: <NavIcon3D name="PenNib"         size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Carousel Gen",       href: "/dashboard/carousel-generator", icon: <NavIcon3D name="Stack"          size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Preset Library",     href: "/dashboard/video-editor/library", icon: <NavIcon3D name="Layout" size={16} />, roles: ["admin", "founder", "agency", "team_member"], settingsOnly: true },
  { label: "AI Agents",          href: "/dashboard/services",           icon: <NavIcon3D name="Sparkle"        size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Workflows",          href: "/dashboard/workflows",          icon: <NavIcon3D name="Lightning"             size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Flow Builder",       href: "/dashboard/workflow-builder",   icon: <NavIcon3D name="GitBranch"       size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Automations",        href: "/dashboard/automations",        icon: <NavIcon3D name="ArrowCounterClockwise"       size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "WhatsApp",           href: "/dashboard/whatsapp",           icon: <NavIcon3D name="Chat"   size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Board",              href: "/dashboard/workspace/board",    icon: <NavIcon3D name="SquaresFour"          size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Whiteboard",         href: "/dashboard/workspace/whiteboard", icon: <NavIcon3D name="SquaresFour"   size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Files",              href: "/dashboard/workspace/files",    icon: <NavIcon3D name="FolderOpen"      size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Workspaces",         href: "/dashboard/workspaces",         icon: <NavIcon3D name="Buildings"       size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Production",         href: "/dashboard/production",         icon: <NavIcon3D name="SquaresFour"          size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Projects",           href: "/dashboard/projects",           icon: <NavIcon3D name="SquaresFour"          size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Financials",         href: "/dashboard/financials",         icon: <NavIcon3D name="ChartBar"       size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Invoice Templates",  href: "/dashboard/invoice-templates",  icon: <NavIcon3D name="FileText"        size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Subaccounts",        href: "/dashboard/subaccounts",        icon: <NavIcon3D name="Buildings"       size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Pricing",            href: "/dashboard/pricing",            icon: <NavIcon3D name="CreditCard"      size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "White Label",        href: "/dashboard/white-label",        icon: <NavIcon3D name="Palette"         size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Billing",            href: "/dashboard/billing",            icon: <NavIcon3D name="CreditCard"      size={16} />, roles: ["admin", "founder", "agency", "team_member"], settingsOnly: true },
  { label: "Usage & Tokens",     href: "/dashboard/usage",              icon: <NavIcon3D name="Lightning"             size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Phone & Email",      href: "/dashboard/phone-email",        icon: <NavIcon3D name="Phone"           size={16} />, roles: ["admin", "founder", "agency", "team_member"], settingsOnly: true },
  { label: "Phone Setup",        href: "/dashboard/phone-setup",        icon: <NavIcon3D name="Phone"           size={16} />, roles: ["admin", "founder", "agency", "team_member"], settingsOnly: true },
  { label: "Envelope Setup",         href: "/dashboard/mail-setup",         icon: <NavIcon3D name="Envelope"            size={16} />, roles: ["admin", "founder", "agency", "team_member"], settingsOnly: true },
  { label: "Domains",            href: "/dashboard/domains",            icon: <NavIcon3D name="GlobeHemisphereWest"          size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Client Health",      href: "/dashboard/client-health",      icon: <NavIcon3D name="Heart"           size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Reviews",            href: "/dashboard/reviews",            icon: <NavIcon3D name="Star"            size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Tickets",            href: "/dashboard/tickets",            icon: <NavIcon3D name="Lifebuoy"        size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Referrals",          href: "/dashboard/referrals",          icon: <NavIcon3D name="Gift"            size={16} />, roles: ["admin"],                                   settingsOnly: true },
  // ROI Calculator — archived (May 2026)
  { label: "Monitor",            href: "/dashboard/monitor",            icon: <NavIcon3D name="Pulse"        size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Reports Gen",        href: "/dashboard/report-generator",   icon: <NavIcon3D name="ChartBar"   size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Marketplace",        href: "/dashboard/marketplace",        icon: <NavIcon3D name="Storefront"           size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "DownloadSimple Desktop",   href: "/dashboard/download",           icon: <NavIcon3D name="DownloadSimple"        size={16} />, roles: ["admin", "team_member"],                    settingsOnly: true },
  { label: "Google Biz",         href: "/dashboard/google-business",    icon: <NavIcon3D name="Globe"           size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Discord",            href: "/dashboard/discord",            icon: <NavIcon3D name="Chat"   size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Notion",             href: "/dashboard/notion-sync",        icon: <NavIcon3D name="FileText"        size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Telegram",           href: "/dashboard/telegram",           icon: <NavIcon3D name="Robot"             size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "PlugsConnected",           href: "/dashboard/webhooks",           icon: <NavIcon3D name="PlugsConnected"         size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "API Keys",           href: "/dashboard/api/keys",           icon: <NavIcon3D name="Key"             size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "API PlugsConnected",       href: "/dashboard/api/webhooks",       icon: <NavIcon3D name="PlugsConnected"         size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "API Docs",           href: "/dashboard/api-docs",           icon: <NavIcon3D name="FileText"        size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Pulse Log",       href: "/dashboard/activity-log",       icon: <NavIcon3D name="ClipboardText"   size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Audit Trail",        href: "/dashboard/audit",              icon: <NavIcon3D name="ShieldCheck"     size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Public Status",      href: "/dashboard/admin/status",       icon: <NavIcon3D name="Pulse"        size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "Admin Hub",          href: "/dashboard/admin",              icon: <NavIcon3D name="ShieldCheck"     size={16} />, roles: ["admin"],                                   settingsOnly: true },
  { label: "System Status",      href: "/dashboard/system-status",      icon: <NavIcon3D name="ShieldCheck"     size={16} />, roles: ["admin"],                                   settingsOnly: true },
  // ── Promoted from tier-2 (still reachable from /dashboard/settings hub) ──
  { label: "Enemy Tracker",   href: "/dashboard/enemy-tracker",       icon: <NavIcon3D name="Eye"        size={16} />, roles: ["admin", "team_member"], settingsOnly: true },
  { label: "Competitors",     href: "/dashboard/competitive-monitor", icon: <NavIcon3D name="Target"     size={16} />, roles: ["admin"],                settingsOnly: true },
  { label: "Script Lab",      href: "/dashboard/script-lab",          icon: <NavIcon3D name="Sparkle"   size={16} />, roles: ["admin", "team_member"], settingsOnly: true },
  { label: "Content Hub",     href: "/dashboard/content-library",     icon: <NavIcon3D name="FolderOpen" size={16} />, roles: ["admin", "team_member"], settingsOnly: true },
  { label: "Agent Command",   href: "/dashboard/agent-command",       icon: <NavIcon3D name="Robot"        size={16} />, roles: ["admin"],                settingsOnly: true },
  { label: "N8N",             href: "/dashboard/n8n",                 icon: <NavIcon3D name="PlugsConnected"    size={16} />, roles: ["admin"],                settingsOnly: true },

  // ── Client Portal (unchanged) ──
  { label: "Overview",      href: "/dashboard/portal",              icon: <NavIcon3D name="SquaresFour" size={16} />, roles: ["client"] },
  { label: "Agency Room",   href: "/dashboard/portal/agency-room",  icon: <NavIcon3D name="Users"           size={16} />, roles: ["client"] },
  { label: "Lead Engine",   href: "/dashboard/portal/leads",        icon: <NavIcon3D name="Sparkle"        size={16} />, roles: ["client"], section: "Grow" },
  { label: "Outreach",      href: "/dashboard/portal/outreach",     icon: <NavIcon3D name="PaperPlaneTilt"            size={16} />, roles: ["client"] },
  { label: "Conversations", href: "/dashboard/portal/outreach-feed",icon: <NavIcon3D name="Chats"  size={16} />, roles: ["client"] },
  { label: "Socials",       href: "/dashboard/portal/socials",      icon: <NavIcon3D name="Link"           size={16} />, roles: ["client"] },
  { label: "Content",       href: "/dashboard/portal/content",      icon: <NavIcon3D name="FilmStrip"            size={16} />, roles: ["client"], section: "Manage" },
  { label: "Uploads",       href: "/dashboard/portal/uploads",      icon: <NavIcon3D name="UploadSimple"          size={16} />, roles: ["client"] },
  { label: "Calendar",      href: "/dashboard/portal/calendar",     icon: <NavIcon3D name="Calendar"        size={16} />, roles: ["client"] },
  { label: "Reports",       href: "/dashboard/portal/reports",      icon: <NavIcon3D name="ChartBar"       size={16} />, roles: ["client"] },
  { label: "Invoices",      href: "/dashboard/portal/billing",      icon: <NavIcon3D name="CreditCard"      size={16} />, roles: ["client"] },
  { label: "Support",       href: "/dashboard/portal/support",      icon: <NavIcon3D name="Chat"   size={16} />, roles: ["client"] },
  { label: "Gear",      href: "/dashboard/portal/settings",     icon: <NavIcon3D name="Gear"        size={16} />, roles: ["client"] },
];

/* ─── Helper: check if a nav item is active ─────────────────────── */
function isItemActive(href: string, pathname: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

/* ─── Section header → hub page mapping. Sections with a value here
 * render as a clickable <Link> (expand/collapse moves to a chevron
 * button). Sections without a hub keep the all-button behavior.
 * May 16: cleared — all 6 hub pages (sales/create/visual/automate/
 * manage/connect) are archived and were 404ing on click. Section
 * headers now work as pure expand/collapse toggles. Re-add an entry
 * when a real hub page is built at that route. ──────────────────── */
const SECTION_HUB_HREF: Record<string, string> = {};

/* ─── Icon name → Lucide component (curated list that matches the
 * icon picker in the sidebar customizer). Unknown names fall back. ── */
const CUSTOM_ICON_MAP: Record<string, Icon> = {
  House, FilmStrip, Users, Phone, CurrencyDollar, ChartBar, Briefcase, Envelope,
  Globe, Robot, Lightning, Target, Crown, SquaresFour, Tray, Chat,
  Star, Calendar, FileText, PaperPlaneTilt, Gift, Heart, Calculator, Medal, Bell,
  Stack, Sparkle, Gear,
};

function renderCustomIcon(iconName: string | undefined, size = 16): React.ReactNode | null {
  if (!iconName) return null;
  const Cmp = CUSTOM_ICON_MAP[iconName];
  if (!Cmp) return null;
  return <Cmp size={size} />;
}

export default function Sidebar() {
  const pathname = usePathname() || "";
  const { profile, signOut, loading: authLoading } = useAuth();
  const { config: wl } = useWhiteLabel();
  // Apr 28 v3 — compact rail UX. Default behavior:
  //   • Sidebar renders as a 56px icon-only RAIL.
  //   • Hovering anywhere on the rail expands it to 240px transiently.
  //   • Mouse leaving the rail collapses it back.
  //   • Clicking the pin lock-expands it (state persisted to localStorage).
  // The previous "always-expanded by default" mode created the
  // overwhelming-list feeling the user complained about. Compact rail is
  // the Linear/Notion/Discord pattern — recognized industry default.
  const [pinned, setPinned] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("sidebar_pinned") === "1"; } catch { return false; }
  });
  const [hoverExpanded, setHoverExpanded] = useState(false);
  // collapsed = NOT (pinned OR hoverExpanded). The legacy `setCollapsed`
  // call sites keep working — they flip pinned, which is the only state
  // worth persisting.
  const collapsed = !pinned && !hoverExpanded;
  const setCollapsed = (next: boolean) => {
    const newPinned = !next;
    setPinned(newPinned);
    try { localStorage.setItem("sidebar_pinned", newPinned ? "1" : "0"); } catch {}
  };
  // Apr 28: live filter text. When non-empty, every nav row is checked
  // for case-insensitive substring match against label + section + sub.
  // Sections collapse to show only matches; non-matching rows hide.
  const [navFilter, setNavFilter] = useState("");
  const filterInputRef = useRef<HTMLInputElement>(null);


  // Use profile role when available. If profile hasn't loaded yet but auth
  // loading is complete (user is logged in, profile just failed to fetch),
  // fall back to the cached role from localStorage, or default to "admin"
  // to avoid showing an empty sidebar. The dashboard layout already blocks
  // rendering until user exists, so we know we're authenticated here.
  const userRole = profile?.role || (() => {
    // If still loading auth, show nothing (prevents flash of admin nav for clients)
    if (authLoading) return "";
    // Auth done but profile null — try cached role
    try {
      const cached = typeof window !== "undefined" ? localStorage.getItem("ss_profile") : null;
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.role) return parsed.role;
      }
    } catch {}
    // Ultimate fallback — admin (most users are admin, and the route guard in layout.tsx
    // will redirect non-admin users anyway)
    return "admin";
  })();
  // ── User sidebar preferences (enabled_items + customizations) ───
  // Load asynchronously; while loading or empty, we show the default nav.
  const [enabledHrefs, setEnabledHrefs] = useState<string[] | null>(null);
  type SubGroup = { id: string; name: string; items: string[] };
  type CustomGroupShape = {
    id: string;
    name?: string;
    label?: string;
    icon?: string;
    color?: string;
    order?: number;
    items: string[];
    subgroups?: SubGroup[];
  };
  const [customGroups, setCustomGroups] = useState<CustomGroupShape[]>([]);
  const [pins, setPins] = useState<string[]>([]);
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [iconOverrides, setIconOverrides] = useState<Record<string, string>>({});

  // ── Unread counts per nav path (Discord-style red dots) ───────────
  const [unread, setUnread] = useState<Record<string, number>>({});

  // ── Recent pages — tracks last 5 visited nav entries ─────────────
  const [recentPages, setRecentPages] = useState<Array<{ label: string; href: string }>>([]);

  useEffect(() => {
    if (authLoading || !userRole) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/user/sidebar-unread", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.unread && typeof data.unread === "object") {
          setUnread(data.unread as Record<string, number>);
        }
      } catch {
        // Silent — dots simply won't appear
      }
    };

    fetchUnread();
    // Refetch every 30s for live updates (tab visible only)
    timer = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) fetchUnread();
    }, 30_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [authLoading, userRole]);

  // Debounced "mark visited" — fires when user navigates to a tracked path.
  // We piggyback off pathname changes so any nav method (link click, back/fwd,
  // programmatic push) all flow through here.
  useEffect(() => {
    if (!pathname) return;
    if (!(pathname in unread)) return; // not tracked or already 0
    const handle = setTimeout(() => {
      void fetch("/api/user/sidebar-unread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nav_path: pathname }),
        cache: "no-store",
      })
        .then(() => {
          // Optimistically clear the count locally so the dot disappears immediately.
          setUnread((prev) => {
            if (!(pathname in prev)) return prev;
            const next = { ...prev };
            delete next[pathname];
            return next;
          });
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(handle);
    // We only want this firing on pathname change, not whenever unread updates,
    // otherwise typing into a different page could re-fire spuriously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Hydrate recent pages from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ss_recent_pages");
      if (stored) {
        const parsed = JSON.parse(stored) as Array<{ label: string; href: string }>;
        if (Array.isArray(parsed)) setRecentPages(parsed);
      }
    } catch {}
  }, []);

  // Track current pathname — prepend to recent pages, dedup, cap at 5
  useEffect(() => {
    if (!pathname) return;
    const match = navItems.find(item => item.href === pathname);
    if (!match) return;
    setRecentPages(prev => {
      const filtered = prev.filter(p => p.href !== pathname);
      const next = [{ label: match.label, href: match.href }, ...filtered].slice(0, 5);
      try { localStorage.setItem("ss_recent_pages", JSON.stringify(next)); } catch {}
      return next;
    });
  }, [pathname]);

  useEffect(() => {
    if (authLoading || !userRole) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/sidebar-preferences", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const prefs = data?.preferences;
        if (Array.isArray(prefs?.enabled_items) && prefs.enabled_items.length > 0) {
          setEnabledHrefs(prefs.enabled_items as string[]);
        } else {
          setEnabledHrefs([]); // explicit "no overrides, show all defaults"
        }
        if (Array.isArray(prefs?.custom_groups)) {
          setCustomGroups(prefs.custom_groups as CustomGroupShape[]);
        }
        if (Array.isArray(prefs?.pins)) setPins(prefs.pins as string[]);
        if (prefs?.renames && typeof prefs.renames === "object") setRenames(prefs.renames as Record<string, string>);
        if (prefs?.icon_overrides && typeof prefs.icon_overrides === "object") setIconOverrides(prefs.icon_overrides as Record<string, string>);
      } catch {
        // Silent fail — default nav will continue to render.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userRole]);

  // Cmd+K (or Ctrl+K) focuses the sidebar filter input from anywhere.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        filterInputRef.current?.focus();
        filterInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filteredNav = navItems.filter((item) => {
    if (!userRole || !item.roles.includes(userRole)) return false;
    // settingsOnly items are NEVER rendered in the sidebar — they live only on
    // the /dashboard/settings hub page. This was the root cause of all 60+
    // hidden pages appearing in the nav (tier: undefined passes the tier===4 check).
    if (item.settingsOnly) return false;
    // Apply user-level enable list only for admin/team_member (client portal is untouched).
    if ((userRole === "admin" || userRole === "team_member") && enabledHrefs && enabledHrefs.length > 0) {
      if (!enabledHrefs.includes(item.href)) return false;
    }
    // Tier 4 items are handled separately in the nav footer — exclude from main list.
    // Client portal items have no tier, so they always pass.
    const itemTier = item.tier;
    if (itemTier === 4) return false; // footer renders these
    // Apr 28: live filter applied last so the user can substring-search
    // across label / section / sub. Empty filter passes everything.
    if (navFilter.trim()) {
      const q = navFilter.trim().toLowerCase();
      const haystack = `${item.label} ${item.section ?? ""} ${item.sub ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // Separate tier-4 items for footer rendering.
  // settingsOnly=true items are excluded from the footer — they live only on
  // the /dashboard/settings hub page and are not given a sidebar footprint.
  const tier4Nav = navItems.filter((item) =>
    item.tier === 4 && !item.settingsOnly && !!userRole && item.roles.includes(userRole)
  );

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Chrome Extension banner dismiss state
  const [extDismissed, setExtDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    try { return localStorage.getItem("sidebar_ext_dismissed") === "1"; } catch { return false; }
  });

  // Group nav items by section for collapsible sidebar
  const groups: { section: string | null; items: NavItem[] }[] = [];
  let currentGroup: (typeof groups)[0] | null = null;
  filteredNav.forEach(item => {
    if (item.section) {
      currentGroup = { section: item.section, items: [item] };
      groups.push(currentGroup);
    } else if (!currentGroup) {
      if (groups.length === 0 || groups[0].section !== null) {
        groups.unshift({ section: null, items: [] });
      }
      groups[0].items.push(item);
    } else {
      currentGroup.items.push(item);
    }
  });

  // Collapsible section state — persisted to localStorage
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("sidebar_sections") || "{}"); } catch { return {}; }
  });

  // Sub-group collapse state — persisted to localStorage
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("sidebar_subs") || "{}"); } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem("sidebar_sections", JSON.stringify(expandedSections));
  }, [expandedSections]);

  useEffect(() => {
    localStorage.setItem("sidebar_subs", JSON.stringify(expandedSubs));
  }, [expandedSubs]);

  const isSectionExpanded = (section: string | null): boolean => {
    if (!section) return true; // Core items always visible
    // Apr 28: when there's an active filter, ALWAYS expand sections
    // that have matches so the user sees results without having to
    // click open each section.
    if (navFilter.trim()) return true;
    if (expandedSections[section] !== undefined) return expandedSections[section];
    // Default: expand only the section containing the active page
    return groups.find(g => g.section === section)?.items.some(item =>
      isItemActive(item.href, pathname)
    ) || false;
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !isSectionExpanded(section) }));
  };

  // Sub-group expand/collapse: default to expanded if active page is in the sub-group
  const isSubExpanded = (subKey: string, items: NavItem[]): boolean => {
    if (expandedSubs[subKey] !== undefined) return expandedSubs[subKey];
    // Default: expand if the active page is in this sub-group
    return items.some(item => isItemActive(item.href, pathname));
  };

  const toggleSub = (subKey: string, items: NavItem[]) => {
    setExpandedSubs(prev => ({ ...prev, [subKey]: !isSubExpanded(subKey, items) }));
  };

  // Pre-compute sub-groups for each section
  const subGroupsForSection = useMemo(() => {
    const map: Record<string, { sub: string; items: NavItem[] }[]> = {};
    groups.forEach(group => {
      if (!group.section) return;
      const hasSubs = group.items.some(item => item.sub);
      if (!hasSubs) return;
      // Preserve ordering: iterate items, collect unique sub names in order
      const seen = new Set<string>();
      const subGroups: { sub: string; items: NavItem[] }[] = [];
      // Items without a sub go into a "_none" bucket rendered directly
      const noBucket: NavItem[] = [];
      group.items.forEach(item => {
        if (!item.sub) {
          noBucket.push(item);
          return;
        }
        if (!seen.has(item.sub)) {
          seen.add(item.sub);
          subGroups.push({ sub: item.sub, items: [] });
        }
        subGroups.find(sg => sg.sub === item.sub)!.items.push(item);
      });
      // Prepend no-sub items as a virtual group if any
      if (noBucket.length > 0) {
        subGroups.unshift({ sub: "", items: noBucket });
      }
      map[group.section] = subGroups;
    });
    return map;
  }, [groups, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Render a single nav link ────────────────────────────────── */
  const renderNavLink = (item: NavItem, indented?: boolean) => {
    const isActive = isItemActive(item.href, pathname);
    const customIcon = renderCustomIcon(iconOverrides[item.href], 16);
    const label = renames[item.href] || item.label;
    const unreadCount = unread[item.href] || 0;
    return (
      <div key={item.href} className="relative sidebar-item-anim">
        <Link
          href={item.href}
          onMouseEnter={() => setHoveredItem(item.href)}
          onMouseLeave={() => setHoveredItem(null)}
          className={`nav-item-hover flex items-center gap-2 py-1 my-px rounded-md text-[12px] transition-all duration-220 ease-out-expo-foundation ${
            indented ? "px-3 ml-1" : "px-2.5"
          } ${
            isActive
              ? "active text-brand-accent font-semibold bg-[rgba(212,255,0,0.09)] shadow-[inset_0_0_0_1px_rgba(212,255,0,0.13),0_1px_4px_rgba(212,255,0,0.06)]"
              : "text-text-secondary hover:text-text-primary hover:bg-[rgba(108,114,172,0.07)]"
          }`}
        >
          <span className={`shrink-0 transition-all duration-220 ease-out-expo-foundation ${isActive ? "text-brand-accent scale-[1.06]" : hoveredItem === item.href ? "text-text-primary scale-[1.04]" : "scale-100"}`}>
            {customIcon || item.icon}
          </span>
          <span className="truncate flex-1">{label}</span>
          {unreadCount > 0 && <UnreadBadge count={unreadCount} />}
          {isActive && (
            <motion.div
              layoutId="sidebar-active-accent"
              className="absolute -left-px top-1/2 w-[2px] h-[62%] rounded-r bg-brand-accent"
              style={{ y: "-50%", boxShadow: "0 0 8px rgba(212,255,0,0.55), 0 0 2px rgba(212,255,0,0.8)" }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            />
          )}
        </Link>
      </div>
    );
  };

  /* ─── Render a collapsed-sidebar nav link — round icon pill ───── */
  const renderCollapsedLink = (item: NavItem) => {
    const isActive = isItemActive(item.href, pathname);
    const customIcon = renderCustomIcon(iconOverrides[item.href], 16);
    const label = renames[item.href] || item.label;
    const unreadCount = unread[item.href] || 0;
    return (
      <div key={item.href} className="relative flex justify-center my-0.5">
        <Link
          href={item.href}
          onMouseEnter={() => setHoveredItem(item.href)}
          onMouseLeave={() => setHoveredItem(null)}
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-220 ease-out-expo-foundation nav-icon-alive ${
            isActive
              ? "bg-brand-accent text-[#020711] font-semibold shadow-[0_2px_10px_rgba(212,255,0,0.32)]"
              : "text-text-secondary hover:text-brand-accent hover:bg-[rgba(212,255,0,0.09)]"
          }`}
          title={unreadCount > 0 ? `${label} (${unreadCount})` : label}
          aria-label={label}
        >
          <span className="relative shrink-0">
            {customIcon || item.icon}
            {unreadCount > 0 && <UnreadDotMini />}
          </span>
        </Link>
        {hoveredItem === item.href && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 whitespace-nowrap pointer-events-none">
            <div className="bg-[#1C2338] border border-[rgba(212,255,0,0.18)] rounded-lg px-2.5 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.50),0_1px_3px_rgba(0,0,0,0.30)] text-xs font-medium text-text-primary">
              {label}
              {unreadCount > 0 && <span className="ml-1.5 text-[10px] text-status-error font-bold">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      onMouseEnter={() => { if (!pinned) setHoverExpanded(true); }}
      onMouseLeave={() => { if (!pinned) setHoverExpanded(false); }}
      // Apr 28 v3: smooth hover-expand. Transitioning ONLY width + box-shadow
      // (was `transition-all` which animated child transforms simultaneously
      // and caused visible jitter). Out-quint bezier (0.22, 1, 0.36, 1)
      // glides into the rest position instead of decelerating linearly.
      // 320ms reads as "considered" without feeling slow. `transform-gpu`
      // forces the aside onto its own compositor layer so the width tween
      // doesn't trigger layout reflow on the rest of the page.
      className={`sidebar-sidebar-rail-anim fixed inset-y-0 left-0 z-40 flex flex-col transform-gpu ${
        collapsed ? "w-[56px]" : "w-60"
      } ${hoverExpanded && !pinned ? "shadow-[8px_0_36px_-10px_rgba(0,0,0,0.55)]" : ""}`}
      style={{
        background: "rgba(10,13,26,0.94)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        borderRight: "1px solid rgba(212,255,0,0.10)",
        boxShadow: "inset -1px 0 0 rgba(212,255,0,0.06), 2px 0 32px rgba(0,0,0,0.50)",
      }}
    >
      {/* LED light strip — lives on the sidebar's right edge, theme-colored */}
      <span className="sidebar-led-strip" aria-hidden />
      {/* Logo — uses white label config when available; otherwise falls back to
          the Trinity product brand (by ShortStack). If an agency white-labels
          the product they can override company_name/logo_url via settings. */}
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-3 h-16 shrink-0 border-b border-[var(--border-subtle)]`}>
        {(() => {
          // A white-label override is active when the tenant set their own
          // company_name (anything other than the ShortStack parent default).
          const wlOverride = !!wl.company_name && wl.company_name !== BRAND.company_name;
          const displayName = wlOverride ? wl.company_name! : BRAND.product_name;
          const subtext = wlOverride ? null : `by ${BRAND.company_name}`;

          if (collapsed) {
            // White-label tenants keep their own logo. Default tenants get
            // the canonical Stack 3D mark for brand cohesion.
            if (wlOverride) {
              return (
                <Link href="/dashboard">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={wl.logo_url || "/icons/shortstack-logo.svg"} alt={displayName} width={22} height={22} className="rounded object-contain" />
                </Link>
              );
            }
            return (
              <Link href="/dashboard" className="flex items-center justify-center" aria-label={displayName}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/trinity-logo-white.svg" alt={displayName} width={24} height={24} className="opacity-90 drop-shadow-[0_0_8px_rgba(212,255,0,0.50)]" />
              </Link>
            );
          }

          return (
            <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0 group">
              {wlOverride ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={wl.logo_url || "/icons/shortstack-logo.svg"} alt={displayName} width={28} height={28} className="shrink-0 object-contain" />
              ) : (
                <div className="shrink-0 transition-transform duration-220 ease-out-expo-foundation group-hover:scale-105">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/trinity-logo-white.svg" alt={displayName} width={28} height={28} className="opacity-90 drop-shadow-[0_0_12px_rgba(212,255,0,0.55)]" />
                </div>
              )}
              <div className="min-w-0 leading-tight">
                <div className="font-display text-[15px] tracking-tight text-text-primary truncate">{displayName}</div>
                {subtext && (
                  <div className="text-[10px] text-text-muted font-medium tracking-wide truncate">{subtext}</div>
                )}
              </div>
            </Link>
          );
        })()}
        {!collapsed && (
          <button
            onClick={() => setPinned(!pinned)}
            className={`p-1 rounded-md transition-colors duration-220 ease-out-expo-foundation shrink-0 ${
              pinned
                ? "text-brand-accent bg-[rgba(212,255,0,0.10)]"
                : "text-text-muted hover:text-brand-accent hover:bg-white/[0.02]"
            }`}
            aria-label={pinned ? "Unpin sidebar (auto-collapse)" : "PushPin sidebar open"}
            title={pinned ? "Unpin (auto-collapse on mouse-leave)" : "PushPin sidebar open"}
          >
            <PushPin size={13} className={pinned ? "fill-current" : ""} />
          </button>
        )}
      </div>

      {/* Trinity OS Workspace Switcher — Mochi / Trinity / NORDCTRL */}
      {!collapsed && (
        <div className="px-2 py-2.5 border-b border-[var(--border-subtle)]">
          <div className="text-[9px] font-editorial tracking-widest text-text-muted/60 uppercase px-2 mb-1.5">WORKSPACE</div>
          <div className="space-y-0.5">
            {(
              [
                { id: "mochi",    name: "Mochi",    subtitle: "AI Assistant",  icon: "🧠", active: false },
                { id: "trinity",  name: "Trinity",  subtitle: "Marketing OS",  icon: "⚡", active: true },
                { id: "nordctrl", name: "NORDCTRL", subtitle: "Brand & Storefront", icon: "🎿", active: false },
              ] as const
            ).map((ws) => (
              <button
                key={ws.id}
                disabled={!ws.active}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-all duration-220 ease-out-expo-foundation ${
                  ws.active
                    ? "bg-[rgba(212,255,0,0.10)] border border-[rgba(212,255,0,0.22)] text-text-primary cursor-default"
                    : "hover:bg-white/[0.03] text-text-muted hover:text-text-secondary cursor-not-allowed opacity-60"
                }`}
                aria-label={`Switch to ${ws.name} workspace`}
              >
                <span className="text-[13px] leading-none shrink-0">{ws.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className={`text-[11px] font-medium leading-tight truncate ${ws.active ? "text-text-primary" : "text-text-muted"}`}>
                    {ws.name}
                  </div>
                  <div className="text-[10px] text-text-muted/60 leading-tight truncate">{ws.subtitle}</div>
                </div>
                {ws.active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-accent shrink-0 shadow-[0_0_6px_rgba(212,255,0,0.8)]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Admin Profile Switcher */}
      {!collapsed && <AdminProfileSwitcher />}

      {/* Chrome Extension banner — admin only, dismissible */}
      {!collapsed && userRole === "admin" && !extDismissed && (
        <div className="mx-2 mb-1 mt-2">
          <div className="flex items-center gap-1.5 h-[34px] px-2.5 rounded-lg bg-white/[0.03] border border-border-subtle">
            <PuzzlePiece size={13} className="shrink-0 text-brand-lime" />
            <a href="/downloads/shortstack-extension.zip" download
              className="text-[11px] text-brand-lime/90 hover:text-brand-lime font-medium transition-colors duration-220"
              title="DownloadSimple → Unzip → chrome://extensions → Load unpacked">
              Install Extension
            </a>
            <span className="text-text-muted/40">|</span>
            <ExtInstallTooltip />
            <button
              onClick={() => { setExtDismissed(true); localStorage.setItem("sidebar_ext_dismissed", "1"); }}
              className="ml-auto shrink-0 p-0.5 rounded text-text-muted hover:text-text-primary transition-colors duration-220"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Quick filter — Apr 28: type to instantly narrow to matching nav
          items. When the input has any text, sections collapse to show
          only matching rows; clearing the input restores the normal
          collapse state. Pressing Esc clears. Single biggest sidebar
          UX fix per user feedback ("minimize the sidebar with all the
          pages or make them into one or something to make it less
          confusing and easier to navigate"). */}
      {!collapsed && (
        <div className="px-2 pt-1 pb-1">
          <div className="relative">
            <MagnifyingGlass size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              ref={filterInputRef}
              type="search"
              value={navFilter}
              onChange={(e) => setNavFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setNavFilter("");
              }}
              placeholder="Filter… (⌘K)"
              className="w-full pl-7 pr-7 py-1.5 text-[11px] bg-surface-light/50 border border-border-subtle rounded-md text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-brand-accent/40 focus:bg-surface-light"
              aria-label="Filter sidebar (Cmd+K)"
            />
            {navFilter && (
              <button
                onClick={() => setNavFilter("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-text-muted hover:text-text-primary"
                aria-label="Clear filter"
              >
                <X size={10} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Core quick-strip — tier-1 icon pills always accessible above the scroll area.
          Six icons for Dashboard/Tray/Clients/Analytics/CRM/Calendar.
          Compact enough to fit in 56px collapsed width as a vertical column too. */}
      {!collapsed && (() => {
        const TIER1 = navItems.filter(i => i.tier === 1 && (!userRole || i.roles.includes(userRole)));
        if (TIER1.length === 0) return null;
        return (
          <div className="px-2 pb-1 pt-0.5">
            <div className="flex items-center gap-1 bg-surface-light/40 rounded-lg px-1 py-1 border border-border-subtle">
              {TIER1.map(item => {
                const isActive = isItemActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    aria-label={item.label}
                    className={`flex-1 flex items-center justify-center py-1 rounded-md transition-all duration-150 ${
                      isActive
                        ? "bg-[rgba(212,255,0,0.15)] text-brand-accent"
                        : "text-text-muted hover:text-text-primary hover:bg-white/[0.04]"
                    }`}
                  >
                    {item.icon}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Navigation — collapsible sections with smart sub-groups.
          When the user has defined custom_groups, use those as the primary
          layout (plus "Other" for any remaining items). */}
      <nav className="flex-1 px-1.5 py-1 overflow-y-auto scrollbar-none">
        {/* Pinned items (always at top if any) */}
        {!collapsed && pins.length > 0 && (() => {
          // Apr 28 audit fix: previous predicate
          //   `!!x && (!userRole || x.roles.includes(userRole))`
          // had wrong operator precedence. JS evaluates as
          //   `((!!x && userRole) ? x.roles.includes(userRole) : false)`
          // which means when `userRole` is "" (empty string during auth
          // load) the whole thing returns false and pinned items
          // disappear. Fix: short-circuit when no role yet.
          const pinnedNavItems = pins
            .map(href => navItems.find(i => i.href === href))
            .filter((x): x is NavItem => !!x && (!userRole || x.roles.includes(userRole)))
            .filter(i => !enabledHrefs || enabledHrefs.length === 0 || enabledHrefs.includes(i.href));
          if (pinnedNavItems.length === 0) return null;
          return (
            <div>
              <div className="w-full flex items-center gap-2 px-3 pt-3 pb-1.5">
                <PushPin size={9} className="text-brand-lime" />
                <span className="font-editorial text-[11px] text-brand-lime uppercase tracking-[0.18em]">Pinned</span>
                <div className="flex-1 h-px bg-border-subtle" />
              </div>
              {pinnedNavItems.map(item => renderNavLink(item))}
            </div>
          );
        })()}

        {customGroups.length > 0 && !collapsed ? (
          <>
            {/* Render user-defined groups first */}
            {customGroups
              .slice()
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((cg) => {
                const groupName = cg.name || cg.label || "Group";
                const groupIconNode = renderCustomIcon(cg.icon, 10);
                const pinnedSet = new Set(pins);
                const directItems = cg.items
                  .filter(h => !pinnedSet.has(h))
                  .map(h => navItems.find(i => i.href === h))
                  .filter((x): x is NavItem => !!x && (!userRole || x.roles.includes(userRole)))
                  .filter(i => !enabledHrefs || enabledHrefs.length === 0 || enabledHrefs.includes(i.href));
                const subs = (cg.subgroups || []).map(sg => ({
                  id: sg.id,
                  name: sg.name,
                  items: sg.items
                    .filter(h => !pinnedSet.has(h))
                    .map(h => navItems.find(i => i.href === h))
                    .filter((x): x is NavItem => !!x && (!userRole || x.roles.includes(userRole)))
                    .filter(i => !enabledHrefs || enabledHrefs.length === 0 || enabledHrefs.includes(i.href)),
                })).filter(s => s.items.length > 0);
                if (directItems.length === 0 && subs.length === 0) return null;
                return (
                  <div key={`cg-${cg.id}`}>
                    <div className="w-full flex items-center gap-2 px-3 pt-4 pb-1.5">
                      {groupIconNode ? (
                        <span className="shrink-0" style={{ color: cg.color || "var(--brand-lime)" }}>{groupIconNode}</span>
                      ) : null}
                      <span className="font-editorial text-[11px] uppercase tracking-[0.18em]" style={{ color: cg.color || "var(--text-muted)" }}>
                        {groupName}
                      </span>
                      <div className="flex-1 h-px" style={{ backgroundColor: cg.color ? `${cg.color}26` : "var(--border-subtle)" }} />
                    </div>
                    {directItems.map(item => renderNavLink(item))}
                    {subs.map(sg => (
                      <div key={`sg-${sg.id}`}>
                        <div className="w-full flex items-center gap-1.5 pl-3.5 pr-2 pt-1.5 pb-0.5">
                          <span className="text-[7px] text-text-muted/60">&bull;</span>
                          <span className="text-[10.5px] text-text-muted font-medium select-none tracking-wide">{sg.name}</span>
                        </div>
                        {sg.items.map(item => renderNavLink(item, true))}
                      </div>
                    ))}
                  </div>
                );
              })}

            {/* "Other" bucket — items not in any custom group (collapsible) */}
            {(() => {
              const assigned = new Set<string>();
              customGroups.forEach(cg => {
                cg.items.forEach(h => assigned.add(h));
                (cg.subgroups || []).forEach(sg => sg.items.forEach(h => assigned.add(h)));
              });
              pins.forEach(h => assigned.add(h));
              const otherItems = filteredNav.filter(i => !assigned.has(i.href));
              if (otherItems.length === 0) return null;
              const otherExpanded = expandedSections["_other"] !== false;
              return (
                <div>
                  <button
                    onClick={() => setExpandedSections(p => ({ ...p, _other: !otherExpanded }))}
                    className="w-full flex items-center gap-2 px-3 pt-2.5 pb-1 group/sec cursor-pointer"
                  >
                    <span className="font-editorial text-[11px] text-text-muted uppercase tracking-[0.18em] group-hover/sec:text-text-primary transition-colors duration-220">
                      Other
                    </span>
                    <div className="flex-1 h-px bg-border-subtle" />
                    <CaretDown
                      size={10}
                      className={`text-text-muted group-hover/sec:text-text-primary transition-transform duration-220 ${otherExpanded ? "" : "-rotate-90"}`}
                    />
                  </button>
                  {otherExpanded && otherItems.map(item => renderNavLink(item))}
                </div>
              );
            })()}
          </>
        ) : groups.map((group) => {
          const expanded = isSectionExpanded(group.section);
          const sectionSubs = group.section ? subGroupsForSection[group.section] : null;

          return (
            <div key={group.section || "_core"}>
              {/* Section header (e.g. Sales, Create, etc.).
                  If the section has a hub page, we split the header into
                  a <Link> (the label) + a separate chevron button (the
                  expand/collapse toggle) so both behaviors coexist.
                  Otherwise the whole row is a toggle button as before. */}
              {group.section && !collapsed && (
                (() => {
                  const hubHref = SECTION_HUB_HREF[group.section!];
                  const hubActive = hubHref ? pathname === hubHref : false;
                  if (hubHref) {
                    // Hub-bearing section: pill badge that's also a clickable
                    // Link routing to /dashboard/<section>.
                    return (
                      <div className="w-full flex items-center justify-between gap-1.5 px-2.5 pt-2.5 pb-1 group/sec">
                        <Link
                          href={hubHref}
                          title={`Open ${group.section} hub →`}
                          className={`group/hub inline-flex items-center gap-0.5 text-[9px] font-semibold px-2 py-[3px] rounded-full border transition-all duration-220 ease-out-expo-foundation ${
                            hubActive
                              ? "bg-[rgba(212,255,0,0.10)] border-[rgba(212,255,0,0.30)] text-brand-accent"
                              : "bg-[rgba(0,0,0,0.04)] border-[rgba(0,0,0,0.10)] text-text-muted hover:bg-[rgba(0,0,0,0.07)] hover:border-[rgba(0,0,0,0.18)] hover:text-text-primary"
                          }`}
                        >
                          {group.section}
                          <ArrowUpRight
                            size={7}
                            className="opacity-60 transition-transform duration-220 group-hover/hub:opacity-100 group-hover/hub:-translate-y-px group-hover/hub:translate-x-px"
                          />
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleSection(group.section!)}
                          className="p-0.5 rounded text-text-muted hover:text-text-primary transition-colors duration-220 cursor-pointer"
                          aria-label={expanded ? `Collapse ${group.section}` : `Expand ${group.section}`}
                        >
                          <CaretDown
                            size={10}
                            className={`transition-transform duration-220 ${expanded ? "" : "-rotate-90"}`}
                          />
                        </button>
                      </div>
                    );
                  }
                  return (
                    <button
                      onClick={() => toggleSection(group.section!)}
                      className="w-full flex items-center justify-between gap-1.5 px-2.5 pt-2.5 pb-1 group/sec cursor-pointer"
                    >
                      <span className="inline-flex items-center text-[9px] font-semibold px-2 py-[3px] rounded-full border border-[rgba(0,0,0,0.10)] bg-[rgba(0,0,0,0.04)] text-text-muted group-hover/sec:bg-[rgba(0,0,0,0.07)] group-hover/sec:text-text-primary group-hover/sec:border-[rgba(0,0,0,0.16)] transition-all duration-220">
                        {group.section}
                      </span>
                      <CaretDown
                        size={10}
                        className={`text-text-muted group-hover/sec:text-text-primary transition-transform duration-220 ${expanded ? "" : "-rotate-90"}`}
                      />
                    </button>
                  );
                })()
              )}

              {/* Section content */}
              {group.section && !collapsed ? (
                <div
                  className="sidebar-section-items"
                  data-collapsed={!expanded}
                >
                  <div className="sidebar-section-inner">
                    {sectionSubs ? (
                      /* ── Render sub-grouped items ── */
                      sectionSubs.map((sg) => {
                        if (!sg.sub) {
                          // Items without a sub-group — render directly
                          return sg.items.map(item => renderNavLink(item));
                        }
                        const subKey = `${group.section}::${sg.sub}`;
                        const subOpen = isSubExpanded(subKey, sg.items);
                        return (
                          <div key={subKey}>
                            <button
                              onClick={() => toggleSub(subKey, sg.items)}
                              className="w-full flex items-center gap-1.5 pl-3.5 pr-2 pt-2 pb-0.5 group/sub cursor-pointer"
                            >
                              <span className="text-[7px] text-text-muted/60 group-hover/sub:text-text-muted transition-colors duration-220 select-none">&bull;</span>
                              <span className="text-[10.5px] text-text-muted font-medium group-hover/sub:text-text-primary transition-colors duration-220 select-none tracking-wide">
                                {sg.sub}
                              </span>
                              <CaretDown
                                size={8}
                                className={`ml-auto text-text-muted/50 group-hover/sub:text-text-muted transition-transform duration-220 ${subOpen ? "" : "-rotate-90"}`}
                              />
                            </button>
                            <div
                              className="sidebar-sub-items"
                              data-collapsed={!subOpen}
                            >
                              <div className="sidebar-sub-inner">
                                {sg.items.map(item => renderNavLink(item, true))}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      /* ── No sub-groups (e.g. Connect) — render flat ── */
                      group.items.map(item => renderNavLink(item))
                    )}
                  </div>
                </div>
              ) : (
                /* Core items (no section) or collapsed sidebar — render directly */
                group.items.map(item =>
                  collapsed ? renderCollapsedLink(item) : renderNavLink(item)
                )
              )}
            </div>
          );
        })}


        {/* Tier 4 — Gear/admin footer items, always visible in the nav area */}
        {!collapsed && tier4Nav.length > 0 && (
          <div className="px-2 pt-1 pb-1">
            <div className="h-px bg-border-subtle mb-2" />
            {tier4Nav.map(item => renderNavLink(item))}
          </div>
        )}
        {collapsed && tier4Nav.length > 0 && (
          <div className="px-1 pb-1">
            {tier4Nav.map(item => renderCollapsedLink(item))}
          </div>
        )}
      </nav>

      {/* PushPin button shown in collapsed rail (touch-device fallback for the
          hover-expand UX — fingers don't hover, so we still need a way to
          lock it open). Single-tap pins; tap again to release. */}
      {collapsed && (
        <div className="px-1.5 py-1">
          <button
            onClick={() => setPinned(true)}
            className="w-full p-2 rounded-lg text-text-muted hover:text-brand-accent hover:bg-white/[0.02] flex items-center justify-center transition-colors duration-220 ease-out-expo-foundation"
            aria-label="PushPin sidebar open"
            title="PushPin sidebar open"
          >
            <PushPin size={14} />
          </button>
        </div>
      )}

      {/* Recently visited — shown only when expanded and user has 2+ pages */}
      {!collapsed && recentPages.length >= 2 && (
        <div className="mx-2 mb-1 border-t border-border-subtle pt-2">
          <p className="text-[9px] text-text-muted uppercase tracking-[0.15em] font-bold px-1 mb-1 opacity-50">Recent</p>
          <div className="space-y-px">
            {recentPages.slice(0, 3).map(page => (
              <Link
                key={page.href}
                href={page.href}
                className={`flex items-center gap-2 px-2 py-1 rounded-md text-[11px] transition-colors duration-220 ease-out-expo-foundation truncate ${
                  pathname === page.href
                    ? "text-brand-accent bg-brand-accent/[0.08]"
                    : "text-text-muted hover:text-text-secondary hover:bg-white/[0.03]"
                }`}
              >
                <span className="w-1 h-1 rounded-full bg-current opacity-40 shrink-0 inline-block" />
                {page.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* User — refined profile footer with email + actions */}
      <div className="px-2 py-2.5 border-t border-border-subtle bg-white/[0.015]">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/settings"
              className="flex-1 min-w-0 flex items-center gap-2.5 px-1 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors duration-220 ease-out-expo-foundation cursor-pointer"
              title="Open settings"
            >
              {(() => {
                const plan = getPlanConfig(profile?.plan_tier);
                const glow = profile?.plan_tier ? `0 0 8px ${plan.glow}` : undefined;
                return profile?.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-border-subtle" style={{ boxShadow: glow }} />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/[0.05] ring-1 ring-border-subtle flex items-center justify-center" style={{ boxShadow: glow }}>
                    <span className="text-brand-accent text-[11px] font-bold font-display">{(profile?.nickname || profile?.full_name)?.charAt(0).toUpperCase() || "?"}</span>
                  </div>
                );
              })()}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-text-primary truncate leading-tight">{profile?.nickname || profile?.full_name || "Loading..."}</p>
                <p className="text-[11px] text-text-muted truncate leading-tight mt-0.5">
                  {profile?.email || ""}
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-0.5 shrink-0">
              <Link
                href="/dashboard/settings"
                className="p-1.5 rounded-md text-text-muted hover:text-brand-lime hover:bg-white/[0.02] transition-colors duration-220 ease-out-expo-foundation"
                title="Gear"
                aria-label="Gear"
              >
                <NavIcon3D name="Gear" size={14} />
              </Link>
              <button
                onClick={signOut}
                className="p-1.5 rounded-md text-text-muted hover:text-status-error hover:bg-[rgba(242,96,99,0.06)] transition-colors duration-220 ease-out-expo-foundation"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <SignOut size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Link href="/dashboard/settings" className="flex justify-center" title="Open settings">
              <div className="w-8 h-8 rounded-full bg-white/[0.05] ring-1 ring-border-subtle flex items-center justify-center">
                <span className="text-brand-accent text-[10px] font-bold font-display">{profile?.full_name?.charAt(0).toUpperCase() || "?"}</span>
              </div>
            </Link>
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center px-2.5 py-1.5 rounded-lg text-[11px] text-text-muted hover:text-status-error hover:bg-[rgba(242,96,99,0.06)] transition-colors duration-220"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <SignOut size={14} />
            </button>
          </div>
        )}
        {!collapsed && (
          <div className="px-1 mt-1">
            <RoleBadge role={profile?.role} planTier={profile?.plan_tier || undefined} />
          </div>
        )}
        {/* Desktop-app indicator — only renders inside the Electron shell */}
        <DesktopIndicator collapsed={collapsed} />
        {/* Legal footer links — always visible when not collapsed */}
        {!collapsed && (
          <div className="flex items-center justify-center gap-3 pt-1.5">
            <a href="/legal/privacy" className="text-[9px] text-text-muted hover:text-brand-accent transition-colors duration-220">Privacy</a>
            <span className="text-[9px] text-text-muted/30">&middot;</span>
            <a href="/legal/terms" className="text-[9px] text-text-muted hover:text-brand-accent transition-colors duration-220">Terms</a>
            <span className="text-[9px] text-text-muted/30">&middot;</span>
            <a href="/legal/cookies" className="text-[9px] text-text-muted hover:text-brand-accent transition-colors duration-220">Cookies</a>
          </div>
        )}
        {/* White label: Powered by footer */}
        {wl.show_powered_by && !collapsed && (wl.company_name && wl.company_name !== "ShortStack") && (
          <div className="text-center pt-1.5">
            <span className="text-[9px] text-text-muted tracking-wide">Powered by ShortStack</span>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ─── Extension Install Tooltip ───────────────────────────────────── */
function ExtInstallTooltip() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-[10px] text-text-muted hover:text-brand-lime transition-colors duration-220"
        title="How to install the Chrome extension"
      >
        How to install
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-50 w-56 bg-bg-surface-2 border border-border-subtle rounded-xl shadow-stack-2 p-3">
            <p className="text-[11px] font-semibold text-text-primary mb-1.5">Install Steps</p>
            <ol className="text-[10px] text-text-secondary space-y-1 list-decimal list-inside leading-relaxed">
              <li>DownloadSimple the .zip file</li>
              <li>Unzip to a folder</li>
              <li>Open <span className="font-mono text-[9px] text-brand-lime/80">chrome://extensions</span> in your browser</li>
              <li>Enable Developer mode</li>
              <li>Click &quot;Load unpacked&quot; and select the folder</li>
              <li>PushPin the extension to your toolbar</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Unread Badge (Discord-style red pill with count) ───────────── */
function UnreadBadge({ count }: { count: number }) {
  const display = count > 9 ? "9+" : String(count);
  return (
    <span
      className="ml-auto shrink-0 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-status-error text-white text-[10px] font-bold leading-none unread-pulse"
      aria-label={`${count} unread`}
    >
      {display}
    </span>
  );
}

/* ─── Mini dot for the collapsed sidebar (overlays the icon) ─────── */
function UnreadDotMini() {
  return (
    <span
      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-status-error ring-1 ring-bg-surface-1 unread-pulse"
      aria-hidden
    />
  );
}

/* ─── Role Badge ──────────────────────────────────────────────────── */
function RoleBadge({ role, planTier }: { role?: string; planTier?: string }) {
  if (role === "admin") {
    const plan = getPlanConfig(planTier);
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-text-muted tracking-wide">Founder</span>
        {planTier && (
          <span
            className="text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
            style={{
              background: `${plan.color}18`,
              color: plan.color,
              boxShadow: `0 0 6px ${plan.glow}`,
            }}
          >
            {plan.badge_label}
          </span>
        )}
      </div>
    );
  }

  if (role === "client") {
    // Show "Member" instead of "client" + plan badge if available
    const plan = getPlanConfig(planTier);
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-text-muted tracking-wide">Member</span>
        {planTier && (
          <span
            className="text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
            style={{
              background: `${plan.color}18`,
              color: plan.color,
              boxShadow: `0 0 6px ${plan.glow}`,
            }}
          >
            {plan.badge_label}
          </span>
        )}
      </div>
    );
  }

  // team_member
  return <span className="text-[10px] text-text-muted capitalize tracking-wide">{role?.replace("_", " ") || "..."}</span>;
}
