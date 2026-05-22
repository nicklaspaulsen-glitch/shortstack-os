/**
 * Integrations Hub � Nango-powered tenant OAuth dashboard + API-key integrations.
 *
 * NOTE: This page is intentionally separate from `/dashboard/integrations`,
 * which is the legacy Zernio-based social-accounts dashboard. The two pages
 * coexist during the migration; once every legacy provider is on Nango we'll
 * collapse them into one.
 *
 * Flow (Nango providers):
 *   1. Page mounts ? GET /api/integrations/nango/connections to learn which
 *      integrations the current user has already connected.
 *   2. User clicks "Connect" on a card ? <ConnectModal /> opens with the
 *      provider's scope list.
 *   3. On Authorize ? call `connectIntegration({ integrationId, connectionId })`
 *      from the client SDK. Nango handles the popup, OAuth dance, and
 *      callback registration server-side.
 *   4. On success ? POST /api/integrations/nango/finalize to write the row
 *      into `oauth_connections_nango`. Re-fetch connections so the card
 *      flips to "Connected".
 *   5. On disconnect ? POST /api/integrations/nango/disconnect/{id}.
 *
 * Flow (API-key / Zernio providers):
 *   Status comes from GET /api/integrations/health. "Connect" opens an info
 *   panel explaining how to configure the provider (env var or Zernio dashboard).
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plug, Sparkles, RefreshCw, ExternalLink, Key } from "lucide-react";
import toast from "react-hot-toast";
import ConnectModal from "@/components/integrations/connect-modal";
import IntegrationCard, {
  type IntegrationCardData,
  type IntegrationStatus,
} from "@/components/integrations/integration-card";
import { useAuth } from "@/lib/auth-context";
import {
  ConnectIntegrationError,
  connectIntegration,
} from "@/lib/nango/browser";
import { NANGO_INTEGRATIONS } from "@/lib/nango/shared";
import { MotionPage } from "@/components/motion/motion-page";

// ------------------------------------------------------------------------
// Extended local type � augments the card's IntegrationCardData with
// routing metadata used by the page only. The card receives the base
// IntegrationCardData type (supertype), so this is structurally safe.
// ------------------------------------------------------------------------

type ConnectKind = "nango" | "zernio" | "api-key";

interface ExtendedIntegrationData extends IntegrationCardData {
  /** How this integration authenticates. Drives the connect-click handler. */
  connectKind: ConnectKind;
  /** Health API `id` field for api-key and zernio providers. */
  healthId?: string;
  /** Primary env var(s) the user needs to set for api-key providers. */
  requiredEnv?: string[];
  /** External URL to open on "Configure" (for Zernio, settings pages, etc.) */
  configUrl?: string;
}

// ------------------------------------------------------------------------
// Integration catalogue
// ------------------------------------------------------------------------

const INTEGRATIONS: ReadonlyArray<ExtendedIntegrationData> = [
  // -- Nango OAuth providers --------------------------------------------
  {
    id: NANGO_INTEGRATIONS.GOOGLE_ADS,
    name: "Google",
    category: "Productivity",
    description: "Calendar, Drive, Gmail",
    logo: "/logos/google.svg",
    scopes: ["Read calendar", "Send emails", "Access Drive files"],
    connectKind: "nango",
  },
  {
    id: NANGO_INTEGRATIONS.FACEBOOK,
    name: "Meta (Facebook + Instagram)",
    category: "Marketing",
    description: "Pages, Ads, Insights",
    logo: "/logos/meta.svg",
    scopes: ["Manage ads", "Read page engagement", "Publish posts"],
    connectKind: "nango",
  },
  {
    id: NANGO_INTEGRATIONS.APIFY,
    name: "Apify",
    category: "Lead Gen",
    description: "Web scraping & lead data",
    logo: "/logos/apify.svg",
    scopes: ["Run scrapers", "Read datasets"],
    connectKind: "nango",
  },

  // -- Zernio social providers -----------------------------------------
  {
    id: "social_tiktok",
    name: "TikTok",
    category: "Marketing",
    description: "Organic posts, analytics",
    logo: "/logos/tiktok.svg",
    scopes: ["Post videos", "Read analytics"],
    connectKind: "zernio",
    healthId: "social_tiktok",
    configUrl: "https://zernio.com/dashboard",
  },
  {
    id: "social_linkedin",
    name: "LinkedIn",
    category: "Marketing",
    description: "Posts, company pages, insights",
    logo: "/logos/linkedin.svg",
    scopes: ["Publish posts", "Read analytics"],
    connectKind: "zernio",
    healthId: "social_linkedin",
    configUrl: "https://zernio.com/dashboard",
  },
  {
    id: "social_youtube",
    name: "YouTube",
    category: "Marketing",
    description: "Channel management & analytics",
    scopes: ["Upload videos", "Read analytics"],
    connectKind: "zernio",
    healthId: "social_youtube",
    configUrl: "https://zernio.com/dashboard",
  },
  {
    id: "social_instagram",
    name: "Instagram",
    category: "Marketing",
    description: "Posts, stories, reels, insights",
    scopes: ["Publish posts", "Read analytics"],
    connectKind: "zernio",
    healthId: "social_instagram",
    configUrl: "https://zernio.com/dashboard",
  },

  // -- API-key providers ------------------------------------------------
  {
    id: "calendly",
    name: "Calendly",
    category: "Productivity",
    description: "Scheduling & booking automation",
    scopes: ["Read scheduled events", "View booking data"],
    connectKind: "api-key",
    healthId: "calendly",
    requiredEnv: ["CALENDLY_API_TOKEN"],
    configUrl: "https://calendly.com/integrations/api_webhooks",
  },
  {
    id: "notion",
    name: "Notion",
    category: "Productivity",
    description: "Notes, docs & databases",
    scopes: ["Read pages", "Write pages", "Query databases"],
    connectKind: "api-key",
    healthId: "notion",
    requiredEnv: ["NOTION_API_KEY"],
    configUrl: "https://www.notion.so/my-integrations",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    category: "Messaging",
    description: "WhatsApp Cloud API messaging",
    scopes: ["Send messages", "Receive inbound messages"],
    connectKind: "api-key",
    healthId: "whatsapp",
    requiredEnv: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
    configUrl: "https://developers.facebook.com/apps/",
  },
  {
    id: "twilio",
    name: "Twilio",
    category: "Messaging",
    description: "SMS, voice calls & dial automation",
    scopes: ["Send SMS", "Make voice calls", "Read call logs"],
    connectKind: "api-key",
    healthId: "twilio",
    requiredEnv: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
    configUrl: "https://console.twilio.com",
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "Payments",
    description: "Client billing & subscriptions",
    scopes: ["Read balance", "Create invoices", "Manage subscriptions"],
    connectKind: "api-key",
    healthId: "stripe",
    requiredEnv: ["STRIPE_SECRET_KEY"],
    configUrl: "https://dashboard.stripe.com/apikeys",
  },
  {
    id: "email_marketing",
    name: "Resend / Mailchimp",
    category: "Marketing",
    description: "Transactional & marketing email",
    scopes: ["Send emails", "Read domain stats"],
    connectKind: "api-key",
    healthId: "email_marketing",
    requiredEnv: ["RESEND_API_KEY"],
    configUrl: "https://resend.com/api-keys",
  },
];

// Set of integration IDs that are NOT managed by Nango � status comes from
// the health API instead.
const NON_NANGO_IDS = new Set<string>(
  INTEGRATIONS.filter((i) => i.connectKind !== "nango").map((i) => i.id),
);

// "All" plus every distinct category from the catalogue.
const FILTER_CATEGORIES: ReadonlyArray<string> = [
  "All",
  ...Array.from(new Set(INTEGRATIONS.map((i) => i.category))),
];

// ------------------------------------------------------------------------
// API types
// ------------------------------------------------------------------------

interface NangoConnectionRow {
  integration_id: string;
  nango_connection_id: string;
  display_name: string | null;
  connected_at: string;
  last_used_at: string | null;
}

interface ConnectionsResponse {
  connections: NangoConnectionRow[];
}

interface HealthResult {
  id: string;
  status: "connected" | "not_configured" | "error";
  detail?: string;
}

interface HealthResponse {
  success: boolean;
  results: HealthResult[];
}

// Disconnect endpoint paths keyed by integration id.
const DISCONNECT_ROUTES: Record<string, string> = {
  [NANGO_INTEGRATIONS.GOOGLE_ADS]:
    "/api/integrations/nango/disconnect/google-ads",
};

// ------------------------------------------------------------------------
// API-key setup info panel
// ------------------------------------------------------------------------

interface ApiKeyPanelProps {
  integration: ExtendedIntegrationData;
  onClose: () => void;
}

function ApiKeyPanel({ integration, onClose }: ApiKeyPanelProps) {
  const isZernio = integration.connectKind === "zernio";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Connect ${integration.name}`}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md mx-4 glass border border-border-subtle p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            {isZernio ? (
              <ExternalLink size={18} className="text-brand-accent" />
            ) : (
              <Key size={18} className="text-brand-accent" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Connect {integration.name}
            </h2>
            <p className="text-[11px] text-text-secondary">
              {isZernio ? "Via Zernio dashboard" : "Requires API credentials"}
            </p>
          </div>
        </div>

        {isZernio ? (
          <div className="space-y-3 text-[12px] text-text-secondary">
            <p>
              {integration.name} accounts are managed through{" "}
              <strong className="text-text-primary">Zernio</strong>. Connect your
              account there � ShortStack will automatically detect it.
            </p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1">
              <li>
                Open{" "}
                <a
                  href="https://zernio.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 underline underline-offset-2"
                >
                  zernio.com/dashboard
                </a>
              </li>
              <li>Connect your {integration.name} account</li>
              <li>Return here and click Refresh</li>
            </ol>
          </div>
        ) : (
          <div className="space-y-3 text-[12px] text-text-secondary">
            <p>
              Add the following environment variable(s) to your Vercel project,
              then redeploy.
            </p>
            <div className="space-y-1.5">
              {(integration.requiredEnv ?? []).map((envVar) => (
                <code
                  key={envVar}
                  className="block w-full bg-white/[0.05] border border-border-subtle rounded-lg px-3 py-2 text-brand-accent text-[11px] font-mono"
                >
                  {envVar}
                </code>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-2">
          {integration.configUrl && (
            <a
              href={integration.configUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold px-3 py-2 rounded-full bg-brand-accent text-[#020711] hover:bg-[#E8FF4D] transition-all"
              style={{ boxShadow: "0 4px 10px -3px rgba(212,255,0,0.25)" }}
            >
              <ExternalLink size={11} />
              {isZernio ? "Open Zernio" : "Get API Key"}
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-[11px] font-medium px-3 py-2 rounded-lg border border-border-subtle text-text-secondary hover:text-text-primary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------
// Page component
// ------------------------------------------------------------------------

export default function IntegrationsHubPage() {
  const { user, loading: authLoading } = useAuth();

  const [connections, setConnections] = useState<NangoConnectionRow[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [healthStatuses, setHealthStatuses] = useState<Map<string, "connected" | "not_configured" | "error">>(new Map());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [modalIntegration, setModalIntegration] =
    useState<ExtendedIntegrationData | null>(null);
  const [apiKeyPanelIntegration, setApiKeyPanelIntegration] =
    useState<ExtendedIntegrationData | null>(null);

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/nango/connections", {
        credentials: "include",
      });
      if (res.status === 401) {
        setConnections([]);
        return;
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error("[integrations-hub] fetch failed", res.status, detail);
        toast.error("Couldn't load your connections");
        return;
      }
      const data = (await res.json()) as ConnectionsResponse;
      setConnections(data.connections ?? []);
    } catch (err) {
      console.error("[integrations-hub] fetch error", err);
      toast.error("Couldn't load your connections");
    } finally {
      setLoadingConnections(false);
    }
  }, []);

  const fetchHealthStatuses = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/health", {
        credentials: "include",
      });
      if (!res.ok) return; // non-blocking � health failures don't block the page
      const data = (await res.json()) as HealthResponse;
      const map = new Map<string, "connected" | "not_configured" | "error">();
      for (const result of data.results ?? []) {
        map.set(result.id, result.status);
      }
      setHealthStatuses(map);
    } catch (err) {
      console.error("[integrations-hub] health fetch error", err);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoadingConnections(false);
      return;
    }
    void fetchConnections();
    void fetchHealthStatuses();
  }, [authLoading, user, fetchConnections, fetchHealthStatuses]);

  const connectionByIntegration = useMemo(() => {
    const map = new Map<string, NangoConnectionRow>();
    for (const c of connections) map.set(c.integration_id, c);
    return map;
  }, [connections]);

  function statusFor(integration: ExtendedIntegrationData): IntegrationStatus {
    if (integration.comingSoon) return "coming_soon";
    if (NON_NANGO_IDS.has(integration.id)) {
      const health = integration.healthId
        ? healthStatuses.get(integration.healthId)
        : undefined;
      return health === "connected" ? "connected" : "not_connected";
    }
    return connectionByIntegration.has(integration.id)
      ? "connected"
      : "not_connected";
  }

  const filteredIntegrations = useMemo(() => {
    if (activeFilter === "All") return INTEGRATIONS;
    return INTEGRATIONS.filter((i) => i.category === activeFilter);
  }, [activeFilter]);

  // -- Connect flow -----------------------------------------------------

  function handleConnectClick(integration: IntegrationCardData) {
    const ext = integration as ExtendedIntegrationData;
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    if (ext.connectKind === "nango") {
      setModalIntegration(ext);
      return;
    }
    // API-key and Zernio providers: open the info panel
    setApiKeyPanelIntegration(ext);
  }

  async function handleAuthorize() {
    const integration = modalIntegration;
    if (!integration || !user) return;

    setModalIntegration(null);
    setBusy(integration.id, true);

    try {
      await connectIntegration({
        integrationId: integration.id,
        connectionId: `${user.id}-${integration.id}`,
      });

      const finalizeRes = await fetch(
        "/api/integrations/nango/finalize",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            integrationId: integration.id,
            displayName: integration.name,
          }),
        },
      );

      if (!finalizeRes.ok) {
        const errBody = await finalizeRes
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(errBody.error || "Failed to finalize connection");
      }

      toast.success(`${integration.name} connected`);
      await fetchConnections();
    } catch (err) {
      if (err instanceof ConnectIntegrationError) {
        if (err.type !== "user_cancelled") {
          console.error("[integrations-hub] connect error", err);
          toast.error(err.message || "Connection failed");
        }
      } else {
        console.error("[integrations-hub] finalize error", err);
        toast.error(
          err instanceof Error ? err.message : "Connection failed",
        );
      }
    } finally {
      setBusy(integration.id, false);
    }
  }

  // -- Disconnect flow --------------------------------------------------

  async function handleDisconnect(integration: IntegrationCardData) {
    const ext = integration as ExtendedIntegrationData;
    if (ext.connectKind !== "nango") {
      toast.error(
        `To disconnect ${integration.name}, remove the env var(s) from your Vercel project and redeploy.`,
        { duration: 6000 },
      );
      return;
    }

    const route = DISCONNECT_ROUTES[integration.id];
    if (!route) {
      toast.error(
        `Disconnect for ${integration.name} isn't wired up yet � coming soon.`,
      );
      return;
    }

    setBusy(integration.id, true);
    try {
      const res = await fetch(route, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Unknown" }));
        throw new Error(errBody.error || "Failed to disconnect");
      }
      toast.success(`${integration.name} disconnected`);
      await fetchConnections();
    } catch (err) {
      console.error("[integrations-hub] disconnect error", err);
      toast.error(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(integration.id, false);
    }
  }

  // -- Stats ------------------------------------------------------------

  const connectedCount = useMemo(() => {
    let count = connections.length;
    for (const integration of INTEGRATIONS) {
      if (
        NON_NANGO_IDS.has(integration.id) &&
        integration.healthId &&
        healthStatuses.get(integration.healthId) === "connected"
      ) {
        count++;
      }
    }
    return count;
  }, [connections, healthStatuses]);

  const availableCount = INTEGRATIONS.filter((i) => !i.comingSoon).length;

  const lastSyncLabel = useMemo(() => {
    if (connections.length === 0) return "Never";
    const latest = connections.reduce<string | null>((acc, c) => {
      const ts = c.last_used_at || c.connected_at;
      if (!acc) return ts;
      return new Date(ts).getTime() > new Date(acc).getTime() ? ts : acc;
    }, null);
    if (!latest) return "Never";
    return relativeTime(latest);
  }, [connections]);

  // -- Render -----------------------------------------------------------

  return (
    <MotionPage className="space-y-5">{/* -- Integrations Hub command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">All your integrations</p>
        <h1 className="text-2xl font-display font-bold text-text-primary">Integrations Hub</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
                  type="button"
                  onClick={() => {
                    setLoadingConnections(true);
                    void fetchConnections();
                    void fetchHealthStatuses();
                  }}
                  disabled={loadingConnections}
                  className="flex items-center gap-1.5 text-[10px] bg-white/5 border border-border-subtle text-text-primary px-2.5 py-1 rounded-md hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  <RefreshCw
                    size={10}
                    className={loadingConnections ? "animate-spin" : ""}
                  />
                  <span className="font-medium">Refresh</span>
                </button>
      </div>
    </div>{/* Hero stat bento */}<div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4">
  <motion.div
    className="col-span-2 lg:col-span-1 glass rounded-2xl p-5 flex items-center gap-4 shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.38, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
  >
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Connected</p>
      <p className="font-display text-3xl font-bold tracking-[-0.03em] text-emerald-400 tabular-nums">{connectedCount}</p>
      <p className="text-[11px] text-text-muted mt-1.5">active integrations</p>
    </div>
  </motion.div>
  <motion.div
    className="glass rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.38, delay: 0.10, ease: [0.22, 1, 0.36, 1] }}
  >
    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Available</p>
    <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{availableCount}</p>
    <p className="text-[11px] text-text-muted mt-1.5">in catalog</p>
  </motion.div>
  <motion.div
    className="glass rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.38, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
  >
    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Powered by</p>
    <p className="font-display text-lg font-bold tracking-[-0.02em] text-text-primary leading-tight">Nango + Zernio</p>
    <p className="text-[11px] text-text-muted mt-1.5">sync engine</p>
  </motion.div>
  <motion.div
    className="glass rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.38, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
  >
    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Last Sync</p>
    <p className="font-display text-xl font-bold tracking-[-0.02em] text-text-primary leading-tight">{lastSyncLabel}</p>
    <p className="text-[11px] text-text-muted mt-1.5">most recent</p>
  </motion.div>
</div>{/* Category filter pills */}<motion.div
              className="glass rounded-lg px-3 py-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.35, ease: "easeOut" }}
              role="tablist"
              aria-label="Integration category filter"
            >
              <div className="tab-pill-strip">
                {FILTER_CATEGORIES.map((cat) => {
                  const active = cat === activeFilter;
                  return (
                    <button
                      key={cat}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveFilter(cat)}
                      className={`tab-pill${active ? " active" : ""}`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </motion.div>{/* Integration grid */}<div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="mb-0">
                  {activeFilter === "All"
                    ? "All integrations"
                    : `${activeFilter} integrations`}
                </h2>
                <span className="text-[10px] text-text-muted">
                  {filteredIntegrations.length} shown
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredIntegrations.map((integration, i) => {
                  const conn = connectionByIntegration.get(integration.id);
                  return (
                    <motion.div
                      key={integration.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.4, ease: "easeOut" }}
                      whileHover={{ y: -4, scale: 1.01 }}
                      className="glass rounded-xl spotlight-card"
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                        e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                      }}
                    >
                      <IntegrationCard
                        integration={integration}
                        status={statusFor(integration)}
                        connectedAs={conn?.display_name ?? null}
                        busy={busyIds.has(integration.id)}
                        onConnect={handleConnectClick}
                        onDisconnect={handleDisconnect}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </div>{/* Nango connect confirmation modal */}{modalIntegration && (
              <ConnectModal
                integrationName={modalIntegration.name}
                integrationId={modalIntegration.id}
                scopesDescription={modalIntegration.scopes ?? []}
                logoUrl={modalIntegration.logo}
                onConfirm={() => {
                  void handleAuthorize();
                }}
                onCancel={() => setModalIntegration(null)}
              />
            )}{/* API-key / Zernio setup info panel */}{apiKeyPanelIntegration && (
              <ApiKeyPanel
                integration={apiKeyPanelIntegration}
                onClose={() => setApiKeyPanelIntegration(null)}
              />
            )}</MotionPage>
  );
}

// ------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "Just now";
  const diffMs = Date.now() - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMo = Math.floor(diffDay / 30);
  if (diffMo < 12) return `${diffMo}mo ago`;
  return new Date(iso).toLocaleDateString();
}
