/**
 * User type definitions for onboarding and personalization.
 * Each user type has:
 * - Metadata (label, icon key, description)
 * - Default recommended sidebar items (keyed by href)
 * - Personalized dashboard metric priorities
 */

export type UserType =
  | "agency"
  | "content_creator"
  | "real_estate"
  | "coach"
  | "ecommerce"
  | "saas"
  | "service_provider"
  | "other";

export interface UserTypeMeta {
  id: UserType;
  label: string;
  description: string;
  /** Lucide icon name (resolved by component) */
  iconKey: string;
  /** Default recommended sidebar item hrefs */
  recommendedSidebar: string[];
  /** Preferred dashboard metric keys (order matters — first = most important) */
  dashboardMetrics: DashboardMetricKey[];
  /** Preferred niche/industry follow-up prompt */
  nichePrompt: string;
}

export type DashboardMetricKey =
  | "clients"
  | "mrr"
  | "outreach"
  | "leads"
  | "views"
  | "subscribers"
  | "engagement"
  | "content_pieces"
  | "listings"
  | "showings"
  | "closings"
  | "sessions_booked"
  | "revenue"
  | "churn"
  | "signups"
  | "activations"
  | "orders"
  | "aov"
  | "conversion"
  | "tasks_done";

/* ─── Canonical sidebar item keys (hrefs) grouped for the customizer ── */
export const SIDEBAR_CATEGORIES: {
  category: string;
  items: { href: string; label: string }[];
}[] = [
  {
    category: "Core",
    items: [
      { href: "/dashboard/inbox", label: "Inbox" },
      { href: "/dashboard/generations", label: "Generations" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/community", label: "Community" },
      { href: "/dashboard/analytics", label: "Analytics" },
      { href: "/dashboard/reports", label: "Reports" },
    ],
  },
  {
    category: "Sales",
    items: [
      { href: "/dashboard/outreach-hub", label: "Outreach" },
      { href: "/dashboard/scraper", label: "Lead Finder" },
      { href: "/dashboard/eleven-agents", label: "AI Caller" },
      { href: "/dashboard/voice-receptionist", label: "Voice AI" },
      { href: "/dashboard/dm-controller", label: "DM Controller" },
      { href: "/dashboard/conversations", label: "Conversations" },
      { href: "/dashboard/outreach-logs", label: "Outreach Logs" },
      { href: "/dashboard/sequences", label: "Sequences" },
      { href: "/dashboard/crm", label: "CRM" },
      { href: "/dashboard/deals", label: "Deals" },
      { href: "/dashboard/proposals", label: "Proposals" },
      { href: "/dashboard/forecast", label: "Forecast" },
      { href: "/dashboard/commission-tracker", label: "Commissions" },
      { href: "/dashboard/ads-manager", label: "Ads Manager" },
      { href: "/dashboard/calendar", label: "Calendar" },
      { href: "/dashboard/scheduling", label: "Scheduling" },
      { href: "/dashboard/clients", label: "Clients" },
    ],
  },
  {
    category: "Create",
    items: [
      { href: "/dashboard/copywriter", label: "AI Copywriter" },
      { href: "/dashboard/script-lab", label: "Script Lab" },
      { href: "/dashboard/email-composer", label: "Email Composer" },
      { href: "/dashboard/email-templates", label: "Email Templates" },
      { href: "/dashboard/sms-templates", label: "SMS Templates" },
      { href: "/dashboard/newsletter", label: "Newsletter" },
      { href: "/dashboard/video-editor", label: "Video Editor" },
      { href: "/dashboard/ai-video", label: "AI Video Gen" },
      { href: "/dashboard/design", label: "Design Studio" },
      { href: "/dashboard/thumbnail-generator", label: "Thumbnails" },
      { href: "/dashboard/carousel-generator", label: "Carousel Gen" },
      { href: "/dashboard/brand-voice", label: "Brand Voice" },
      { href: "/dashboard/brand-kit", label: "Brand Kit" },
      { href: "/dashboard/content-library", label: "Content Library" },
      { href: "/dashboard/websites", label: "Websites" },
      { href: "/dashboard/landing-pages", label: "Landing Pages" },
      { href: "/dashboard/forms", label: "Forms" },
      { href: "/dashboard/surveys", label: "Surveys" },
      { href: "/dashboard/social-manager", label: "Social Manager" },
      { href: "/dashboard/content-plan", label: "Content Plan" },
    ],
  },
  {
    category: "Automate",
    items: [
      { href: "/dashboard/services", label: "AI Agents" },
      { href: "/dashboard/agent-supervisor", label: "Agent HQ" },
      { href: "/dashboard/ai-studio", label: "AI Studio" },
      { href: "/dashboard/agent-desktop", label: "Apps" },
      { href: "/dashboard/workflows", label: "Workflows" },
      { href: "/dashboard/workflow-builder", label: "Flow Builder" },
      { href: "/dashboard/automations", label: "Automations" },
      { href: "/dashboard/whatsapp", label: "WhatsApp" },
      { href: "/dashboard/webhooks", label: "Webhooks" },
      { href: "/dashboard/api-docs", label: "API Docs" },
      { href: "/dashboard/activity-log", label: "Activity Log" },
    ],
  },
  {
    category: "Manage",
    items: [
      { href: "/dashboard/workspaces", label: "Workspaces" },
      { href: "/dashboard/team", label: "Team" },
      { href: "/dashboard/production", label: "Production" },
      { href: "/dashboard/financials", label: "Financials" },
      { href: "/dashboard/invoices", label: "Invoices" },
      { href: "/dashboard/pricing", label: "Pricing" },
      { href: "/dashboard/usage", label: "Usage & Tokens" },
      { href: "/dashboard/phone-email", label: "Phone & Email" },
      { href: "/dashboard/client-health", label: "Client Health" },
      { href: "/dashboard/reviews", label: "Reviews" },
      { href: "/dashboard/tickets", label: "Tickets" },
      { href: "/dashboard/referrals", label: "Referrals" },
      { href: "/dashboard/roi-calculator", label: "ROI Calculator" },
      { href: "/dashboard/monitor", label: "Monitor" },
      { href: "/dashboard/report-generator", label: "Reports Gen" },
      { href: "/dashboard/marketplace", label: "Marketplace" },
    ],
  },
  {
    category: "Connect",
    items: [
      { href: "/dashboard/google-business", label: "Google Biz" },
      { href: "/dashboard/discord", label: "Discord" },
      { href: "/dashboard/notion-sync", label: "Notion" },
      { href: "/dashboard/integrations", label: "Socials" },
      { href: "/dashboard/competitive-monitor", label: "Competitors" },
      { href: "/dashboard/telegram-bot", label: "Telegram Bot" },
      { href: "/dashboard/notifications", label: "Notifications" },
      { href: "/dashboard/settings", label: "Settings" },
    ],
  },
];

/** Flat list of all canonical sidebar item hrefs */
export const ALL_SIDEBAR_ITEMS: string[] = SIDEBAR_CATEGORIES.flatMap((c) =>
  c.items.map((i) => i.href)
);

/* ─── User type catalogue ─────────────────────────────────────────────── */
export const USER_TYPES: UserTypeMeta[] = [
  {
    id: "agency",
    label: "Marketing Agency",
    description: "Manage multiple clients, run outreach, deliver content at scale.",
    iconKey: "Building2",
    nichePrompt: "What niche do your clients fall into (e.g. local services, e-commerce, B2B SaaS)?",
    recommendedSidebar: [
      "/dashboard",
      "/dashboard/inbox",
      "/dashboard/generations",
      "/dashboard/analytics",
      "/dashboard/outreach-hub",
      "/dashboard/scraper",
      "/dashboard/crm",
      "/dashboard/deals",
      "/dashboard/proposals",
      "/dashboard/calendar",
      "/dashboard/clients",
      "/dashboard/copywriter",
      "/dashboard/email-composer",
      "/dashboard/social-manager",
      "/dashboard/content-plan",
      "/dashboard/workflows",
      "/dashboard/team",
      "/dashboard/financials",
      "/dashboard/invoices",
      "/dashboard/client-health",
      "/dashboard/integrations",
      "/dashboard/settings",
    ],
    dashboardMetrics: ["clients", "mrr", "outreach", "revenue"],
  },
  {
    id: "content_creator",
    label: "Content Creator",
    description: "YouTube, TikTok, Instagram — grow your audience and monetize.",
    iconKey: "Video",
    nichePrompt: "What's your content niche (e.g. cooking, tech reviews, fitness)?",
    recommendedSidebar: [
      "/dashboard",
      "/dashboard/generations",
      "/dashboard/analytics",
      "/dashboard/script-lab",
      "/dashboard/video-editor",
      "/dashboard/ai-video",
      "/dashboard/thumbnail-generator",
      "/dashboard/carousel-generator",
      "/dashboard/design",
      "/dashboard/content-library",
      "/dashboard/brand-kit",
      "/dashboard/social-manager",
      "/dashboard/content-plan",
      "/dashboard/calendar",
      "/dashboard/community",
      "/dashboard/integrations",
      "/dashboard/settings",
    ],
    dashboardMetrics: ["views", "subscribers", "engagement", "content_pieces"],
  },
  {
    id: "real_estate",
    label: "Real Estate Agent",
    description: "Capture leads, manage listings, close deals faster.",
    iconKey: "Home",
    nichePrompt: "What markets do you work (e.g. luxury Miami condos, suburban first-time buyers)?",
    recommendedSidebar: [
      "/dashboard",
      "/dashboard/inbox",
      "/dashboard/analytics",
      "/dashboard/crm",
      "/dashboard/deals",
      "/dashboard/outreach-hub",
      "/dashboard/voice-receptionist",
      "/dashboard/calendar",
      "/dashboard/scheduling",
      "/dashboard/landing-pages",
      "/dashboard/email-composer",
      "/dashboard/sms-templates",
      "/dashboard/social-manager",
      "/dashboard/google-business",
      "/dashboard/reviews",
      "/dashboard/integrations",
      "/dashboard/settings",
    ],
    dashboardMetrics: ["leads", "listings", "showings", "closings"],
  },
  {
    id: "coach",
    label: "Coach / Consultant",
    description: "Book more clients, scale your knowledge, automate delivery.",
    iconKey: "GraduationCap",
    nichePrompt: "What do you coach on (e.g. career transitions, business strategy, fitness)?",
    recommendedSidebar: [
      "/dashboard",
      "/dashboard/inbox",
      "/dashboard/analytics",
      "/dashboard/crm",
      "/dashboard/scheduling",
      "/dashboard/calendar",
      "/dashboard/proposals",
      "/dashboard/copywriter",
      "/dashboard/email-composer",
      "/dashboard/newsletter",
      "/dashboard/landing-pages",
      "/dashboard/social-manager",
      "/dashboard/content-plan",
      "/dashboard/invoices",
      "/dashboard/integrations",
      "/dashboard/settings",
    ],
    dashboardMetrics: ["sessions_booked", "leads", "revenue", "engagement"],
  },
  {
    id: "ecommerce",
    label: "E-Commerce Brand",
    description: "DTC store growth — ads, emails, content that converts.",
    iconKey: "ShoppingBag",
    nichePrompt: "What do you sell (e.g. skincare, fashion accessories, supplements)?",
    recommendedSidebar: [
      "/dashboard",
      "/dashboard/analytics",
      "/dashboard/reports",
      "/dashboard/ads-manager",
      "/dashboard/email-composer",
      "/dashboard/email-templates",
      "/dashboard/sms-templates",
      "/dashboard/newsletter",
      "/dashboard/social-manager",
      "/dashboard/content-plan",
      "/dashboard/carousel-generator",
      "/dashboard/design",
      "/dashboard/brand-kit",
      "/dashboard/landing-pages",
      "/dashboard/reviews",
      "/dashboard/integrations",
      "/dashboard/settings",
    ],
    dashboardMetrics: ["orders", "revenue", "aov", "conversion"],
  },
  {
    id: "saas",
    label: "SaaS Founder",
    description: "Signups, activations, retention — growth built for software.",
    iconKey: "Rocket",
    nichePrompt: "What does your SaaS do and who's it for (e.g. CRM for solo founders)?",
    recommendedSidebar: [
      "/dashboard",
      "/dashboard/analytics",
      "/dashboard/reports",
      "/dashboard/outreach-hub",
      "/dashboard/crm",
      "/dashboard/deals",
      "/dashboard/copywriter",
      "/dashboard/email-composer",
      "/dashboard/landing-pages",
      "/dashboard/newsletter",
      "/dashboard/social-manager",
      "/dashboard/content-plan",
      "/dashboard/workflows",
      "/dashboard/webhooks",
      "/dashboard/api-docs",
      "/dashboard/integrations",
      "/dashboard/settings",
    ],
    dashboardMetrics: ["signups", "activations", "mrr", "churn"],
  },
  {
    id: "service_provider",
    label: "Service Provider / Freelancer",
    description: "Independent pro — land clients, deliver work, get paid.",
    iconKey: "Briefcase",
    nichePrompt: "What service do you offer (e.g. web design, bookkeeping, photography)?",
    recommendedSidebar: [
      "/dashboard",
      "/dashboard/inbox",
      "/dashboard/analytics",
      "/dashboard/crm",
      "/dashboard/deals",
      "/dashboard/proposals",
      "/dashboard/outreach-hub",
      "/dashboard/calendar",
      "/dashboard/scheduling",
      "/dashboard/copywriter",
      "/dashboard/email-composer",
      "/dashboard/landing-pages",
      "/dashboard/social-manager",
      "/dashboard/invoices",
      "/dashboard/integrations",
      "/dashboard/settings",
    ],
    dashboardMetrics: ["leads", "sessions_booked", "revenue", "tasks_done"],
  },
  {
    id: "other",
    label: "Something Else",
    description: "Tell us about you — we'll personalize ShortStack for your business.",
    iconKey: "Sparkles",
    nichePrompt: "Tell us what kind of business you run — as specific as you can.",
    recommendedSidebar: [
      "/dashboard",
      "/dashboard/analytics",
      "/dashboard/crm",
      "/dashboard/copywriter",
      "/dashboard/email-composer",
      "/dashboard/social-manager",
      "/dashboard/content-plan",
      "/dashboard/integrations",
      "/dashboard/settings",
    ],
    dashboardMetrics: ["revenue", "leads", "engagement", "tasks_done"],
  },
];

export function getUserTypeMeta(id: string | null | undefined): UserTypeMeta {
  return USER_TYPES.find((u) => u.id === id) || USER_TYPES[0];
}

/* ─── Dashboard metric descriptors ────────────────────────────────────── */
export const METRIC_LABELS: Record<DashboardMetricKey, { label: string; hint: string }> = {
  clients: { label: "Active Clients", hint: "Currently onboarded clients" },
  mrr: { label: "MRR", hint: "Monthly recurring revenue" },
  outreach: { label: "Outreach Sent", hint: "Messages sent today" },
  leads: { label: "Leads", hint: "New leads this period" },
  views: { label: "Views", hint: "Content views this period" },
  subscribers: { label: "Subscribers", hint: "Total subscriber count" },
  engagement: { label: "Engagement", hint: "Likes, comments, shares" },
  content_pieces: { label: "Content Pieces", hint: "Published this period" },
  listings: { label: "Active Listings", hint: "Currently on market" },
  showings: { label: "Showings", hint: "Scheduled this week" },
  closings: { label: "Closings", hint: "Deals closed this month" },
  sessions_booked: { label: "Sessions Booked", hint: "Scheduled sessions" },
  revenue: { label: "Revenue", hint: "Total revenue this period" },
  churn: { label: "Churn Rate", hint: "Monthly churn %" },
  signups: { label: "Signups", hint: "New accounts this period" },
  activations: { label: "Activations", hint: "Users who activated" },
  orders: { label: "Orders", hint: "Orders placed this period" },
  aov: { label: "Avg. Order Value", hint: "Average order value" },
  conversion: { label: "Conversion", hint: "Visitor → customer %" },
  tasks_done: { label: "Tasks Done", hint: "Completed this period" },
};
