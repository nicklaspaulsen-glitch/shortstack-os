"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Store, Search, Star, Download, CheckCircle, Shield, X,
  ExternalLink, Settings, Trash2,
  Code2, BookOpen, Upload, Loader, ArrowUpDown,
  Zap, MessageSquare, BarChart3, Brain, Bot, Globe,
  Link2, Megaphone, Mail, Phone, Calendar, FileText,
  CreditCard, Database, Users, Sparkles, TrendingUp,
  Send, Hash, Image, LayoutGrid, Filter,
  Clock, Tag, Heart, AlertCircle
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";

// ── Types ──

type Category = "all" | "crm" | "marketing" | "analytics" | "ai" | "automation" | "communication" | "integrations";
type SortBy = "popular" | "newest" | "rating";
type ViewTab = "browse" | "installed";

interface Plugin {
  id: string;
  name: string;
  author: string;
  description: string;
  longDescription: string;
  icon: React.ReactNode;
  iconColor: string;
  category: Category;
  price: number;
  rating: number;
  installs: number;
  verified: boolean;
  tags: string[];
  features: string[];
  changelog: { version: string; date: string; notes: string }[];
  requirements: string[];
  screenshots: { label: string; color: string }[];
  reviews: { name: string; avatar: string; rating: number; comment: string; date: string }[];
  settings: { key: string; label: string; type: string; default?: string | boolean }[];
  version: string;
  updatedAt: string;
}

// ── Category config ──

const CATEGORIES: { key: Category; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <LayoutGrid size={14} /> },
  { key: "crm", label: "CRM", icon: <Users size={14} /> },
  { key: "marketing", label: "Marketing", icon: <Megaphone size={14} /> },
  { key: "analytics", label: "Analytics", icon: <BarChart3 size={14} /> },
  { key: "ai", label: "AI", icon: <Brain size={14} /> },
  { key: "automation", label: "Automation", icon: <Zap size={14} /> },
  { key: "communication", label: "Communication", icon: <MessageSquare size={14} /> },
  { key: "integrations", label: "Integrations", icon: <Link2 size={14} /> },
];

// ── Plugin catalog ──

const PLUGIN_CATALOG: Plugin[] = [
  {
    id: "slack-integration",
    name: "Slack Integration",
    author: "ShortStack",
    description: "Send CRM updates to Slack channels in real time.",
    longDescription: "Automatically push CRM events, deal updates, and team notifications to your Slack workspace. Configure per-channel routing, custom message templates, and trigger conditions. Perfect for keeping your team in sync without leaving Slack.",
    icon: <Hash size={20} />,
    iconColor: "#4A154B",
    category: "communication",
    price: 0,
    rating: 4.8,
    installs: 12000,
    verified: true,
    tags: ["Messaging", "Team", "Notifications"],
    version: "2.4.1",
    updatedAt: "2026-04-10",
    features: [
      "Real-time CRM event notifications",
      "Per-channel message routing",
      "Custom message templates with variables",
      "Deal stage change alerts",
      "New lead intake notifications",
      "Thread-based conversation tracking",
    ],
    changelog: [
      { version: "2.4.1", date: "2026-04-10", notes: "Fixed thread reply matching for deal updates" },
      { version: "2.4.0", date: "2026-03-28", notes: "Added custom message templates and variable support" },
      { version: "2.3.0", date: "2026-02-15", notes: "Multi-workspace support" },
    ],
    requirements: ["Slack workspace with admin access", "ShortStack Pro plan or above"],
    screenshots: [
      { label: "Channel Configuration", color: "#4A154B" },
      { label: "Notification Preview", color: "#611f69" },
      { label: "Template Editor", color: "#36C5F0" },
    ],
    reviews: [
      { name: "Alex R.", avatar: "AR", rating: 5, comment: "This plugin saved our team hours of manual updating. Notifications are instant and the templates are flexible.", date: "2026-04-02" },
      { name: "Maria S.", avatar: "MS", rating: 5, comment: "Best Slack integration I have used. Channels stay clean with filtered notifications.", date: "2026-03-20" },
      { name: "James K.", avatar: "JK", rating: 4, comment: "Great plugin. Would love to see Discord support too.", date: "2026-03-05" },
    ],
    settings: [
      { key: "workspace_id", label: "Slack Workspace ID", type: "text" },
      { key: "default_channel", label: "Default Channel", type: "text", default: "#general" },
      { key: "notify_deals", label: "Notify on Deal Changes", type: "toggle", default: true },
      { key: "notify_leads", label: "Notify on New Leads", type: "toggle", default: true },
    ],
  },
  {
    id: "notion-sync-pro",
    name: "Notion Sync Pro",
    author: "SyncLabs",
    description: "Two-way sync with Notion databases for seamless workflows.",
    longDescription: "Keep your ShortStack CRM data perfectly in sync with Notion. Map fields between systems, set sync frequency, and handle conflicts intelligently. Ideal for teams that use Notion as a second brain alongside their CRM.",
    icon: <FileText size={20} />,
    iconColor: "#000000",
    category: "integrations",
    price: 9,
    rating: 4.6,
    installs: 8000,
    verified: true,
    tags: ["Productivity", "Sync", "Databases"],
    version: "1.8.0",
    updatedAt: "2026-04-05",
    features: [
      "Bi-directional database sync",
      "Custom field mapping",
      "Conflict resolution rules",
      "Scheduled or real-time sync",
      "Sync history and audit log",
      "Multi-database support",
    ],
    changelog: [
      { version: "1.8.0", date: "2026-04-05", notes: "Added multi-database sync and parallel processing" },
      { version: "1.7.2", date: "2026-03-18", notes: "Fixed date format handling for ISO 8601" },
    ],
    requirements: ["Notion integration token", "At least one Notion database"],
    screenshots: [
      { label: "Field Mapping", color: "#191919" },
      { label: "Sync Dashboard", color: "#2e2e2e" },
      { label: "Conflict Resolution", color: "#37352f" },
    ],
    reviews: [
      { name: "Taylor B.", avatar: "TB", rating: 5, comment: "Sync is flawless. I run my entire pipeline through Notion now.", date: "2026-03-28" },
      { name: "Priya M.", avatar: "PM", rating: 4, comment: "Solid product. Sync takes a minute on large databases but works.", date: "2026-03-10" },
    ],
    settings: [
      { key: "notion_token", label: "Notion Integration Token", type: "text" },
      { key: "sync_frequency", label: "Sync Frequency (minutes)", type: "text", default: "15" },
      { key: "auto_resolve", label: "Auto-resolve Conflicts", type: "toggle", default: false },
    ],
  },
  {
    id: "zapier-connector",
    name: "Zapier Connector",
    author: "ShortStack",
    description: "Connect 5,000+ apps via Zapier with zero code.",
    longDescription: "Unlock the full power of Zapier from inside ShortStack. Trigger zaps from CRM events, receive data from external apps, and build multi-step automations. Includes pre-built templates for the most popular workflows.",
    icon: <Zap size={20} />,
    iconColor: "#FF4A00",
    category: "automation",
    price: 0,
    rating: 4.5,
    installs: 15000,
    verified: true,
    tags: ["Automation", "No-Code", "Workflows"],
    version: "3.1.0",
    updatedAt: "2026-04-12",
    features: [
      "Trigger zaps from any CRM event",
      "Receive webhook data from 5,000+ apps",
      "Pre-built workflow templates",
      "Multi-step zap support",
      "Error handling and retry logic",
      "Usage analytics dashboard",
    ],
    changelog: [
      { version: "3.1.0", date: "2026-04-12", notes: "New template gallery with 50+ ready-to-use workflows" },
      { version: "3.0.0", date: "2026-03-01", notes: "Major rewrite with parallel zap execution" },
    ],
    requirements: ["Zapier account (free or paid)"],
    screenshots: [
      { label: "Zap Builder", color: "#FF4A00" },
      { label: "Template Gallery", color: "#ff6633" },
      { label: "Analytics", color: "#cc3b00" },
    ],
    reviews: [
      { name: "Omar H.", avatar: "OH", rating: 5, comment: "The missing piece for our automation stack. Flawless.", date: "2026-04-01" },
      { name: "Leah W.", avatar: "LW", rating: 4, comment: "Works great. Wish there were more pre-built templates.", date: "2026-03-15" },
    ],
    settings: [
      { key: "api_key", label: "Zapier API Key", type: "text" },
      { key: "webhook_url", label: "Webhook URL", type: "text" },
      { key: "auto_retry", label: "Auto-retry Failed Zaps", type: "toggle", default: true },
    ],
  },
  {
    id: "google-ads-reporter",
    name: "Google Ads Reporter",
    author: "AdMetrics",
    description: "Auto-import Google Ads data into your analytics dashboard.",
    longDescription: "Pull campaign performance data from Google Ads directly into ShortStack. Track spend, conversions, ROAS, and attribution alongside your CRM metrics. Scheduled imports keep data fresh without manual exports.",
    icon: <TrendingUp size={20} />,
    iconColor: "#4285F4",
    category: "analytics",
    price: 12,
    rating: 4.7,
    installs: 6000,
    verified: true,
    tags: ["Ads", "Google", "Reporting"],
    version: "2.1.0",
    updatedAt: "2026-04-08",
    features: [
      "Automatic campaign data import",
      "ROAS and conversion tracking",
      "Custom date range reports",
      "Multi-account support",
      "Budget alerting",
      "Attribution modeling",
    ],
    changelog: [
      { version: "2.1.0", date: "2026-04-08", notes: "Added Performance Max campaign support" },
      { version: "2.0.0", date: "2026-03-10", notes: "New attribution modeling engine" },
    ],
    requirements: ["Google Ads account", "Google OAuth connection"],
    screenshots: [
      { label: "Campaign Dashboard", color: "#4285F4" },
      { label: "ROAS Report", color: "#34A853" },
      { label: "Budget Alerts", color: "#EA4335" },
    ],
    reviews: [
      { name: "Chris D.", avatar: "CD", rating: 5, comment: "Finally I can see ad spend next to deal revenue. Game changer.", date: "2026-03-25" },
      { name: "Nina P.", avatar: "NP", rating: 4, comment: "Data is accurate and imports are fast. Would like custom columns.", date: "2026-03-08" },
    ],
    settings: [
      { key: "account_id", label: "Google Ads Account ID", type: "text" },
      { key: "import_frequency", label: "Import Frequency", type: "select", default: "daily" },
      { key: "budget_alerts", label: "Enable Budget Alerts", type: "toggle", default: true },
    ],
  },
  {
    id: "meta-ads-sync",
    name: "Meta Ads Sync",
    author: "AdMetrics",
    description: "Track Facebook and Instagram ad performance in one place.",
    longDescription: "Consolidate your Meta advertising data inside ShortStack. View campaign metrics, audience insights, and creative performance without switching platforms. Includes automated reporting and anomaly detection.",
    icon: <Megaphone size={20} />,
    iconColor: "#0668E1",
    category: "marketing",
    price: 12,
    rating: 4.4,
    installs: 5000,
    verified: true,
    tags: ["Meta", "Ads", "Social"],
    version: "1.6.0",
    updatedAt: "2026-04-02",
    features: [
      "Facebook & Instagram ad tracking",
      "Audience insight reports",
      "Creative performance analysis",
      "Automated weekly reports",
      "Anomaly detection alerts",
      "Cross-platform attribution",
    ],
    changelog: [
      { version: "1.6.0", date: "2026-04-02", notes: "Instagram Reels ad support added" },
      { version: "1.5.1", date: "2026-03-14", notes: "Fixed audience overlap calculations" },
    ],
    requirements: ["Meta Business account", "Facebook Marketing API access"],
    screenshots: [
      { label: "Campaign Overview", color: "#0668E1" },
      { label: "Audience Insights", color: "#1877F2" },
    ],
    reviews: [
      { name: "Sara L.", avatar: "SL", rating: 5, comment: "Saves me 2 hours a week of report building.", date: "2026-03-30" },
      { name: "Devon T.", avatar: "DT", rating: 4, comment: "Works as advertised. Clean interface.", date: "2026-03-12" },
    ],
    settings: [
      { key: "meta_token", label: "Meta Access Token", type: "text" },
      { key: "ad_accounts", label: "Ad Account IDs (comma separated)", type: "text" },
      { key: "anomaly_alerts", label: "Enable Anomaly Alerts", type: "toggle", default: true },
    ],
  },
  {
    id: "ai-lead-scorer",
    name: "AI Lead Scorer",
    author: "Predictive.ai",
    description: "ML-based lead scoring that learns from your closed deals.",
    longDescription: "Leverage machine learning to automatically score and rank your leads based on behavioral signals, demographic data, and historical conversion patterns. The model improves over time as you close more deals, delivering increasingly accurate predictions.",
    icon: <Brain size={20} />,
    iconColor: "#8B5CF6",
    category: "ai",
    price: 15,
    rating: 4.9,
    installs: 9000,
    verified: true,
    tags: ["ML", "Scoring", "Leads"],
    version: "3.0.2",
    updatedAt: "2026-04-11",
    features: [
      "Automatic lead scoring from 0-100",
      "Behavioral signal tracking",
      "Custom scoring model training",
      "Score breakdown explanations",
      "Priority queue for sales team",
      "Weekly model accuracy reports",
    ],
    changelog: [
      { version: "3.0.2", date: "2026-04-11", notes: "Improved scoring accuracy by 12% with new feature set" },
      { version: "3.0.0", date: "2026-03-20", notes: "New transformer-based scoring model" },
    ],
    requirements: ["At least 100 historical deals for training", "ShortStack Pro plan"],
    screenshots: [
      { label: "Score Dashboard", color: "#8B5CF6" },
      { label: "Model Training", color: "#7C3AED" },
      { label: "Score Breakdown", color: "#6D28D9" },
    ],
    reviews: [
      { name: "Rachel K.", avatar: "RK", rating: 5, comment: "Our conversion rate jumped 30% after we started following the scores. Incredible.", date: "2026-04-05" },
      { name: "Mark J.", avatar: "MJ", rating: 5, comment: "The score explanations are helpful for coaching the team.", date: "2026-03-22" },
      { name: "Yuki T.", avatar: "YT", rating: 5, comment: "Most valuable plugin we have installed. Worth every penny.", date: "2026-03-10" },
    ],
    settings: [
      { key: "min_deals", label: "Min Deals for Training", type: "text", default: "100" },
      { key: "auto_retrain", label: "Auto-retrain Weekly", type: "toggle", default: true },
      { key: "score_threshold", label: "Hot Lead Threshold", type: "text", default: "75" },
    ],
  },
  {
    id: "whatsapp-business",
    name: "WhatsApp Business",
    author: "ShortStack",
    description: "Full WhatsApp integration for client communication.",
    longDescription: "Send and receive WhatsApp messages directly from ShortStack. Manage conversations, use message templates, set up auto-replies, and track delivery metrics. Supports WhatsApp Business API for high-volume messaging.",
    icon: <Phone size={20} />,
    iconColor: "#25D366",
    category: "communication",
    price: 19,
    rating: 4.3,
    installs: 7000,
    verified: true,
    tags: ["WhatsApp", "Messaging", "Chat"],
    version: "2.2.0",
    updatedAt: "2026-04-06",
    features: [
      "Two-way WhatsApp messaging",
      "Message template management",
      "Auto-reply rules",
      "Media sharing support",
      "Delivery and read receipts",
      "Conversation analytics",
    ],
    changelog: [
      { version: "2.2.0", date: "2026-04-06", notes: "Added rich media message support" },
      { version: "2.1.0", date: "2026-03-15", notes: "Auto-reply rule builder" },
    ],
    requirements: ["WhatsApp Business API account", "Verified phone number"],
    screenshots: [
      { label: "Chat Interface", color: "#25D366" },
      { label: "Template Manager", color: "#128C7E" },
      { label: "Analytics", color: "#075E54" },
    ],
    reviews: [
      { name: "Carlos M.", avatar: "CM", rating: 4, comment: "Works well for our Latin American clients. Template approval is slow but that is on Meta.", date: "2026-03-28" },
      { name: "Anita R.", avatar: "AR", rating: 5, comment: "Our clients love getting updates on WhatsApp instead of email.", date: "2026-03-10" },
    ],
    settings: [
      { key: "phone_id", label: "Phone Number ID", type: "text" },
      { key: "api_token", label: "WhatsApp API Token", type: "text" },
      { key: "auto_reply", label: "Enable Auto-Reply", type: "toggle", default: false },
    ],
  },
  {
    id: "stripe-billing",
    name: "Stripe Billing",
    author: "ShortStack",
    description: "Auto-generate invoices from closed deals via Stripe.",
    longDescription: "Seamlessly connect your Stripe account to automatically create invoices when deals close. Supports recurring billing, payment tracking, and revenue reporting. No more manual invoice creation or payment chasing.",
    icon: <CreditCard size={20} />,
    iconColor: "#635BFF",
    category: "integrations",
    price: 0,
    rating: 4.8,
    installs: 11000,
    verified: true,
    tags: ["Payments", "Invoicing", "Billing"],
    version: "3.2.0",
    updatedAt: "2026-04-09",
    features: [
      "Auto-invoice on deal close",
      "Recurring billing support",
      "Payment status tracking",
      "Revenue dashboards",
      "Tax calculation",
      "Multi-currency support",
    ],
    changelog: [
      { version: "3.2.0", date: "2026-04-09", notes: "Added multi-currency and tax calculation" },
      { version: "3.1.0", date: "2026-03-22", notes: "Recurring billing automation" },
    ],
    requirements: ["Stripe account", "Stripe API keys"],
    screenshots: [
      { label: "Invoice Preview", color: "#635BFF" },
      { label: "Payment Dashboard", color: "#7A73FF" },
      { label: "Revenue Report", color: "#4F46E5" },
    ],
    reviews: [
      { name: "Patricia G.", avatar: "PG", rating: 5, comment: "Saves us hours every week. Invoices go out the moment we close.", date: "2026-04-01" },
      { name: "Kevin L.", avatar: "KL", rating: 5, comment: "Clean implementation. Multi-currency was the feature we needed.", date: "2026-03-18" },
    ],
    settings: [
      { key: "stripe_key", label: "Stripe Secret Key", type: "text" },
      { key: "auto_invoice", label: "Auto-invoice on Close", type: "toggle", default: true },
      { key: "default_currency", label: "Default Currency", type: "text", default: "USD" },
    ],
  },
  {
    id: "hubspot-importer",
    name: "HubSpot Importer",
    author: "MigrateKit",
    description: "One-click migration from HubSpot CRM to ShortStack.",
    longDescription: "Migrate your entire HubSpot CRM to ShortStack in minutes. Contacts, companies, deals, notes, activities, and custom properties are all mapped and transferred. Includes a dry-run mode to preview changes before committing.",
    icon: <Database size={20} />,
    iconColor: "#FF7A59",
    category: "crm",
    price: 0,
    rating: 4.2,
    installs: 3000,
    verified: false,
    tags: ["Migration", "HubSpot", "Import"],
    version: "1.3.0",
    updatedAt: "2026-03-28",
    features: [
      "Full contact and company import",
      "Deal pipeline mapping",
      "Custom property transfer",
      "Activity and note migration",
      "Dry-run preview mode",
      "Rollback support",
    ],
    changelog: [
      { version: "1.3.0", date: "2026-03-28", notes: "Added custom property mapping UI" },
      { version: "1.2.0", date: "2026-03-05", notes: "Dry-run preview mode" },
    ],
    requirements: ["HubSpot API key or OAuth app", "HubSpot data export permission"],
    screenshots: [
      { label: "Migration Wizard", color: "#FF7A59" },
      { label: "Field Mapping", color: "#ff8f73" },
    ],
    reviews: [
      { name: "Brian T.", avatar: "BT", rating: 4, comment: "Migrated 10K contacts without issues. Field mapping could be better.", date: "2026-03-20" },
      { name: "Donna S.", avatar: "DS", rating: 4, comment: "Dry run mode is a lifesaver. Used it three times before committing.", date: "2026-03-08" },
    ],
    settings: [
      { key: "hubspot_key", label: "HubSpot API Key", type: "text" },
      { key: "dry_run", label: "Dry Run Mode", type: "toggle", default: true },
    ],
  },
  {
    id: "email-verifier",
    name: "Email Verifier",
    author: "CleanMail",
    description: "Verify lead emails in bulk to reduce bounces.",
    longDescription: "Clean your lead lists by verifying email addresses in bulk. Detect invalid, disposable, and role-based emails before sending campaigns. Integrates with your CRM to automatically flag bad emails on import.",
    icon: <Mail size={20} />,
    iconColor: "#10B981",
    category: "marketing",
    price: 7,
    rating: 4.6,
    installs: 8000,
    verified: true,
    tags: ["Email", "Validation", "Deliverability"],
    version: "2.0.1",
    updatedAt: "2026-04-03",
    features: [
      "Bulk email verification",
      "Disposable email detection",
      "Role-based email flagging",
      "Real-time verification on import",
      "Verification score per email",
      "Export clean/dirty lists",
    ],
    changelog: [
      { version: "2.0.1", date: "2026-04-03", notes: "Improved catch-all domain detection" },
      { version: "2.0.0", date: "2026-03-12", notes: "New verification engine with 99.5% accuracy" },
    ],
    requirements: ["CleanMail API key"],
    screenshots: [
      { label: "Bulk Verify", color: "#10B981" },
      { label: "Results Report", color: "#059669" },
    ],
    reviews: [
      { name: "Stephanie W.", avatar: "SW", rating: 5, comment: "Dropped our bounce rate from 8% to under 1%. Essential.", date: "2026-03-25" },
      { name: "Ahmed K.", avatar: "AK", rating: 4, comment: "Fast and accurate. Bulk processing handles 50K emails easily.", date: "2026-03-10" },
    ],
    settings: [
      { key: "api_key", label: "CleanMail API Key", type: "text" },
      { key: "auto_verify", label: "Auto-verify on Import", type: "toggle", default: true },
      { key: "threshold", label: "Min Score to Accept", type: "text", default: "70" },
    ],
  },
  {
    id: "sms-auto-responder",
    name: "SMS Auto-Responder",
    author: "ReplyBot",
    description: "AI-powered SMS replies that handle leads 24/7.",
    longDescription: "Never miss a lead again. This plugin uses AI to automatically respond to incoming SMS messages based on your custom rules and conversation flows. Handles appointment scheduling, FAQ responses, and lead qualification around the clock.",
    icon: <Bot size={20} />,
    iconColor: "#F59E0B",
    category: "ai",
    price: 10,
    rating: 4.5,
    installs: 4000,
    verified: true,
    tags: ["SMS", "AI", "Auto-Reply"],
    version: "1.5.0",
    updatedAt: "2026-04-07",
    features: [
      "AI-powered conversation flows",
      "Custom reply rules",
      "Appointment scheduling via SMS",
      "FAQ auto-responder",
      "Lead qualification questions",
      "Handoff to human agent",
    ],
    changelog: [
      { version: "1.5.0", date: "2026-04-07", notes: "Added GPT-4o powered response generation" },
      { version: "1.4.0", date: "2026-03-18", notes: "Appointment scheduling integration" },
    ],
    requirements: ["Twilio or compatible SMS provider", "ShortStack Pro plan"],
    screenshots: [
      { label: "Flow Builder", color: "#F59E0B" },
      { label: "Conversation Log", color: "#D97706" },
      { label: "Rule Editor", color: "#B45309" },
    ],
    reviews: [
      { name: "Lisa H.", avatar: "LH", rating: 5, comment: "Booked 15 appointments last week while I slept. This is incredible.", date: "2026-04-02" },
      { name: "Tom N.", avatar: "TN", rating: 4, comment: "AI responses are surprisingly good. Had to tweak a few rules.", date: "2026-03-20" },
    ],
    settings: [
      { key: "provider", label: "SMS Provider", type: "select", default: "twilio" },
      { key: "ai_model", label: "AI Model", type: "select", default: "gpt-4o" },
      { key: "handoff_enabled", label: "Enable Human Handoff", type: "toggle", default: true },
    ],
  },
  {
    id: "calendar-sync",
    name: "Calendar Sync",
    author: "ShortStack",
    description: "Sync Google Calendar and Outlook events two-way.",
    longDescription: "Keep your calendar and CRM in perfect sync. Meetings created in ShortStack appear in Google Calendar or Outlook, and vice versa. Supports multiple calendars, color coding, and automatic conflict detection.",
    icon: <Calendar size={20} />,
    iconColor: "#3B82F6",
    category: "integrations",
    price: 0,
    rating: 4.7,
    installs: 10000,
    verified: true,
    tags: ["Calendar", "Google", "Outlook"],
    version: "2.6.0",
    updatedAt: "2026-04-04",
    features: [
      "Google Calendar two-way sync",
      "Outlook Calendar two-way sync",
      "Multi-calendar support",
      "Conflict detection",
      "Color-coded event types",
      "Automatic timezone handling",
    ],
    changelog: [
      { version: "2.6.0", date: "2026-04-04", notes: "Added Outlook 365 support" },
      { version: "2.5.0", date: "2026-03-10", notes: "Multi-calendar sync" },
    ],
    requirements: ["Google or Outlook account"],
    screenshots: [
      { label: "Calendar View", color: "#3B82F6" },
      { label: "Sync Settings", color: "#2563EB" },
    ],
    reviews: [
      { name: "Daniel F.", avatar: "DF", rating: 5, comment: "Zero double-bookings since installing. Sync is instant.", date: "2026-03-30" },
      { name: "Grace L.", avatar: "GL", rating: 5, comment: "Outlook support was the missing piece. Works perfectly.", date: "2026-03-15" },
    ],
    settings: [
      { key: "provider", label: "Calendar Provider", type: "select", default: "google" },
      { key: "sync_interval", label: "Sync Interval (minutes)", type: "text", default: "5" },
      { key: "conflict_mode", label: "Conflict Resolution", type: "select", default: "crm_wins" },
    ],
  },
  {
    id: "proposal-templates-pro",
    name: "Proposal Templates Pro",
    author: "DocForge",
    description: "50+ premium proposal templates for every industry.",
    longDescription: "Close deals faster with professionally designed proposal templates. Choose from 50+ templates spanning SaaS, marketing agencies, consulting, and more. Customize with your branding, insert CRM data automatically, and track client views.",
    icon: <FileText size={20} />,
    iconColor: "#EC4899",
    category: "crm",
    price: 5,
    rating: 4.4,
    installs: 6000,
    verified: true,
    tags: ["Templates", "Proposals", "Sales"],
    version: "2.1.0",
    updatedAt: "2026-03-30",
    features: [
      "50+ industry-specific templates",
      "Custom branding and colors",
      "Auto-fill from CRM data",
      "Client view tracking",
      "E-signature integration",
      "PDF and web export",
    ],
    changelog: [
      { version: "2.1.0", date: "2026-03-30", notes: "Added 15 new templates for agencies" },
      { version: "2.0.0", date: "2026-03-01", notes: "Complete redesign with new template engine" },
    ],
    requirements: ["ShortStack account"],
    screenshots: [
      { label: "Template Gallery", color: "#EC4899" },
      { label: "Editor", color: "#DB2777" },
      { label: "View Tracking", color: "#BE185D" },
    ],
    reviews: [
      { name: "Emma C.", avatar: "EC", rating: 5, comment: "These templates look incredible. Clients comment on them every time.", date: "2026-03-22" },
      { name: "Robert J.", avatar: "RJ", rating: 4, comment: "Good variety. Would like more tech/startup templates.", date: "2026-03-05" },
    ],
    settings: [
      { key: "brand_color", label: "Brand Primary Color", type: "text", default: "#C9A84C" },
      { key: "auto_fill", label: "Auto-fill CRM Data", type: "toggle", default: true },
    ],
  },
  {
    id: "voice-transcription",
    name: "Voice Transcription",
    author: "VoxScribe",
    description: "Auto-transcribe call recordings with speaker labels.",
    longDescription: "Automatically transcribe your sales calls and meetings with high accuracy. Includes speaker diarization, keyword extraction, sentiment analysis, and searchable transcripts. Never miss a detail from a client conversation again.",
    icon: <Sparkles size={20} />,
    iconColor: "#06B6D4",
    category: "ai",
    price: 8,
    rating: 4.3,
    installs: 3000,
    verified: false,
    tags: ["Voice", "AI", "Transcription"],
    version: "1.4.0",
    updatedAt: "2026-03-25",
    features: [
      "Automatic call transcription",
      "Speaker diarization",
      "Keyword extraction",
      "Sentiment analysis",
      "Searchable transcript library",
      "Export to PDF/TXT",
    ],
    changelog: [
      { version: "1.4.0", date: "2026-03-25", notes: "Added sentiment analysis per speaker" },
      { version: "1.3.0", date: "2026-03-05", notes: "Improved speaker diarization accuracy" },
    ],
    requirements: ["Call recording enabled", "Audio files in MP3/WAV format"],
    screenshots: [
      { label: "Transcript View", color: "#06B6D4" },
      { label: "Speaker Timeline", color: "#0891B2" },
    ],
    reviews: [
      { name: "Michael S.", avatar: "MS", rating: 4, comment: "Accuracy is impressive. Speaker labeling works 90% of the time.", date: "2026-03-18" },
      { name: "Jen P.", avatar: "JP", rating: 4, comment: "Great for reviewing client calls. Wish it was a bit faster.", date: "2026-03-02" },
    ],
    settings: [
      { key: "language", label: "Primary Language", type: "select", default: "en" },
      { key: "auto_transcribe", label: "Auto-transcribe New Recordings", type: "toggle", default: true },
    ],
  },
  {
    id: "social-scheduler",
    name: "Social Scheduler",
    author: "PostPilot",
    description: "Advanced social media scheduling across all platforms.",
    longDescription: "Plan, schedule, and publish social media content across Facebook, Instagram, LinkedIn, Twitter, and TikTok from a single dashboard. Includes AI-powered caption generation, optimal timing suggestions, and engagement analytics.",
    icon: <Globe size={20} />,
    iconColor: "#8B5CF6",
    category: "marketing",
    price: 14,
    rating: 4.6,
    installs: 7000,
    verified: true,
    tags: ["Social", "Scheduling", "Content"],
    version: "2.3.0",
    updatedAt: "2026-04-10",
    features: [
      "Multi-platform scheduling",
      "AI caption generation",
      "Optimal posting times",
      "Content calendar view",
      "Engagement analytics",
      "Hashtag suggestions",
    ],
    changelog: [
      { version: "2.3.0", date: "2026-04-10", notes: "TikTok scheduling and Reels auto-publish" },
      { version: "2.2.0", date: "2026-03-20", notes: "AI caption generator with brand voice" },
    ],
    requirements: ["Connected social media accounts"],
    screenshots: [
      { label: "Content Calendar", color: "#8B5CF6" },
      { label: "Post Editor", color: "#7C3AED" },
      { label: "Analytics", color: "#6D28D9" },
    ],
    reviews: [
      { name: "Victoria A.", avatar: "VA", rating: 5, comment: "Best scheduler I have used. AI captions are shockingly good.", date: "2026-04-05" },
      { name: "Ryan M.", avatar: "RM", rating: 4, comment: "TikTok support is a huge plus. Clean calendar UI.", date: "2026-03-22" },
    ],
    settings: [
      { key: "timezone", label: "Default Timezone", type: "text", default: "America/New_York" },
      { key: "ai_captions", label: "Enable AI Captions", type: "toggle", default: true },
      { key: "auto_hashtags", label: "Auto-suggest Hashtags", type: "toggle", default: true },
    ],
  },
  {
    id: "client-feedback",
    name: "Client Feedback",
    author: "ShortStack",
    description: "Automated NPS and CSAT surveys for your clients.",
    longDescription: "Measure client satisfaction automatically with NPS and CSAT surveys. Send surveys at key touchpoints, track scores over time, and get alerted when satisfaction drops. Includes customizable survey templates and analytics.",
    icon: <Heart size={20} />,
    iconColor: "#EF4444",
    category: "crm",
    price: 0,
    rating: 4.1,
    installs: 2000,
    verified: true,
    tags: ["NPS", "Feedback", "Surveys"],
    version: "1.2.0",
    updatedAt: "2026-03-22",
    features: [
      "NPS survey automation",
      "CSAT survey templates",
      "Score tracking dashboard",
      "Alert on low scores",
      "Custom survey branding",
      "Response analytics",
    ],
    changelog: [
      { version: "1.2.0", date: "2026-03-22", notes: "Added CSAT survey type and custom branding" },
      { version: "1.1.0", date: "2026-02-28", notes: "Low score alerting" },
    ],
    requirements: ["Client email addresses configured"],
    screenshots: [
      { label: "NPS Dashboard", color: "#EF4444" },
      { label: "Survey Editor", color: "#DC2626" },
    ],
    reviews: [
      { name: "Hannah B.", avatar: "HB", rating: 4, comment: "Simple and effective. Caught a churn risk early thanks to NPS alerts.", date: "2026-03-15" },
      { name: "Leo G.", avatar: "LG", rating: 4, comment: "Good free plugin. Would pay for more survey customization.", date: "2026-03-01" },
    ],
    settings: [
      { key: "survey_type", label: "Default Survey Type", type: "select", default: "nps" },
      { key: "auto_send", label: "Auto-send After Milestone", type: "toggle", default: true },
      { key: "alert_threshold", label: "Alert Below Score", type: "text", default: "6" },
    ],
  },
  {
    id: "data-enrichment",
    name: "Data Enrichment",
    author: "ClearBit Labs",
    description: "Enrich leads with company data, tech stack, and more.",
    longDescription: "Automatically enrich your lead and contact records with company information, social profiles, tech stack data, and revenue estimates. Trigger enrichment on import or on demand. Dramatically improve your targeting and personalization.",
    icon: <Database size={20} />,
    iconColor: "#F97316",
    category: "ai",
    price: 20,
    rating: 4.8,
    installs: 5000,
    verified: true,
    tags: ["Enrichment", "Data", "Leads"],
    version: "2.5.0",
    updatedAt: "2026-04-08",
    features: [
      "Company data enrichment",
      "Social profile discovery",
      "Tech stack detection",
      "Revenue and employee estimates",
      "Auto-enrich on import",
      "Batch enrichment for lists",
    ],
    changelog: [
      { version: "2.5.0", date: "2026-04-08", notes: "Added tech stack and intent signal detection" },
      { version: "2.4.0", date: "2026-03-15", notes: "Batch enrichment for up to 10K records" },
    ],
    requirements: ["ClearBit Labs API key", "ShortStack Pro plan"],
    screenshots: [
      { label: "Enrichment Results", color: "#F97316" },
      { label: "Batch Processing", color: "#EA580C" },
      { label: "Company Profile", color: "#C2410C" },
    ],
    reviews: [
      { name: "David W.", avatar: "DW", rating: 5, comment: "Worth every cent. Our outbound got 40% more replies after enrichment.", date: "2026-04-02" },
      { name: "Sophie R.", avatar: "SR", rating: 5, comment: "Tech stack data alone makes this invaluable for targeting.", date: "2026-03-18" },
    ],
    settings: [
      { key: "api_key", label: "ClearBit API Key", type: "text" },
      { key: "auto_enrich", label: "Auto-enrich New Leads", type: "toggle", default: true },
      { key: "fields", label: "Enrichment Fields", type: "text", default: "company,social,tech" },
    ],
  },
  {
    id: "custom-reports-builder",
    name: "Custom Reports Builder",
    author: "ChartStack",
    description: "Drag-and-drop report designer with 30+ chart types.",
    longDescription: "Build beautiful, data-driven reports with a visual drag-and-drop editor. Choose from 30+ chart types, connect to any CRM data source, and schedule automated report delivery. Perfect for client reporting and internal analytics.",
    icon: <BarChart3 size={20} />,
    iconColor: "#14B8A6",
    category: "analytics",
    price: 10,
    rating: 4.5,
    installs: 4000,
    verified: true,
    tags: ["Reports", "Charts", "Analytics"],
    version: "1.9.0",
    updatedAt: "2026-04-06",
    features: [
      "Drag-and-drop report builder",
      "30+ chart types",
      "Multiple data source connections",
      "Scheduled report delivery",
      "White-label export",
      "Interactive dashboard mode",
    ],
    changelog: [
      { version: "1.9.0", date: "2026-04-06", notes: "Added 10 new chart types and pivot tables" },
      { version: "1.8.0", date: "2026-03-18", notes: "White-label PDF export" },
    ],
    requirements: ["ShortStack account"],
    screenshots: [
      { label: "Report Builder", color: "#14B8A6" },
      { label: "Chart Gallery", color: "#0D9488" },
      { label: "Dashboard Mode", color: "#0F766E" },
    ],
    reviews: [
      { name: "Karen T.", avatar: "KT", rating: 5, comment: "Replaced our Tableau subscription. Clients love the automated reports.", date: "2026-03-28" },
      { name: "Andrew P.", avatar: "AP", rating: 4, comment: "Powerful builder. Pivot tables were a great addition.", date: "2026-03-10" },
    ],
    settings: [
      { key: "default_theme", label: "Default Theme", type: "select", default: "dark" },
      { key: "auto_refresh", label: "Auto-refresh Data", type: "toggle", default: true },
      { key: "refresh_interval", label: "Refresh Interval (min)", type: "text", default: "30" },
    ],
  },
  {
    id: "telegram-bot",
    name: "Telegram Bot",
    author: "BotForge",
    description: "Client-facing Telegram bot for support and updates.",
    longDescription: "Deploy a Telegram bot that your clients can use to check project status, submit requests, and receive updates. Fully customizable commands, inline keyboards, and conversation flows. Integrates with your CRM data in real time.",
    icon: <Send size={20} />,
    iconColor: "#229ED9",
    category: "communication",
    price: 0,
    rating: 4.2,
    installs: 2000,
    verified: false,
    tags: ["Telegram", "Bot", "Support"],
    version: "1.1.0",
    updatedAt: "2026-03-20",
    features: [
      "Custom bot commands",
      "Inline keyboard menus",
      "Project status lookups",
      "Request submission",
      "Notification broadcasting",
      "Conversation logging",
    ],
    changelog: [
      { version: "1.1.0", date: "2026-03-20", notes: "Added inline keyboard support and rich messages" },
      { version: "1.0.0", date: "2026-02-15", notes: "Initial release" },
    ],
    requirements: ["Telegram Bot token from BotFather"],
    screenshots: [
      { label: "Bot Commands", color: "#229ED9" },
      { label: "Conversation View", color: "#1B8BC4" },
    ],
    reviews: [
      { name: "Ivan P.", avatar: "IP", rating: 4, comment: "Great for our international clients who prefer Telegram.", date: "2026-03-12" },
      { name: "Nadia K.", avatar: "NK", rating: 4, comment: "Simple setup. Bot is responsive and reliable.", date: "2026-02-28" },
    ],
    settings: [
      { key: "bot_token", label: "Telegram Bot Token", type: "text" },
      { key: "welcome_msg", label: "Welcome Message", type: "text", default: "Welcome! How can I help?" },
    ],
  },
  {
    id: "ab-testing",
    name: "A/B Testing",
    author: "SplitLab",
    description: "Test email and SMS campaign variants for better results.",
    longDescription: "Run statistically rigorous A/B tests on your email and SMS campaigns. Test subject lines, body content, send times, and CTAs. Get automated winner selection based on open rates, click rates, or conversion metrics.",
    icon: <ArrowUpDown size={20} />,
    iconColor: "#A855F7",
    category: "marketing",
    price: 8,
    rating: 4.4,
    installs: 3000,
    verified: true,
    tags: ["Testing", "Email", "Optimization"],
    version: "1.3.0",
    updatedAt: "2026-04-01",
    features: [
      "Email A/B testing",
      "SMS variant testing",
      "Statistical significance calculator",
      "Auto-winner selection",
      "Multi-variant testing (A/B/C/D)",
      "Test history and insights",
    ],
    changelog: [
      { version: "1.3.0", date: "2026-04-01", notes: "Multi-variant testing and sample size calculator" },
      { version: "1.2.0", date: "2026-03-08", notes: "SMS testing support" },
    ],
    requirements: ["Active email or SMS campaigns"],
    screenshots: [
      { label: "Test Setup", color: "#A855F7" },
      { label: "Results Dashboard", color: "#9333EA" },
      { label: "Winner Analysis", color: "#7E22CE" },
    ],
    reviews: [
      { name: "Michelle R.", avatar: "MR", rating: 5, comment: "Subject line testing alone increased our open rate by 22%.", date: "2026-03-25" },
      { name: "Jake F.", avatar: "JF", rating: 4, comment: "Clean UI and the stats are solid. Auto-winner saves time.", date: "2026-03-10" },
    ],
    settings: [
      { key: "confidence_level", label: "Confidence Level (%)", type: "text", default: "95" },
      { key: "auto_winner", label: "Auto-select Winner", type: "toggle", default: true },
      { key: "test_duration", label: "Default Test Duration (hours)", type: "text", default: "24" },
    ],
  },
];

// ── Helper functions ──

function formatInstalls(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return n.toString();
}

function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= Math.round(rating) ? "text-gold fill-gold" : "text-muted/30"}
        />
      ))}
      <span className="ml-1 text-xs text-muted">{rating.toFixed(1)}</span>
    </div>
  );
}

// ── Main page ──

export default function MarketplacePage() {
  useAuth();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [sortBy, setSortBy] = useState<SortBy>("popular");
  const [viewTab, setViewTab] = useState<ViewTab>("browse");
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "reviews" | "changelog" | "settings">("overview");
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set(["slack-integration", "stripe-billing", "calendar-sync"]));
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set(["slack-integration", "stripe-billing", "calendar-sync"]));
  const [installing, setInstalling] = useState<string | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);

  // ── Filtered and sorted plugins ──

  const filteredPlugins = useMemo(() => {
    let list = [...PLUGIN_CATALOG];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.author.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (category !== "all") {
      list = list.filter((p) => p.category === category);
    }

    if (viewTab === "installed") {
      list = list.filter((p) => installedIds.has(p.id));
    }

    switch (sortBy) {
      case "popular":
        list.sort((a, b) => b.installs - a.installs);
        break;
      case "newest":
        list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        break;
      case "rating":
        list.sort((a, b) => b.rating - a.rating);
        break;
    }

    return list;
  }, [search, category, sortBy, viewTab, installedIds]);

  // ── Actions ──

  const handleInstall = async (pluginId: string) => {
    setInstalling(pluginId);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      setInstalledIds((prev) => new Set([...Array.from(prev), pluginId]));
      setEnabledIds((prev) => new Set([...Array.from(prev), pluginId]));
      const plugin = PLUGIN_CATALOG.find((p) => p.id === pluginId);
      toast.success(`${plugin?.name ?? "Plugin"} installed successfully`);
    } catch {
      toast.error("Failed to install plugin");
    } finally {
      setInstalling(null);
    }
  };

  const handleUninstall = (pluginId: string) => {
    setInstalledIds((prev) => {
      const next = new Set(prev);
      next.delete(pluginId);
      return next;
    });
    setEnabledIds((prev) => {
      const next = new Set(prev);
      next.delete(pluginId);
      return next;
    });
    setConfirmUninstall(null);
    const plugin = PLUGIN_CATALOG.find((p) => p.id === pluginId);
    toast.success(`${plugin?.name ?? "Plugin"} uninstalled`);
  };

  const toggleEnabled = (pluginId: string) => {
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(pluginId)) {
        next.delete(pluginId);
        toast.success("Plugin disabled");
      } else {
        next.add(pluginId);
        toast.success("Plugin enabled");
      }
      return next;
    });
  };

  const getHealthStatus = (pluginId: string): "healthy" | "warning" | "error" => {
    if (pluginId === "calendar-sync") return "warning";
    if (!enabledIds.has(pluginId)) return "error";
    return "healthy";
  };

  // ── Render ──

  return (
    <div className="space-y-6 pb-32">
      {/* ── Header ── */}
      <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
            <Store size={22} className="text-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Marketplace</h1>
            <p className="text-sm text-muted">Discover plugins to supercharge your workflow</p>
          </div>
        </div>

        {/* Tab toggle */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-1">
          <button
            onClick={() => setViewTab("browse")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
              viewTab === "browse"
                ? "bg-gold/10 text-gold"
                : "text-muted hover:text-white"
            }`}
          >
            Browse
          </button>
          <button
            onClick={() => setViewTab("installed")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
              viewTab === "installed"
                ? "bg-gold/10 text-gold"
                : "text-muted hover:text-white"
            }`}
          >
            My Plugins
            <span className="ml-1.5 rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold">
              {installedIds.size}
            </span>
          </button>
        </div>
      </div>

      {/* ── Search + filters ── */}
      <div className="space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search plugins by name, author, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Category pills + sort */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  category === cat.key
                    ? "bg-gold/10 text-gold ring-1 ring-gold/30"
                    : "bg-surface text-muted hover:bg-surface-light hover:text-white"
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-white focus:border-gold/50 focus:outline-none"
            >
              <option value="popular">Popular</option>
              <option value="newest">Newest</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="flex items-center gap-6 border-b border-border pb-4">
        <div className="text-sm text-muted">
          <span className="font-semibold text-white">{filteredPlugins.length}</span> plugins found
        </div>
        <div className="text-sm text-muted">
          <span className="font-semibold text-white">{PLUGIN_CATALOG.filter((p) => p.price === 0).length}</span> free
        </div>
        <div className="text-sm text-muted">
          <span className="font-semibold text-white">{PLUGIN_CATALOG.filter((p) => p.verified).length}</span> verified
        </div>
      </div>

      {/* ── Plugin grid ── */}
      {viewTab === "browse" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPlugins.map((plugin) => {
            const isInstalled = installedIds.has(plugin.id);
            const isInstalling = installing === plugin.id;

            return (
              <div
                key={plugin.id}
                className="card group cursor-pointer transition-all hover:border-gold/30 hover:shadow-lg hover:shadow-gold/5"
                onClick={() => {
                  setSelectedPlugin(plugin);
                  setDetailTab("overview");
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: plugin.iconColor + "22", color: plugin.iconColor }}
                  >
                    {plugin.icon}
                  </div>

                  {/* Name + author */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-white group-hover:text-gold transition-colors">
                        {plugin.name}
                      </h3>
                      {plugin.verified && (
                        <div className="flex items-center gap-0.5 rounded-full bg-blue-500/10 px-1.5 py-0.5" title="Verified">
                          <Shield size={10} className="text-blue-400" />
                          <span className="text-[9px] font-bold text-blue-400">VERIFIED</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted">by {plugin.author}</p>
                  </div>

                  {/* Price */}
                  <div className="flex-shrink-0">
                    {plugin.price === 0 ? (
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                        Free
                      </span>
                    ) : (
                      <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-[11px] font-bold text-gold">
                        ${plugin.price}/mo
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted">
                  {plugin.description}
                </p>

                {/* Rating + installs */}
                <div className="mt-3 flex items-center justify-between">
                  <StarRating rating={plugin.rating} />
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <Download size={11} />
                    {formatInstalls(plugin.installs)}
                  </div>
                </div>

                {/* Tags */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {plugin.tags.map((tag) => (
                    <span key={tag} className="rounded-md bg-surface-light px-2 py-0.5 text-[10px] font-medium text-muted">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Install button */}
                <div className="mt-4 border-t border-border pt-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isInstalled && !isInstalling) handleInstall(plugin.id);
                    }}
                    disabled={isInstalling}
                    className={`w-full rounded-lg py-2 text-xs font-semibold transition-all ${
                      isInstalled
                        ? "bg-emerald-500/10 text-emerald-400 cursor-default"
                        : isInstalling
                        ? "bg-gold/10 text-gold cursor-wait"
                        : "bg-gold/10 text-gold hover:bg-gold/20"
                    }`}
                  >
                    {isInstalling ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader size={12} className="animate-spin" />
                        Installing...
                      </span>
                    ) : isInstalled ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <CheckCircle size={12} />
                        Installed
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <Download size={12} />
                        Install
                      </span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {filteredPlugins.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <Search size={40} className="mb-3 text-muted/30" />
              <p className="text-sm font-medium text-white">No plugins found</p>
              <p className="mt-1 text-xs text-muted">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      ) : (
        /* ── My Plugins Tab ── */
        <div className="space-y-3">
          {filteredPlugins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Store size={40} className="mb-3 text-muted/30" />
              <p className="text-sm font-medium text-white">No plugins installed yet</p>
              <p className="mt-1 text-xs text-muted">Browse the marketplace to discover plugins</p>
              <button
                onClick={() => setViewTab("browse")}
                className="mt-4 rounded-lg bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:bg-gold/20 transition-colors"
              >
                Browse Marketplace
              </button>
            </div>
          ) : (
            filteredPlugins.map((plugin) => {
              const isEnabled = enabledIds.has(plugin.id);
              const health = getHealthStatus(plugin.id);

              return (
                <div key={plugin.id} className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {/* Health indicator */}
                    <div
                      className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                        health === "healthy"
                          ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                          : health === "warning"
                          ? "bg-amber-400 shadow-sm shadow-amber-400/50"
                          : "bg-red-400 shadow-sm shadow-red-400/50"
                      }`}
                      title={health === "healthy" ? "Healthy" : health === "warning" ? "Needs attention" : "Error"}
                    />

                    {/* Plugin icon */}
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: plugin.iconColor + "22", color: plugin.iconColor }}
                    >
                      {plugin.icon}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{plugin.name}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isEnabled
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {isEnabled ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-xs text-muted">
                        v{plugin.version} &middot; Updated {plugin.updatedAt}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Enable/Disable toggle */}
                    <button
                      onClick={() => toggleEnabled(plugin.id)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        isEnabled ? "bg-emerald-500" : "bg-surface-light"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          isEnabled ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </button>

                    {/* Settings */}
                    <button
                      onClick={() => {
                        setSelectedPlugin(plugin);
                        setDetailTab("settings");
                      }}
                      className="rounded-lg border border-border p-2 text-muted hover:border-gold/30 hover:text-gold transition-colors"
                      title="Settings"
                    >
                      <Settings size={14} />
                    </button>

                    {/* Uninstall */}
                    {confirmUninstall === plugin.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleUninstall(plugin.id)}
                          className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmUninstall(null)}
                          className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmUninstall(plugin.id)}
                        className="rounded-lg border border-red-500/20 p-2 text-red-400/60 hover:border-red-500/40 hover:text-red-400 transition-colors"
                        title="Uninstall"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Developer Section ── */}
      <div className="section-header mt-8">
        <h2 className="text-lg font-semibold text-white">For Developers</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Build CTA */}
        <div className="card border-dashed border-gold/20 bg-gradient-to-br from-gold/5 to-transparent">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10">
              <Code2 size={24} className="text-gold" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white">Build Your Own Plugin</h3>
              <p className="mt-1 text-sm text-muted">
                Extend ShortStack with custom plugins. Use our SDK to hook into CRM events,
                add UI panels, and connect external services.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="flex items-center gap-1.5 rounded-lg bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20 transition-colors">
                  <BookOpen size={12} />
                  API Docs
                </button>
                <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-gold/30 hover:text-white transition-colors">
                  <ExternalLink size={12} />
                  View Examples
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Manifest format */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-3">Plugin Manifest Format</h3>
          <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-[11px] leading-relaxed text-muted">
{`{
  "id": "my-plugin",
  "name": "My Custom Plugin",
  "author": "Your Name",
  "version": "1.0.0",
  "description": "What it does",
  "category": "crm",
  "price": 0,
  "permissions": ["read:contacts", "write:deals"],
  "hooks": ["deal.closed", "lead.created"],
  "settings": [
    { "key": "api_key", "label": "API Key", "type": "text" }
  ]
}`}
          </pre>
          <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gold/10 py-2 text-xs font-semibold text-gold hover:bg-gold/20 transition-colors">
            <Upload size={12} />
            Submit Your Plugin
          </button>
        </div>
      </div>

      {/* ── Plugin Detail Modal ── */}
      {selectedPlugin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedPlugin(null)}
        >
          <div
            className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-[#0f1117] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 z-10 border-b border-border bg-[#0f1117]/95 backdrop-blur-sm px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: selectedPlugin.iconColor + "22", color: selectedPlugin.iconColor }}
                  >
                    {selectedPlugin.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white">{selectedPlugin.name}</h2>
                      {selectedPlugin.verified && (
                        <div className="flex items-center gap-0.5 rounded-full bg-blue-500/10 px-2 py-0.5">
                          <Shield size={10} className="text-blue-400" />
                          <span className="text-[10px] font-bold text-blue-400">VERIFIED</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted">
                      by {selectedPlugin.author} &middot; v{selectedPlugin.version} &middot;{" "}
                      {selectedPlugin.price === 0 ? (
                        <span className="text-emerald-400">Free</span>
                      ) : (
                        <span className="text-gold">${selectedPlugin.price}/mo</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlugin(null)}
                  className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal tabs */}
              <div className="mt-4 flex gap-1">
                {(["overview", "reviews", "changelog", "settings"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      detailTab === tab
                        ? "bg-gold/10 text-gold"
                        : "text-muted hover:text-white"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal content */}
            <div className="px-6 py-5 space-y-6">
              {/* ── Overview tab ── */}
              {detailTab === "overview" && (
                <>
                  {/* Stats row */}
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <StarRating rating={selectedPlugin.rating} size={14} />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <Download size={13} />
                      {formatInstalls(selectedPlugin.installs)} installs
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <Clock size={13} />
                      Updated {selectedPlugin.updatedAt}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2">About</h3>
                    <p className="text-sm leading-relaxed text-muted">
                      {selectedPlugin.longDescription}
                    </p>
                  </div>

                  {/* Screenshots */}
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3">Screenshots</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {selectedPlugin.screenshots.map((ss, i) => (
                        <div
                          key={i}
                          className="flex h-36 w-56 flex-shrink-0 items-center justify-center rounded-lg border border-border"
                          style={{ backgroundColor: ss.color + "15" }}
                        >
                          <div className="text-center">
                            <Image size={24} className="mx-auto mb-2" style={{ color: ss.color }} />
                            <span className="text-[11px] font-medium" style={{ color: ss.color }}>
                              {ss.label}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3">Features</h3>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {selectedPlugin.features.map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle size={14} className="mt-0.5 flex-shrink-0 text-emerald-400" />
                          <span className="text-xs text-muted">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Requirements */}
                  {selectedPlugin.requirements.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-2">Requirements</h3>
                      <ul className="space-y-1.5">
                        {selectedPlugin.requirements.map((r, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-muted">
                            <AlertCircle size={12} className="text-amber-400" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {selectedPlugin.tags.map((tag) => (
                      <span key={tag} className="flex items-center gap-1 rounded-md bg-surface-light px-2.5 py-1 text-[11px] text-muted">
                        <Tag size={10} />
                        {tag}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {/* ── Reviews tab ── */}
              {detailTab === "reviews" && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="flex items-center gap-4 rounded-lg bg-surface p-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-white">{selectedPlugin.rating.toFixed(1)}</div>
                      <StarRating rating={selectedPlugin.rating} size={12} />
                      <div className="mt-1 text-[10px] text-muted">{selectedPlugin.reviews.length} reviews</div>
                    </div>
                    <div className="flex-1 space-y-1">
                      {[5, 4, 3, 2, 1].map((stars) => {
                        const count = selectedPlugin.reviews.filter((r) => Math.round(r.rating) === stars).length;
                        const pct = selectedPlugin.reviews.length > 0 ? (count / selectedPlugin.reviews.length) * 100 : 0;
                        return (
                          <div key={stars} className="flex items-center gap-2">
                            <span className="w-3 text-[10px] text-muted">{stars}</span>
                            <Star size={10} className="text-gold fill-gold" />
                            <div className="h-1.5 flex-1 rounded-full bg-surface-light overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gold"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-4 text-right text-[10px] text-muted">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Individual reviews */}
                  {selectedPlugin.reviews.map((review, i) => (
                    <div key={i} className="rounded-lg border border-border bg-surface p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/10 text-[11px] font-bold text-gold">
                            {review.avatar}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{review.name}</p>
                            <p className="text-[10px] text-muted">{review.date}</p>
                          </div>
                        </div>
                        <StarRating rating={review.rating} size={10} />
                      </div>
                      <p className="mt-2.5 text-xs leading-relaxed text-muted">{review.comment}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Changelog tab ── */}
              {detailTab === "changelog" && (
                <div className="space-y-4">
                  {selectedPlugin.changelog.map((entry, i) => (
                    <div key={i} className="relative pl-6">
                      {/* Timeline line */}
                      {i < selectedPlugin.changelog.length - 1 && (
                        <div className="absolute left-[7px] top-6 h-full w-px bg-border" />
                      )}
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 ${
                          i === 0
                            ? "border-gold bg-gold/20"
                            : "border-border bg-surface"
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">v{entry.version}</span>
                          <span className="text-xs text-muted">{entry.date}</span>
                          {i === 0 && (
                            <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[9px] font-bold text-gold">LATEST</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted">{entry.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Settings tab ── */}
              {detailTab === "settings" && (
                <div className="space-y-4">
                  {!installedIds.has(selectedPlugin.id) ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Settings size={32} className="mb-3 text-muted/30" />
                      <p className="text-sm text-muted">Install this plugin to configure settings</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-muted">
                        Configure {selectedPlugin.name} settings below. Changes are saved automatically.
                      </p>
                      {selectedPlugin.settings.map((setting) => (
                        <div key={setting.key} className="space-y-1.5">
                          <label className="text-xs font-medium text-white">{setting.label}</label>
                          {setting.type === "toggle" ? (
                            <button
                              className={`relative h-6 w-11 rounded-full transition-colors ${
                                setting.default ? "bg-emerald-500" : "bg-surface-light"
                              }`}
                            >
                              <div
                                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                  setting.default ? "left-[22px]" : "left-0.5"
                                }`}
                              />
                            </button>
                          ) : setting.type === "select" ? (
                            <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-white focus:border-gold/50 focus:outline-none">
                              <option>{String(setting.default ?? "")}</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              defaultValue={String(setting.default ?? "")}
                              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30"
                            />
                          )}
                        </div>
                      ))}
                      <button className="mt-2 w-full rounded-lg bg-gold/10 py-2 text-xs font-semibold text-gold hover:bg-gold/20 transition-colors">
                        Save Configuration
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 border-t border-border bg-[#0f1117]/95 backdrop-blur-sm px-6 py-4">
              {installedIds.has(selectedPlugin.id) ? (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <CheckCircle size={14} />
                    Installed &middot; v{selectedPlugin.version}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setConfirmUninstall(selectedPlugin.id);
                      }}
                      className="rounded-lg border border-red-500/20 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Uninstall
                    </button>
                    <button
                      onClick={() => setSelectedPlugin(null)}
                      className="rounded-lg bg-surface px-4 py-2 text-xs font-medium text-white hover:bg-surface-light transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted">
                    {selectedPlugin.price === 0
                      ? "Free to install"
                      : `$${selectedPlugin.price}/mo after install`}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedPlugin(null)}
                      className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        handleInstall(selectedPlugin.id);
                        setSelectedPlugin(null);
                      }}
                      className="rounded-lg bg-gold px-4 py-2 text-xs font-bold text-black hover:bg-gold/90 transition-colors"
                    >
                      {selectedPlugin.price === 0 ? "Install Free" : `Install - $${selectedPlugin.price}/mo`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Uninstall confirmation modal (from My Plugins view) ── */}
      {confirmUninstall && viewTab === "browse" && selectedPlugin && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmUninstall(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-[#0f1117] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Uninstall Plugin</h3>
                <p className="text-xs text-muted">This will remove all plugin data</p>
              </div>
            </div>
            <p className="text-xs text-muted mb-4">
              Are you sure you want to uninstall <span className="text-white font-medium">{selectedPlugin.name}</span>?
              All configuration and data will be permanently deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmUninstall(null)}
                className="rounded-lg border border-border px-4 py-2 text-xs text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleUninstall(confirmUninstall);
                  setSelectedPlugin(null);
                }}
                className="rounded-lg bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
              >
                Uninstall
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page AI ── */}
      <PageAI
        pageName="Marketplace"
        context="Plugin marketplace with 20+ plugins including Slack, Notion, Zapier, Google Ads, Meta Ads, AI Lead Scorer, WhatsApp, Stripe, HubSpot Importer, Email Verifier, SMS Auto-Responder, Calendar Sync, Proposal Templates, Voice Transcription, Social Scheduler, Client Feedback, Data Enrichment, Custom Reports Builder, Telegram Bot, and A/B Testing."
        suggestions={[
          "Which free plugins are most popular?",
          "What plugins work best for lead generation?",
          "How do I build a custom plugin?",
          "Which AI plugins are available?",
        ]}
      />
    </div>
  );
}
