"use client";

import { useState } from "react";
import { Loader2, Plus, Check } from "lucide-react";
import {
  InstagramIcon,
  FacebookIcon,
  LinkedInIcon,
  TikTokIcon,
} from "@/components/ui/platform-icons";
import { useSocialAccounts } from "@/hooks/use-social-accounts";
import toast from "react-hot-toast";

export type SocialPlatformId =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "twitter"
  | "x"
  | "pinterest";

const PLATFORM_META: Record<string, { name: string; icon: (s: number) => React.ReactNode; color: string }> = {
  instagram: { name: "Instagram", icon: s => <InstagramIcon size={s} />, color: "#E1306C" },
  facebook:  { name: "Facebook",  icon: s => <FacebookIcon size={s} />,  color: "#1877F2" },
  linkedin:  { name: "LinkedIn",  icon: s => <LinkedInIcon size={s} />,  color: "#0A66C2" },
  tiktok:    { name: "TikTok",    icon: s => <TikTokIcon size={s} />,    color: "#25F4EE" },
};

/**
 * Inline social media connect — NO redirect to /dashboard/social-manager.
 *
 * Opens the OAuth flow in a popup window and listens for postMessage / popup
 * close to detect completion. Fires `social-connections-changed` on the window
 * so other components using `useSocialAccounts` instantly refresh.
 */
export default function InlineSocialConnect({
  platforms,
  clientId,
  compact = false,
  label = "Connect",
  onConnected,
}: {
  platforms: SocialPlatformId[];
  clientId?: string;
  compact?: boolean;
  label?: string;
  onConnected?: (platform: string) => void;
}) {
  const { isConnected, refresh } = useSocialAccounts({ clientId });
  const [busy, setBusy] = useState<string | null>(null);

  async function startConnect(platform: SocialPlatformId) {
    setBusy(platform);
    try {
      const res = await fetch("/api/social/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          client_id: clientId || null,
          action: "zernio_oauth",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.oauth_url) {
        toast.error(data?.error || `Couldn't start ${platform} connect`);
        setBusy(null);
        return;
      }
      // Open OAuth in popup so user stays on the current page
      const popup = window.open(
        data.oauth_url,
        "social_oauth",
        "width=620,height=760,popup=yes,noopener=no",
      );
      if (!popup) {
        // Popups blocked — fall back to full redirect
        window.location.href = data.oauth_url;
        return;
      }
      // Watch for popup close
      const timer = setInterval(async () => {
        if (popup.closed) {
          clearInterval(timer);
          setBusy(null);
          await refresh();
          window.dispatchEvent(new Event("social-connections-changed"));
          // Check if it actually connected
          const recheck = await fetch(
            clientId
              ? `/api/social/connect?client_id=${encodeURIComponent(clientId)}`
              : "/api/social/status",
            { cache: "no-store" },
          );
          const d = await recheck.json().catch(() => ({}));
          const list = d?.accounts || d?.social_accounts || [];
          const nowConnected = list.some(
            (a: { platform: string; is_active?: boolean }) =>
              String(a.platform).toLowerCase() === platform && a.is_active !== false,
          );
          if (nowConnected) {
            toast.success(`${PLATFORM_META[platform]?.name || platform} connected`);
            onConnected?.(platform);
          }
        }
      }, 800);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {platforms.map(p => {
          const meta = PLATFORM_META[p];
          if (!meta) return null;
          const connected = isConnected(p);
          const isLoading = busy === p;
          return (
            <button
              key={p}
              onClick={() => !connected && startConnect(p)}
              disabled={connected || isLoading}
              title={connected ? `${meta.name} connected` : `Connect ${meta.name}`}
              className={
                connected
                  ? "flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-surface-light border border-border hover:border-gold/40 hover:text-foreground text-muted transition"
              }
            >
              {isLoading ? <Loader2 size={10} className="animate-spin" /> : connected ? <Check size={10} /> : meta.icon(10)}
              {meta.name}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {platforms.map(p => {
        const meta = PLATFORM_META[p];
        if (!meta) return null;
        const connected = isConnected(p);
        const isLoading = busy === p;
        return (
          <button
            key={p}
            onClick={() => !connected && startConnect(p)}
            disabled={connected || isLoading}
            className={
              connected
                ? "group relative overflow-hidden p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs"
                : "group relative overflow-hidden p-3 rounded-xl bg-surface-light/60 border border-border hover:border-gold/40 hover:bg-surface-light transition text-xs"
            }
            style={!connected ? { boxShadow: `inset 0 0 0 1px transparent` } : undefined}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity"
              style={{ background: meta.color }}
            />
            <div className="relative flex items-center gap-2">
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : connected ? (
                <Check size={18} />
              ) : (
                <span style={{ color: meta.color }}>{meta.icon(18)}</span>
              )}
              <div className="text-left">
                <div className="font-semibold">{meta.name}</div>
                <div className="text-[9px] opacity-70">
                  {connected ? "Connected" : isLoading ? "Connecting..." : label}
                </div>
              </div>
              {!connected && !isLoading && (
                <Plus size={12} className="ml-auto opacity-60 group-hover:opacity-100" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
