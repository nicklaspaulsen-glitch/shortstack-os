/**
 * Integrations Hub — Nango-powered tenant OAuth dashboard.
 *
 * NOTE: This page is intentionally separate from `/dashboard/integrations`,
 * which is the legacy Zernio-based social-accounts dashboard. The two pages
 * coexist during the migration; once every legacy provider is on Nango we'll
 * collapse them into one.
 *
 * Flow:
 *   1. Page mounts → GET /api/integrations/nango/connections to learn which
 *      integrations the current user has already connected.
 *   2. User clicks "Connect" on a card → <ConnectModal /> opens with the
 *      provider's scope list.
 *   3. On Authorize → call `connectIntegration({ integrationId, connectionId })`
 *      from the client SDK. Nango handles the popup, OAuth dance, and
 *      callback registration server-side.
 *   4. On success → POST /api/integrations/nango/finalize to write the row
 *      into `oauth_connections_nango`. Re-fetch connections so the card
 *      flips to "Connected".
 *   5. On disconnect → POST /api/integrations/nango/disconnect/{id}; the
 *      Google Ads disconnect endpoint already exists from the foundation PR.
 *      Other providers will get parallel disconnect routes as they ship.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plug, Sparkles, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import StatCard from "@/components/ui/stat-card";
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
import { NANGO_INTEGRATIONS } from "@/lib/nango/client";

// ────────────────────────────────────────────────────────────────────────
// Hardcoded integrations catalogue
// ────────────────────────────────────────────────────────────────────────
//
// We keep this local + hand-curated for now. Each entry mirrors what's
// configured in the Nango dashboard; when we shipped each provider we'll
// promote `comingSoon` → `false`. Once we have >10 integrations this list
// should move to a server route that pulls from Nango's config API.

const INTEGRATIONS: ReadonlyArray<IntegrationCardData> = [
  {
    id: NANGO_INTEGRATIONS.GOOGLE_ADS,
    name: "Google",
    category: "Productivity",
    description: "Calendar, Drive, Gmail",
    logo: "/logos/google.svg",
    scopes: ["Read calendar", "Send emails", "Access Drive files"],
  },
  {
    id: NANGO_INTEGRATIONS.FACEBOOK,
    name: "Meta (Facebook + Instagram)",
    category: "Marketing",
    description: "Pages, Ads, Insights",
    logo: "/logos/meta.svg",
    scopes: [
      "Manage ads",
      "Read page engagement",
      "Publish posts",
    ],
  },
  {
    id: NANGO_INTEGRATIONS.APIFY,
    name: "Apify",
    category: "Lead Gen",
    description: "Web scraping & lead data",
    logo: "/logos/apify.svg",
    scopes: ["Run scrapers", "Read datasets"],
  },
  {
    id: "tiktok-business",
    name: "TikTok Business (coming soon)",
    category: "Marketing",
    description: "TikTok Ads Manager",
    logo: "/logos/tiktok.svg",
    scopes: ["Manage ad campaigns"],
    comingSoon: true,
  },
  {
    id: "linkedin",
    name: "LinkedIn (coming soon)",
    category: "Marketing",
    description: "Posts, Ads, Insights",
    logo: "/logos/linkedin.svg",
    comingSoon: true,
  },
] as const;

// "All" plus every distinct category from the catalogue, in their first-seen
// order (stable, predictable filter pill order across renders).
const FILTER_CATEGORIES: ReadonlyArray<string> = [
  "All",
  ...Array.from(new Set(INTEGRATIONS.map((i) => i.category))),
] as const;

// ────────────────────────────────────────────────────────────────────────
// API types
// ────────────────────────────────────────────────────────────────────────

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

// Disconnect endpoint paths keyed by integration id. We'll grow this map as
// each provider gets its own disconnect route during the migration.
const DISCONNECT_ROUTES: Record<string, string> = {
  [NANGO_INTEGRATIONS.GOOGLE_ADS]:
    "/api/integrations/nango/disconnect/google-ads",
};

// ────────────────────────────────────────────────────────────────────────
// Page component
// ────────────────────────────────────────────────────────────────────────

export default function IntegrationsHubPage() {
  const { user, loading: authLoading } = useAuth();

  // Parallel async state for connections + the active modal + busy markers
  // per integration. Using a Set for `busyIds` so multiple cards can be in
  // flight simultaneously (e.g. user connects Google then quickly clicks
  // Apify before the first finalize comes back).
  const [connections, setConnections] = useState<NangoConnectionRow[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [modalIntegration, setModalIntegration] =
    useState<IntegrationCardData | null>(null);

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
        // The page sits behind /dashboard which requires auth, so a 401 here
        // means the session expired mid-flight. Don't show a toast — the
        // dashboard layout will redirect.
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

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoadingConnections(false);
      return;
    }
    void fetchConnections();
  }, [authLoading, user, fetchConnections]);

  // Status lookup by integration id — derived once per render so the cards
  // stay in lockstep with `connections` without each cell doing its own scan.
  const connectionByIntegration = useMemo(() => {
    const map = new Map<string, NangoConnectionRow>();
    for (const c of connections) map.set(c.integration_id, c);
    return map;
  }, [connections]);

  function statusFor(integration: IntegrationCardData): IntegrationStatus {
    if (integration.comingSoon) return "coming_soon";
    return connectionByIntegration.has(integration.id)
      ? "connected"
      : "not_connected";
  }

  const filteredIntegrations = useMemo(() => {
    if (activeFilter === "All") return INTEGRATIONS;
    return INTEGRATIONS.filter((i) => i.category === activeFilter);
  }, [activeFilter]);

  // ── Connect flow ─────────────────────────────────────────────────────
  // Triple-step:
  //   open modal → user authorizes in popup → finalize on the server.
  // We `setBusy(id, true)` on Authorize click so the card spinner is
  // accurate even while the modal is still open.

  function handleConnectClick(integration: IntegrationCardData) {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    setModalIntegration(integration);
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

      // Persist to oauth_connections_nango.
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
        if (err.type === "user_cancelled") {
          // Silent — user explicitly bailed, no need to nag.
        } else {
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

  // ── Disconnect flow ──────────────────────────────────────────────────

  async function handleDisconnect(integration: IntegrationCardData) {
    const route = DISCONNECT_ROUTES[integration.id];
    if (!route) {
      // Fallback for integrations whose dedicated disconnect route hasn't
      // shipped yet — wipe just the local row so the UI doesn't lie.
      // TODO: remove once every integration has a parallel /disconnect route.
      toast.error(
        `Disconnect for ${integration.name} isn't wired up yet — coming soon.`,
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

  // ── Stats ────────────────────────────────────────────────────────────

  const connectedCount = connections.length;
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

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Plug size={28} />}
        title="Integrations Hub"
        subtitle="Connect your tools and let AI work across them. One OAuth, secured by Nango."
        gradient="purple"
        eyebrow="Powered by Nango"
        actions={
          <button
            type="button"
            onClick={() => {
              setLoadingConnections(true);
              void fetchConnections();
            }}
            disabled={loadingConnections}
            className="flex items-center gap-1.5 text-[10px] bg-white/10 border border-white/20 text-white px-2.5 py-1 rounded-md hover:bg-white/20 transition-all disabled:opacity-50"
          >
            <RefreshCw
              size={10}
              className={loadingConnections ? "animate-spin" : ""}
            />
            <span className="font-medium">Refresh</span>
          </button>
        }
      />

      {/* Hero stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Connected accounts"
          value={connectedCount}
          icon={<Plug size={14} />}
        />
        <StatCard
          label="Available integrations"
          value={availableCount}
          icon={<Sparkles size={14} />}
        />
        <StatCard
          label="Powered by"
          value="Nango"
          icon={<Sparkles size={14} />}
          premium
        />
        <StatCard label="Last sync" value={lastSyncLabel} />
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label="Integration category filter">
        {FILTER_CATEGORIES.map((cat) => {
          const active = cat === activeFilter;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveFilter(cat)}
              className={[
                "px-3 py-1.5 text-[11px] font-semibold rounded-full border transition-all",
                active
                  ? "bg-gold/15 border-gold/40 text-gold"
                  : "bg-surface border-border text-muted hover:text-foreground hover:border-gold/20",
              ].join(" ")}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Integration grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-header mb-0">
            {activeFilter === "All"
              ? "All integrations"
              : `${activeFilter} integrations`}
          </h2>
          <span className="text-[10px] text-muted">
            {filteredIntegrations.length} shown
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredIntegrations.map((integration) => {
            const conn = connectionByIntegration.get(integration.id);
            return (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                status={statusFor(integration)}
                connectedAs={conn?.display_name ?? null}
                busy={busyIds.has(integration.id)}
                onConnect={handleConnectClick}
                onDisconnect={handleDisconnect}
              />
            );
          })}
        </div>
      </div>

      {/* Connect confirmation modal */}
      {modalIntegration && (
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
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

/** Tiny inline relative-time formatter — keeps the "last sync" tile readable
 *  without pulling in a date library. Coarse buckets are intentional;
 *  precision below "minutes ago" doesn't help an operator. */
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
