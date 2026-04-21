"use client";

/**
 * ExtensionBridgePill — a small floating indicator in the bottom-right
 * corner of the dashboard that shows the Chrome extension's bridge state.
 *
 * Feature-detected: polls /api/extension-bridge/status once on mount, and
 * only renders when `everConnected === true` (i.e. the user has installed
 * the extension at least once in this server instance's memory). Keeps the
 * UI clean for users who aren't extension users.
 *
 * After first render, the pill polls the status endpoint every 5s so a
 * recent disconnect shows up quickly.
 */

import { useEffect, useState } from "react";
// lucide-react no longer exports "Chrome" — use Puzzle (the universal
// browser-extension glyph) to indicate the Chrome extension pill.
import { Puzzle, CircleDot } from "lucide-react";

type Status = {
  connected: boolean;
  lastHeartbeatAt: number;
  extensionVersion?: string;
  everConnected: boolean;
};

const POLL_MS = 5_000;

export default function ExtensionBridgePill() {
  const [status, setStatus] = useState<Status | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/extension-bridge/status", {
          credentials: "include",
        });
        if (!res.ok) return;
        const data: Status = await res.json();
        if (!cancelled) {
          setStatus(data);
          setBootstrapped(true);
        }
      } catch {
        /* ignore — unauthenticated or offline */
      }
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!bootstrapped || !status?.everConnected) return null;

  const connected = status.connected;
  return (
    <div
      className="fixed bottom-6 right-6 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full backdrop-blur-md border text-[10px] font-medium shadow-lg transition-colors"
      style={{
        background: connected
          ? "color-mix(in srgb, rgb(16 185 129) 12%, var(--color-surface, #151518) 88%)"
          : "color-mix(in srgb, rgb(239 68 68) 10%, var(--color-surface, #151518) 90%)",
        borderColor: connected
          ? "rgba(16, 185, 129, 0.4)"
          : "rgba(239, 68, 68, 0.35)",
        color: connected ? "rgb(52 211 153)" : "rgb(248 113 113)",
      }}
      title={
        connected
          ? `Extension connected${status.extensionVersion ? ` (v${status.extensionVersion})` : ""}`
          : "Extension installed but not connected"
      }
    >
      <Puzzle size={10} />
      <CircleDot
        size={8}
        className={connected ? "animate-pulse" : ""}
      />
      <span>Extension: {connected ? "Connected" : "Disconnected"}</span>
    </div>
  );
}
