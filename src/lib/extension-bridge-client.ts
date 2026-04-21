/**
 * ShortStack OS — Extension Bridge Client (web side)
 *
 * High-level wrapper that app code calls to drive the Chrome extension.
 *
 *   import { extensionBridge } from "@/lib/extension-bridge-client";
 *
 *   const img = await extensionBridge.screenshot();
 *   await extensionBridge.click("#submit");
 *   await extensionBridge.type("input[name=email]", "x@y.com");
 *   const connected = await extensionBridge.isExtensionConnected();
 *
 * Under the hood: POST /api/extension-bridge/commands, then poll
 * /api/extension-bridge/poll/:cmd_id until the extension replies (or
 * the client times out). Credentials are sent via the app's existing
 * cookie session, so no extra wiring is needed at call sites.
 */

export type BridgeResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };

export type SendCommandOptions = {
  /** Override the default 15s timeout. */
  timeoutMs?: number;
  /** Override the target. Defaults to "tab" for DOM actions, "bg" for browser-level actions. */
  target?: "tab" | "bg";
};

const DEFAULT_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 350;

async function jsonFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let err = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data?.error) err = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(err);
  }
  return res.json() as Promise<T>;
}

/**
 * Low-level command sender. Posts to /commands then long-polls /poll/:id
 * until the extension replies or the timeout fires.
 */
export async function sendCommand(
  target: "tab" | "bg",
  action: string,
  params: Record<string, unknown> = {},
  opts: SendCommandOptions = {},
): Promise<BridgeResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const { cmd_id, extension_connected } = await jsonFetch<{
    cmd_id: string;
    extension_connected: boolean;
  }>("/api/extension-bridge/commands", {
    method: "POST",
    body: JSON.stringify({ target: opts.target ?? target, action, params }),
  });

  if (!extension_connected) {
    // The command is queued — if the extension comes online within the
    // TTL it will still execute. But we give the caller a fast, honest
    // signal instead of sitting and waiting.
    return {
      ok: false,
      error: "Extension is not connected. Install / open ShortStack OS to continue.",
    };
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await jsonFetch<
      | { status: "pending"; cmd_id: string }
      | { status: "done"; cmd_id: string; ok: boolean; data?: unknown; error?: string }
    >(`/api/extension-bridge/poll/${cmd_id}`);
    if (res.status === "done") {
      return res.ok ? { ok: true, data: res.data } : { ok: false, error: res.error || "Unknown error" };
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return { ok: false, error: `Timed out waiting for extension (${timeoutMs}ms)` };
}

export async function isExtensionConnected(): Promise<boolean> {
  try {
    const res = await jsonFetch<{ connected: boolean }>("/api/extension-bridge/status");
    return !!res.connected;
  } catch {
    return false;
  }
}

export async function getBridgeStatus(): Promise<{
  connected: boolean;
  lastHeartbeatAt: number;
  extensionVersion?: string;
  everConnected: boolean;
}> {
  return jsonFetch("/api/extension-bridge/status");
}

/**
 * Ergonomic, discoverable façade — what app code usually reaches for.
 * Each method returns the raw {ok, data|error} result from the extension.
 *
 * These action names match the HANDLERS in chrome-extension/agentic.js.
 * Add new ones there first, then add a thin wrapper here if it helps
 * discoverability; callers can always fall through to sendCommand() for
 * actions not listed.
 */
export const extensionBridge = {
  sendCommand,
  isExtensionConnected,
  getBridgeStatus,

  // ── DOM actions (content script) ──
  click: (selector: string, opts?: SendCommandOptions) =>
    sendCommand("tab", "click", { selector }, opts),
  type: (selector: string, text: string, opts?: SendCommandOptions) =>
    sendCommand("tab", "type", { selector, text }, opts),
  fill: (selector: string, value: string, opts?: SendCommandOptions) =>
    sendCommand("tab", "fill", { selector, value }, opts),
  select: (selector: string, value: string, opts?: SendCommandOptions) =>
    sendCommand("tab", "select", { selector, value }, opts),
  scroll: (params: { x?: number; y?: number; selector?: string }, opts?: SendCommandOptions) =>
    sendCommand("tab", "scroll", params, opts),
  getText: (selector?: string, opts?: SendCommandOptions) =>
    sendCommand("tab", "getText", { selector }, opts),
  getHTML: (selector?: string, opts?: SendCommandOptions) =>
    sendCommand("tab", "getHTML", { selector }, opts),
  waitFor: (selector: string, timeoutMs = 5000, opts?: SendCommandOptions) =>
    sendCommand("tab", "waitFor", { selector, timeoutMs }, { timeoutMs: timeoutMs + 2000, ...opts }),

  // ── Browser-level actions (background SW) ──
  screenshot: (opts?: SendCommandOptions) =>
    sendCommand("bg", "screenshot", { format: "png" }, opts),
  navigate: (url: string, opts?: SendCommandOptions) =>
    sendCommand("bg", "navigate", { url }, opts),
  listTabs: (opts?: SendCommandOptions) =>
    sendCommand("bg", "listTabs", {}, opts),
};
