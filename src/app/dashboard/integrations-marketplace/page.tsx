"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import {
  Plug, Check, X, Loader2, Search, Zap, ShoppingCart, BarChart3,
  MessageSquare, Mail, Video, Clock, DollarSign, Users, Megaphone,
  Bot, Globe, ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";

interface OauthConnection {
  platform: string;
  is_active: boolean;
}

type IntegrationCategory = "messaging" | "automation" | "crm" | "ads" | "ecommerce" | "payments" | "forms" | "video";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: IntegrationCategory;
  color: string;
  connectUrl?: string;
  implemented: boolean;
}

const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  messaging: "Messaging",
  automation: "Automation",
  crm: "CRM",
  ads: "Advertising",
  ecommerce: "E-commerce",
  payments: "Payments",
  forms: "Forms & Surveys",
  video: "Video & Calls",
};

const SlackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zm2.521-10.123a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
  </svg>
);
const DiscordIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.043.03.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
  </svg>
);
const HubSpotIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.164 7.93V5.084a1.56 1.56 0 0 0 .901-1.415V3.62a1.56 1.56 0 0 0-1.56-1.56h-.042a1.56 1.56 0 0 0-1.56 1.56v.049a1.56 1.56 0 0 0 .901 1.415V7.93a4.43 4.43 0 0 0-2.106.922L7.48 4.353a1.72 1.72 0 1 0-.938.963l6.962 4.49a4.45 4.45 0 0 0-.589 2.2A4.46 4.46 0 0 0 17.5 16.46a4.456 4.456 0 0 0 .664-8.53zM17.5 14.1a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2z"/>
  </svg>
);

const ALL_INTEGRATIONS: Integration[] = [
  { id: "slack", name: "Slack", description: "Send notifications and alerts to Slack channels", icon: <SlackIcon />, category: "messaging", color: "#4A154B", implemented: false },
  { id: "discord", name: "Discord", description: "Post updates and run bots in Discord servers", icon: <DiscordIcon />, category: "messaging", color: "#5865F2", connectUrl: "/api/integrations/discord", implemented: true },
  { id: "telegram", name: "Telegram", description: "Automate messages and alerts via Telegram bots", icon: <Bot className="w-5 h-5" />, category: "messaging", color: "#2CA5E0", implemented: true },
  { id: "whatsapp", name: "WhatsApp", description: "Send campaign messages via WhatsApp Business API", icon: <MessageSquare className="w-5 h-5" />, category: "messaging", color: "#25D366", connectUrl: "/dashboard/whatsapp", implemented: true },
  { id: "mailchimp", name: "Mailchimp", description: "Sync contacts and campaign stats from Mailchimp", icon: <Mail className="w-5 h-5" />, category: "messaging", color: "#FFE01B", implemented: false },
  { id: "activecampaign", name: "ActiveCampaign", description: "Sync automations, lists, and contacts", icon: <Megaphone className="w-5 h-5" />, category: "messaging", color: "#356AE6", implemented: false },
  { id: "zapier", name: "Zapier", description: "Connect to 5000+ apps with no-code automations", icon: <Zap className="w-5 h-5" />, category: "automation", color: "#FF4A00", implemented: false },
  { id: "make", name: "Make", description: "Build advanced multi-step visual automations", icon: <Globe className="w-5 h-5" />, category: "automation", color: "#6D00CC", implemented: false },
  { id: "webhooks", name: "Webhooks", description: "Send real-time events to any HTTP endpoint", icon: <Globe className="w-5 h-5" />, category: "automation", color: "#718096", connectUrl: "/dashboard/settings/webhooks", implemented: true },
  { id: "hubspot", name: "HubSpot", description: "Sync contacts, deals, and CRM data with HubSpot", icon: <HubSpotIcon />, category: "crm", color: "#FF7A59", implemented: false },
  { id: "salesforce", name: "Salesforce", description: "Two-way sync with Salesforce CRM records", icon: <Users className="w-5 h-5" />, category: "crm", color: "#00A1E0", implemented: false },
  { id: "google_analytics", name: "Google Analytics", description: "Pull GA4 traffic and conversion data into dashboards", icon: <BarChart3 className="w-5 h-5" />, category: "ads", color: "#E37400", implemented: false },
  { id: "facebook_ads", name: "Facebook Ads", description: "Manage ad campaigns and track ROAS from Meta", icon: <Megaphone className="w-5 h-5" />, category: "ads", color: "#1877F2", connectUrl: "/api/oauth/meta-ads/start", implemented: true },
  { id: "google_ads", name: "Google Ads", description: "Monitor spend, conversions, and keyword performance", icon: <BarChart3 className="w-5 h-5" />, category: "ads", color: "#4285F4", connectUrl: "/api/oauth/google-ads/start", implemented: true },
  { id: "stripe", name: "Stripe", description: "Track revenue, subscriptions, and payments from Stripe", icon: <DollarSign className="w-5 h-5" />, category: "payments", color: "#635BFF", connectUrl: "/api/integrations/stripe-connect", implemented: true },
  { id: "quickbooks", name: "QuickBooks", description: "Sync invoices, expenses, and accounting data", icon: <DollarSign className="w-5 h-5" />, category: "payments", color: "#2CA01C", implemented: false },
  { id: "shopify", name: "Shopify", description: "Pull orders, products, and customer data from Shopify", icon: <ShoppingCart className="w-5 h-5" />, category: "ecommerce", color: "#96BF48", implemented: false },
  { id: "woocommerce", name: "WooCommerce", description: "Connect your WooCommerce store for order tracking", icon: <ShoppingCart className="w-5 h-5" />, category: "ecommerce", color: "#7F54B3", implemented: false },
  { id: "typeform", name: "Typeform", description: "Route Typeform responses into your CRM as leads", icon: <Mail className="w-5 h-5" />, category: "forms", color: "#262627", implemented: false },
  { id: "calendly", name: "Calendly", description: "Sync bookings and trigger workflows on schedule", icon: <Clock className="w-5 h-5" />, category: "forms", color: "#006BFF", connectUrl: "/api/oauth/calendly/start", implemented: true },
  { id: "zoom", name: "Zoom", description: "Schedule, record, and log Zoom calls from ShortStack", icon: <Video className="w-5 h-5" />, category: "video", color: "#2D8CFF", implemented: false },
];

const CATEGORIES = ["all", ...Object.keys(CATEGORY_LABELS)] as const;

export default function IntegrationsMarketplacePage() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const supabase = createClient();

  const fetchConnections = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("oauth_connections")
      .select("platform, is_active")
      .eq("user_id", user.id);
    const map: Record<string, boolean> = {};
    (data as OauthConnection[] | null)?.forEach((c) => {
      map[c.platform] = c.is_active;
    });
    setConnections(map);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const filtered = ALL_INTEGRATIONS.filter((i) => {
    const matchesSearch =
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || i.category === category;
    return matchesSearch && matchesCategory;
  });

  const handleConnect = (integration: Integration) => {
    if (!integration.implemented) {
      toast("Coming soon — join the waitlist!", { icon: "⏳" });
      return;
    }
    if (integration.connectUrl) {
      window.location.href = integration.connectUrl;
    } else {
      toast("Coming soon — join the waitlist!", { icon: "⏳" });
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!user) return;
    await supabase
      .from("oauth_connections")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("platform", integrationId);
    setConnections((prev) => ({ ...prev, [integrationId]: false }));
    toast.success("Disconnected");
  };

  const connectedCount = Object.values(connections).filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHero
        title="Integrations Marketplace"
        subtitle="Connect your favourite tools and automate workflows across your entire stack."
        icon={<Plug className="w-6 h-6" />}
        gradient="blue"
        eyebrow={`${connectedCount} connected`}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search integrations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#C9A84C]/50 transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                category === cat
                  ? "bg-[#C9A84C] text-black"
                  : "bg-white/5 text-white/60 hover:bg-white/10 border border-white/8"
              }`}
            >
              {cat === "all" ? "All" : CATEGORY_LABELS[cat as IntegrationCategory]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-white/40">
          <Plug className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No integrations match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((integration) => {
            const connected = connections[integration.id] === true;
            return (
              <div
                key={integration.id}
                className="rounded-xl border border-white/8 bg-white/3 hover:bg-white/5 p-4 flex flex-col gap-3 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${integration.color}25`, border: `1px solid ${integration.color}40` }}
                  >
                    <span style={{ color: integration.color }}>{integration.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{integration.name}</p>
                    <p className="text-[10px] text-white/40 capitalize">
                      {CATEGORY_LABELS[integration.category]}
                    </p>
                  </div>
                  {connected && (
                    <div className="shrink-0 w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </div>

                <p className="text-xs text-white/50 leading-relaxed flex-1">
                  {integration.description}
                </p>

                {connected ? (
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium flex-1">
                      <Check className="w-3.5 h-3.5" />
                      Connected
                    </div>
                    <button
                      onClick={() => handleDisconnect(integration.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-red-400 border border-red-400/20 bg-red-400/5 hover:bg-red-400/10 transition-all"
                    >
                      <X className="w-3 h-3" />
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(integration)}
                    aria-disabled={!integration.implemented}
                    aria-label={
                      integration.implemented
                        ? `Connect ${integration.name}`
                        : `${integration.name} — coming soon`
                    }
                    className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      integration.implemented
                        ? "bg-[#C9A84C]/15 hover:bg-[#C9A84C]/25 text-[#C9A84C] border border-[#C9A84C]/25"
                        : "bg-white/5 hover:bg-white/10 text-white/40 border border-white/8 cursor-not-allowed"
                    }`}
                  >
                    {integration.implemented ? (
                      <>
                        <Plug className="w-3.5 h-3.5" />
                        Connect
                        <ArrowRight className="w-3 h-3 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    ) : (
                      <>Coming soon</>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
