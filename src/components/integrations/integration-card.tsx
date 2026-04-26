/**
 * Integration card for the Integrations Hub grid.
 *
 * Renders a single Nango-backed integration with:
 *   - Logo (or letter-fallback colored circle when no SVG is bundled)
 *   - Name + category chip
 *   - Short description
 *   - Status dot ("connected" green / "not connected" gray / "coming soon" yellow)
 *   - Action button:
 *       not connected  → "Connect"   (calls onConnect)
 *       connected      → "Connected as <display_name>" + small "Disconnect"
 *       coming soon    → disabled "Coming soon"
 *
 * The card is purely presentational — the actual Nango popup, modal opening,
 * disconnect API call, and toast feedback all live in the parent page. We
 * surface intent through `onConnect` / `onDisconnect` callbacks so the page
 * can sequence the modal → popup → finalize flow consistently.
 */

"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, Plug, Loader, Unlink } from "lucide-react";
import { SHORTSTACK_GOLD } from "@/components/logo";

export type IntegrationStatus = "connected" | "not_connected" | "coming_soon";

export interface IntegrationCardData {
  /** Nango integration ID, e.g. "google-zanb" */
  id: string;
  /** Display name shown to the user */
  name: string;
  /** Category label — drives the filter pill */
  category: string;
  /** Short marketing description */
  description: string;
  /** Optional logo URL (bundled or remote). Falls back to a letter avatar
   *  when missing or 404. */
  logo?: string;
  /** Bullet list of scopes for the connect modal */
  scopes?: string[];
  /** True for previewed-but-not-shipped integrations */
  comingSoon?: boolean;
}

export interface IntegrationCardProps {
  integration: IntegrationCardData;
  status: IntegrationStatus;
  /** Optional display name returned from `oauth_connections_nango.display_name`
   *  when the user is already connected. */
  connectedAs?: string | null;
  /** Disable the action while the parent is in the middle of an async
   *  connect/disconnect/finalize. Lets us show a spinner without race
   *  conditions on multiple clicks. */
  busy?: boolean;
  onConnect: (integration: IntegrationCardData) => void;
  onDisconnect: (integration: IntegrationCardData) => void;
}

/** Deterministic accent color so each integration gets its own letter-avatar
 *  hue when no logo is bundled. Hash the id → pick a hue from a curated
 *  palette so two adjacent cards never look identical. */
function fallbackHue(id: string): string {
  const palette = [
    "#3B82F6", // blue
    "#8B5CF6", // violet
    "#EC4899", // pink
    "#F59E0B", // amber
    "#10B981", // emerald
    "#EF4444", // red
    "#06B6D4", // cyan
    "#F97316", // orange
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function StatusDot({ status }: { status: IntegrationStatus }) {
  const config = {
    connected: { color: "#10B981", label: "Connected" },
    not_connected: { color: "#6B7280", label: "Not connected" },
    coming_soon: { color: "#F59E0B", label: "Coming soon" },
  }[status];

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted">
      <span
        aria-hidden
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{
          background: config.color,
          boxShadow:
            status === "connected"
              ? `0 0 6px ${config.color}80`
              : undefined,
        }}
      />
      <span>{config.label}</span>
    </div>
  );
}

export default function IntegrationCard({
  integration,
  status,
  connectedAs,
  busy,
  onConnect,
  onDisconnect,
}: IntegrationCardProps) {
  // Track whether the bundled <Image /> hits a 404, so we can swap to the
  // letter avatar without flashing a broken-image icon.
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = integration.logo && !logoFailed;

  const isConnected = status === "connected";
  const isComingSoon = status === "coming_soon";

  return (
    <div
      className={[
        "group relative rounded-xl border bg-surface p-4 transition-all",
        "hover:border-gold/30 hover:shadow-card-hover hover:-translate-y-[1px]",
        isComingSoon ? "opacity-70" : "",
        "border-border",
      ].join(" ")}
    >
      {/* Top row: logo + name + status dot */}
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-surface-light border border-border/60 overflow-hidden"
          style={{
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.04) inset, 0 2px 8px -3px rgba(0,0,0,0.4)",
          }}
        >
          {showLogo ? (
            <Image
              src={integration.logo as string}
              alt={`${integration.name} logo`}
              width={32}
              height={32}
              unoptimized
              className="rounded-md object-contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <span
              className="text-lg font-bold"
              style={{ color: fallbackHue(integration.id) }}
              aria-hidden
            >
              {integration.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold leading-tight truncate">
              {integration.name}
            </p>
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted bg-surface-light border border-border/60 px-1.5 py-0.5 rounded">
              {integration.category}
            </span>
          </div>
          <p className="text-[11px] text-muted mt-0.5 line-clamp-2">
            {integration.description}
          </p>
        </div>
      </div>

      {/* Bottom row: status + action */}
      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
        <StatusDot status={status} />

        {isComingSoon && (
          <button
            type="button"
            disabled
            className="text-[11px] font-medium px-3 py-1.5 rounded-md border border-border/60 text-muted cursor-not-allowed"
          >
            Coming soon
          </button>
        )}

        {!isComingSoon && !isConnected && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onConnect(integration)}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-md text-black transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: SHORTSTACK_GOLD,
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.3) inset, 0 4px 10px -3px rgba(201,168,76,0.55)",
            }}
          >
            {busy ? (
              <Loader size={11} className="animate-spin" />
            ) : (
              <Plug size={11} />
            )}
            <span>{busy ? "Connecting" : "Connect"}</span>
          </button>
        )}

        {!isComingSoon && isConnected && (
          <div className="flex items-center gap-2 max-w-[60%]">
            <span
              className="flex items-center gap-1 text-[10px] text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded truncate"
              title={connectedAs ? `Connected as ${connectedAs}` : "Connected"}
            >
              <Check size={9} className="shrink-0" />
              <span className="truncate">
                {connectedAs ? `as ${connectedAs}` : "Connected"}
              </span>
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDisconnect(integration)}
              className="flex items-center gap-1 text-[10px] text-muted hover:text-danger transition-colors disabled:opacity-60"
              aria-label={`Disconnect ${integration.name}`}
            >
              {busy ? (
                <Loader size={10} className="animate-spin" />
              ) : (
                <Unlink size={10} />
              )}
              <span>Disconnect</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
