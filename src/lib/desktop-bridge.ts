/**
 * desktop-bridge.ts — thin wrapper around `window.ssDesktop` (exposed by
 * electron/preload-agent.js). Every helper is feature-detected and safe to
 * call in the plain-web dashboard — on non-Electron builds every function
 * is a no-op that returns a resolved promise, and web users see zero
 * change in behaviour.
 *
 * Anything here runs only in the renderer. Always guarded with
 * `typeof window !== "undefined"` to stay SSR-safe.
 */
"use client";

// ── Types ─────────────────────────────────────────────────────────────

export type NotifyPresetKind =
  | "leadScraped"
  | "emailOpened"
  | "adAlert"
  | "agentReply";

export interface NotifyOptions {
  title: string;
  body?: string;
  subtitle?: string;
  silent?: boolean;
  urgency?: "normal" | "critical" | "low";
  onClickRoute?: string;
  meta?: Record<string, unknown>;
}

export interface AssetIntent {
  kind: "screenshot" | "clipboard" | "dropbox";
  filePath?: string;
  fileName?: string;
  mimeType?: string;
  dataUrl?: string;
  bytes?: number;
  createdAt?: string;
}

export interface QuickNoteIntent {
  text: string;
  createdAt: string;
}

export interface DeepLink {
  url: string;
  host?: string;
  path?: string;
  params?: Record<string, string>;
}

// ── Minimal shape of window.ssDesktop we use ──────────────────────────
interface SsDesktop {
  isDesktop: true;
  notify: (opts: NotifyOptions) => Promise<unknown>;
  notifyPreset: (
    kind: NotifyPresetKind,
    payload?: Record<string, unknown>,
  ) => Promise<unknown>;
  setUnread: (count: number) => Promise<unknown>;
  setCurrentClient: (label: string) => Promise<unknown>;
  openDropbox: () => Promise<unknown>;
  consumeDeepLink: () => Promise<DeepLink | null>;
  onAssetIntent: (cb: (data: AssetIntent) => void) => () => void;
  onQuickNote: (cb: (data: QuickNoteIntent) => void) => () => void;
}

declare global {
  interface Window {
    ssDesktop?: SsDesktop;
  }
}

// ── Feature detection ─────────────────────────────────────────────────

/**
 * True if we're running inside the Electron shell (preload injected
 * window.ssDesktop). Safe to call during SSR — always returns false on
 * the server. Call this before invoking any desktop-only side effect.
 */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && !!window.ssDesktop;
}

/** Get the raw bridge or null — prefer the typed helpers below. */
export function getDesktop(): SsDesktop | null {
  if (!isDesktop()) return null;
  return window.ssDesktop as SsDesktop;
}

// ── Notification helpers ──────────────────────────────────────────────

/** Fire a preset notification. No-op on web. */
export async function notifyPreset(
  kind: NotifyPresetKind,
  payload?: Record<string, unknown>,
): Promise<void> {
  const d = getDesktop();
  if (!d) return;
  try {
    await d.notifyPreset(kind, payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[desktop-bridge] notifyPreset failed", err);
  }
}

/** Fire an arbitrary native notification. No-op on web. */
export async function notify(opts: NotifyOptions): Promise<void> {
  const d = getDesktop();
  if (!d) return;
  try {
    await d.notify(opts);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[desktop-bridge] notify failed", err);
  }
}

// ── Tray helpers ──────────────────────────────────────────────────────

let _lastUnread: number | null = null;
let _unreadTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced tray-badge update — coalesces rapid Supabase change events
 * (realtime can fire many UPDATE rows per second). Delays by 250ms and
 * drops duplicate counts so the tray only redraws when the number
 * actually changes.
 */
export function updateUnreadBadge(count: number): void {
  const d = getDesktop();
  if (!d) return;
  const normalized = Math.max(0, Math.floor(count || 0));
  if (normalized === _lastUnread) return;
  if (_unreadTimer) clearTimeout(_unreadTimer);
  _unreadTimer = setTimeout(() => {
    _lastUnread = normalized;
    d.setUnread(normalized).catch(() => {
      /* ignore — tray may not be mounted yet */
    });
  }, 250);
}

/** Tell the tray which client the user is currently viewing. No-op on web. */
export async function setCurrentClient(label: string): Promise<void> {
  const d = getDesktop();
  if (!d) return;
  try {
    await d.setCurrentClient(label || "");
  } catch {
    /* ignore */
  }
}

// ── Deep link / dropbox ───────────────────────────────────────────────

/**
 * Pop any queued `shortstack://` deep link. Returns null on web or if
 * nothing is pending.
 */
export async function consumeDeepLink(): Promise<DeepLink | null> {
  const d = getDesktop();
  if (!d) return null;
  try {
    return await d.consumeDeepLink();
  } catch {
    return null;
  }
}

/**
 * Translate a `shortstack://` deep link into an app route. Returns null
 * if we don't know how to handle it (caller should leave the user where
 * they are rather than blind-redirect).
 *
 * Supported shapes:
 *   shortstack://client/<id>      → /dashboard/clients/<id>
 *   shortstack://lead/<id>        → /dashboard/leads/<id>
 *   shortstack://dashboard/<path> → /dashboard/<path>
 *   shortstack://open?path=/foo   → /foo
 */
export function resolveDeepLink(link: DeepLink | null | undefined): string | null {
  if (!link) return null;
  // Prefer params.path if the link supplied one explicitly
  const explicit = link.params?.path;
  if (explicit && explicit.startsWith("/")) return explicit;

  const host = (link.host || "").toLowerCase();
  const path = link.path?.replace(/^\/+/, "") || "";

  if (!host) return null;
  if (host === "client" || host === "clients") {
    const id = path.split("/")[0];
    return id ? `/dashboard/clients/${id}` : "/dashboard/clients";
  }
  if (host === "lead" || host === "leads") {
    const id = path.split("/")[0];
    return id ? `/dashboard/leads/${id}` : "/dashboard/leads";
  }
  if (host === "dashboard") {
    return `/dashboard${path ? `/${path}` : ""}`;
  }
  if (host === "open") {
    // shortstack://open/foo → /foo
    return path ? `/${path}` : null;
  }
  return null;
}

/** Open the local `~/ShortStack/Dropbox/` folder. No-op on web. */
export async function openDropboxFolder(): Promise<void> {
  const d = getDesktop();
  if (!d) return;
  try {
    await d.openDropbox();
  } catch {
    /* ignore */
  }
}

// ── Event subscriptions ───────────────────────────────────────────────

/** Subscribe to screenshot / clipboard / dropbox asset events. */
export function onAssetIntent(cb: (asset: AssetIntent) => void): () => void {
  const d = getDesktop();
  if (!d) return () => {};
  return d.onAssetIntent(cb);
}

/** Subscribe to Ctrl+Shift+N quick notes. */
export function onQuickNote(cb: (note: QuickNoteIntent) => void): () => void {
  const d = getDesktop();
  if (!d) return () => {};
  return d.onQuickNote(cb);
}

// ── High-level lead-stream helper ─────────────────────────────────────

/**
 * Helper for scraper/lead code paths — fires `notifyPreset("leadScraped")`
 * with a count + niche payload. Use this instead of `notifyPreset` directly
 * so call sites stay consistent and we can batch/throttle in one place
 * later.
 */
export function subscribeToLeadStream(
  lead: { count: number; niche?: string } | number,
): void {
  const count = typeof lead === "number" ? lead : lead.count;
  const niche = typeof lead === "number" ? undefined : lead.niche;
  if (!count || count < 1) return;
  void notifyPreset("leadScraped", { count, niche });
}
