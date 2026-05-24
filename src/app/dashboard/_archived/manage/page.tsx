"use client";
import { Briefcase, Buildings, Calculator, ChartBar, CreditCard, Crown, CurrencyDollar, DownloadSimple, Gift, Heart, Lifebuoy, Lightning, Link, Phone, Pulse, Receipt, SquaresFour, Star, Storefront, UserPlus, UsersThree } from "@phosphor-icons/react";

import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import SectionHub from "@/components/dashboard/section-hub";
import type { RollingPreviewItem } from "@/components/RollingPreview";
import { MotionPage } from "@/components/motion/motion-page";

// Muted, operations-focused blueprint cards — these are the artefacts a
// founder/ops lead juggles: team invites, invoices, domains, health.
const MANAGE_HUB_PREVIEW: RollingPreviewItem[] = [
  { id: "mh1", tag: "Team", title: "Invited 2 editors to the Q2 workspace", text: "Scoped to 4 clients — read-only on financials, full edit on content." },
  { id: "mh2", tag: "Workspace", title: "New workspace: Lakeside Apparel", text: "Forked from the Ecom template with brand kit + starter workflows." },
  { id: "mh3", tag: "Billing", title: "Upgraded to Growth — $199/mo", text: "10k contacts, 5 team seats, priority support unlocked." },
  { id: "mh4", tag: "Invoice", title: "INV-0184 · $3,200 · due Apr 28", text: "Auto-chase enabled — 3 reminder touches before escalating to you." },
  { id: "mh5", tag: "Financials", title: "MRR $18.4k ± 2.1% MoM", text: "Expansion from 3 upsells outweighed a single churn event. Healthy." },
  { id: "mh6", tag: "Domain", title: "app.leadengine.co — DNS verified", text: "SSL active, pointing at your production vercel project." },
  { id: "mh7", tag: "Client Health", title: "3 accounts in yellow, 1 in red", text: "Lakeside hasn't logged in 14d — auto-scheduled a check-in call." },
  { id: "mh8", tag: "Ticket", title: "#482 · API webhook timeouts (P1)", text: "Escalated to on-call, customer notified, fix ETA 45m." },
  { id: "mh9", tag: "Review", title: "5-star · Mercer Coffee · 2h ago", text: "Auto-replied with a thank-you and logged to the review dashboard." },
  { id: "mh10", tag: "Referral", title: "+$500 bonus — Mercer referred Blend", text: "Payout queued for the next 1st-of-month settlement run." },
  { id: "mh11", tag: "Reports", title: "Monthly PDF shipped to 12 clients", text: "Branded with each client's logo + a Loom walkthrough from you." },
  { id: "mh12", tag: "Monitor", title: "All systems nominal · 99.97% / 30d", text: "No degradations on Stripe, Supabase or Resend in the last 7 days." },
];

export default function ManageHubPage() {
  useAuth();

  return (
    <MotionPage>
            <SectionHub
            section="manage"
            title="Manage"
            eyebrow="Section · Operations"
            subtitle="Your team, workspaces, billing, and everything operational."
            heroIcon={<Briefcase size={22} />}
            heroGradient="gold"
            preview={{
              items: MANAGE_HUB_PREVIEW,
              variant: "text",
              aspectRatio: "16:9",
              opacity: 0.5,
              caption: "Team, billing, clients, reports — the engine room",
            }}
            quickActions={[
              { label: "Add to Agency", href: "/dashboard/team", icon: UserPlus },
              { label: "Invite Team Member", href: "/dashboard/team", icon: UsersThree },
              { label: "Upgrade Plan", href: "/dashboard/pricing", icon: Crown },
              { label: "DownloadSimple Desktop", href: "/dashboard/download", icon: DownloadSimple },
            ]}
            stats={[
              { label: "Team Members", key: "team_members", icon: UsersThree, color: "text-brand-accent" },
              { label: "Workspaces", key: "workspaces", icon: Buildings, color: "text-brand-accent" },
              { label: "Plan", key: "plan_tier", icon: Crown, color: "text-amber-700", format: "passthrough" },
              { label: "Spend (30d)", key: "monthly_spend", icon: CurrencyDollar, color: "text-emerald-700", format: "currency" },
            ]}
            tools={[
              {
                slug: "workspaces",
                label: "Workspaces",
                description: "Separate workspaces for clients or sub-agencies.",
                href: "/dashboard/workspaces",
                icon: Buildings,
              },
              {
                slug: "team",
                label: "Team",
                description: "Invite members, assign roles, control access.",
                href: "/dashboard/team",
                icon: UsersThree,
              },
              {
                slug: "production",
                label: "Production",
                description: "SquaresFour board for content and delivery work.",
                href: "/dashboard/production",
                icon: SquaresFour,
              },
              {
                slug: "projects",
                label: "Projects",
                description: "Track every client project end-to-end.",
                href: "/dashboard/projects",
                icon: SquaresFour,
              },
              {
                slug: "financials",
                label: "Financials",
                description: "Revenue, spend, MRR and margin at a glance.",
                href: "/dashboard/financials",
                icon: ChartBar,
              },
              {
                slug: "invoices",
                label: "Invoices",
                description: "Draft, send, and auto-chase invoices.",
                href: "/dashboard/invoices",
                icon: Receipt,
              },
              {
                slug: "billing",
                label: "Billing",
                description: "Manage your subscription and payment methods.",
                href: "/dashboard/billing",
                icon: CreditCard,
              },
              {
                slug: "pricing",
                label: "Pricing",
                description: "Compare plans and upgrade your tier.",
                href: "/dashboard/pricing",
                icon: CreditCard,
              },
              {
                slug: "usage",
                label: "Usage & Tokens",
                description: "Track AI, email, and SMS usage in real time.",
                href: "/dashboard/usage",
                icon: Lightning,
              },
              {
                slug: "phone-email",
                label: "Phone & Email",
                description: "Provision and assign business phone numbers.",
                href: "/dashboard/phone-email",
                icon: Phone,
              },
              {
                slug: "domains",
                label: "Domains",
                description: "Buy and wire up custom domains.",
                href: "/dashboard/domains",
                icon: Link,
              },
              {
                slug: "client-health",
                label: "Client Health",
                description: "Retention risk scores for every client.",
                href: "/dashboard/client-health",
                icon: Heart,
              },
              {
                slug: "reviews",
                label: "Reviews",
                description: "Collect and respond to public reviews.",
                href: "/dashboard/reviews",
                icon: Star,
              },
              {
                slug: "tickets",
                label: "Tickets",
                description: "Client support inbox with SLA tracking.",
                href: "/dashboard/tickets",
                icon: Lifebuoy,
              },
              {
                slug: "referrals",
                label: "Referrals",
                description: "Track partner referrals and payouts.",
                href: "/dashboard/referrals",
                icon: Gift,
              },
              {
                slug: "roi-calculator",
                label: "ROI Calculator",
                description: "Show clients their ROI in live dashboards.",
                href: "/dashboard/roi-calculator",
                icon: Calculator,
              },
              {
                slug: "monitor",
                label: "Monitor",
                description: "Live status of every connected service.",
                href: "/dashboard/monitor",
                icon: Pulse,
              },
              {
                slug: "report-generator",
                label: "Reports Gen",
                description: "Generate branded PDF reports on demand.",
                href: "/dashboard/report-generator",
                icon: ChartBar,
              },
              {
                slug: "marketplace",
                label: "Marketplace",
                description: "Install templates, workflows, and prebuilt agents.",
                href: "/dashboard/marketplace",
                icon: Storefront,
              },
              {
                slug: "download",
                label: "DownloadSimple Desktop",
                description: "Get the ShortStack macOS and Windows app.",
                href: "/dashboard/download",
                icon: DownloadSimple,
              },
            ]}
          />
          </MotionPage>
  );
}
