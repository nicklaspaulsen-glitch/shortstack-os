/* ShortStack OS — Extension Bridge Client
 *
 * Background service-worker transport that connects the extension to the
 * ShortStack OS web app. Previously this was a raw WebSocket to
 * wss://app.shortstack.work/api/extension-bridge. That WS endpoint was
 * never implemented on the server side — Next.js 14's App Router doesn't
 * support WebSocket upgrade out of the box.
 *
 * This rewrite keeps the same wire-protocol semantics (hello → ack,
 * cmd → result, event, heartbeat) but delivers them over authenticated
 * HTTPS long-poll + POST against:
 *
 *   GET  /api/extension-bridge/pending      ← long-poll, returns cmds
 *   POST /api/extension-bridge/ack          ← result or event
 *   POST /api/extension-bridge/heartbeat    ← keep-alive
 *
 * Wire shapes (unchanged):
 *   cmd:    { id, target, action, params }
 *   result: { type: "result", id, ok, data?, error? }
 *   event:  { type: "event", kind, data? }
 *
 * Why not Supabase Realtime directly? Two reasons:
 *   1. The @supabase/supabase-js realtime client is not easy to load in
 *      an MV3 service worker (no importScripts URL loading allowed).
 *   2. HTTPS long-poll reuses our existing Bearer-token auth flow from
 *      requireExtensionUser(), avoiding the RLS + channel-auth policy
 *      work we'd otherwise need.
 *
 * This module stays standalone: no imports beyond chrome.* + fetch so it
 * remains importScripts-friendly from background.js.
 */

const API_BASE_DEFAULT = "https://app.shortstack.work";
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 60000;
const HEARTBEAT_MS = 25000;
const EXTENSION_VERSION = "1.1.0";

const bridgeState = {
  status: "disconnected", // disconnected | connecting | connected | error
  lastError: null,
  reconnectAttempts: 0,
  heartbeatTimer: null,
  reconnectTimer: null,
  manualDisconnect: false,
  lastConnectedAt: 0,
  sessionId: null,
  userId: null,
  pollAbort: null,
  pollActive: false,
};

function setBridgeStatus(status, extra = {}) {
  bridgeState.status = status;
  bridgeState.lastError = extra.error || null;
  // Store minimal snapshot for popup polling
  chrome.storage.local.set({
    ss_bridge: {
      status,
      error: extra.error || null,
      lastConnectedAt: bridgeState.lastConnectedAt,
      updatedAt: Date.now(),
    },
  });
  // Best-effort broadcast so the popup can react immediately
  try {
    chrome.runtime.sendMessage({ type: "SS_BRIDGE_STATUS", status, error: extra.error || null });
  } catch (_) { /* no listeners when popup closed */ }
}

async function getBridgeConfig() {
  const sync = await chrome.storage.sync.get(["bridgeUrl", "bridgeEnabled"]);
  const local = await chrome.storage.local.get(["ss_access_token"]);
  // bridgeUrl still accepted for backwards-compat, but we only use its
  // origin (the WS protocol is no longer meaningful).
  const raw = (sync.bridgeUrl && sync.bridgeUrl.trim()) || API_BASE_DEFAULT;
  let apiBase = API_BASE_DEFAULT;
  try {
    const u = new URL(raw.replace(/^wss?:/, "https:"));
    apiBase = `${u.protocol}//${u.host}`;
  } catch (_) { /* fall back to default */ }
  return {
    apiBase,
    enabled: sync.bridgeEnabled !== false, // default on
    token: local.ss_access_token || "",
  };
}

async function bridgeFetch(path, { method = "GET", body, signal, token, apiBase } = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    signal,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function connectBridge() {
  const { apiBase, enabled, token } = await getBridgeConfig();
  if (!enabled) {
    setBridgeStatus("disconnected");
    return;
  }
  if (!token) {
    setBridgeStatus("disconnected", { error: "Not authenticated" });
    return;
  }
  if (bridgeState.status === "connecting" || bridgeState.status === "connected") {
    return;
  }

  setBridgeStatus("connecting");
  bridgeState.manualDisconnect = false;

  try {
    // Send "hello" equivalent — the heartbeat endpoint returns the ack
    // (session_id, user_id) that the original protocol delivered on
    // WebSocket open.
    const ack = await bridgeFetch("/api/extension-bridge/heartbeat", {
      method: "POST",
      body: { extension_version: EXTENSION_VERSION },
      token,
      apiBase,
    });
    bridgeState.sessionId = ack.session_id || null;
    bridgeState.userId = ack.user_id || null;
    bridgeState.reconnectAttempts = 0;
    bridgeState.lastConnectedAt = Date.now();
    setBridgeStatus("connected");
    startHeartbeat();
    startPollLoop();
  } catch (e) {
    setBridgeStatus("error", { error: String(e) });
    scheduleReconnect();
  }
}

function disconnectBridge() {
  bridgeState.manualDisconnect = true;
  stopHeartbeat();
  clearReconnect();
  if (bridgeState.pollAbort) {
    try { bridgeState.pollAbort.abort(); } catch (_) {}
  }
  bridgeState.pollActive = false;
  bridgeState.sessionId = null;
  bridgeState.userId = null;
  setBridgeStatus("disconnected");
}

function startHeartbeat() {
  stopHeartbeat();
  bridgeState.heartbeatTimer = setInterval(async () => {
    try {
      const { apiBase, token } = await getBridgeConfig();
      if (!token) {
        disconnectBridge();
        return;
      }
      await bridgeFetch("/api/extension-bridge/heartbeat", {
        method: "POST",
        body: { extension_version: EXTENSION_VERSION },
        token,
        apiBase,
      });
    } catch (e) {
      // Heartbeat fail → bounce the bridge
      setBridgeStatus("error", { error: `Heartbeat failed: ${e}` });
      stopHeartbeat();
      scheduleReconnect();
    }
  }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (bridgeState.heartbeatTimer) {
    clearInterval(bridgeState.heartbeatTimer);
    bridgeState.heartbeatTimer = null;
  }
}

function scheduleReconnect() {
  clearReconnect();
  if (bridgeState.manualDisconnect) return;
  bridgeState.reconnectAttempts += 1;
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** (bridgeState.reconnectAttempts - 1), RECONNECT_MAX_MS);
  bridgeState.reconnectTimer = setTimeout(() => { connectBridge(); }, delay);
}

function clearReconnect() {
  if (bridgeState.reconnectTimer) {
    clearTimeout(bridgeState.reconnectTimer);
    bridgeState.reconnectTimer = null;
  }
}

/* ── Long-poll loop ──
 * Maintains an open GET /pending request. The server holds it up to ~20s
 * then returns { cmds } — either with queued work or empty. Either way we
 * immediately re-poll so there's almost always one open socket.
 */
async function startPollLoop() {
  if (bridgeState.pollActive) return;
  bridgeState.pollActive = true;
  while (bridgeState.pollActive && !bridgeState.manualDisconnect) {
    let cmds = [];
    try {
      const { apiBase, token } = await getBridgeConfig();
      if (!token) { disconnectBridge(); return; }
      bridgeState.pollAbort = new AbortController();
      const res = await bridgeFetch("/api/extension-bridge/pending", {
        method: "GET",
        signal: bridgeState.pollAbort.signal,
        token,
        apiBase,
      });
      cmds = Array.isArray(res.cmds) ? res.cmds : [];
    } catch (e) {
      if (bridgeState.manualDisconnect) break;
      setBridgeStatus("error", { error: `Poll failed: ${e}` });
      bridgeState.pollActive = false;
      scheduleReconnect();
      return;
    }
    for (const cmd of cmds) {
      handleServerCommand(cmd).catch(() => { /* already acked as error */ });
    }
  }
  bridgeState.pollActive = false;
}

async function ackToServer(body) {
  try {
    const { apiBase, token } = await getBridgeConfig();
    if (!token) return false;
    await bridgeFetch("/api/extension-bridge/ack", {
      method: "POST",
      body,
      token,
      apiBase,
    });
    return true;
  } catch {
    return false;
  }
}

/* ── Server command dispatch ── */
async function handleServerCommand(cmd) {
  const { id, target, action, params } = cmd;
  try {
    let data;
    if (target === "bg") {
      data = await handleBackgroundAction(action, params || {});
    } else {
      data = await sendToActiveTab({ type: "SS_AGENTIC", action, args: params || {} });
    }
    await ackToServer({ type: "result", id, ok: true, data });
  } catch (e) {
    await ackToServer({ type: "result", id, ok: false, error: String(e) });
  }
}

/** Public helper so agentic.js / content scripts can push an unsolicited
 *  event back to the app (e.g. "page_loaded"). */
async function emitBridgeEvent(kind, data) {
  return ackToServer({ type: "event", kind, data });
}

async function handleBackgroundAction(action, args) {
  switch (action) {
    case "screenshot": {
      return new Promise((resolve, reject) => {
        chrome.tabs.captureVisibleTab(null, { format: args.format || "png" }, (dataUrl) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve({ ok: true, dataUrl });
        });
      });
    }
    case "listTabs": {
      const tabs = await chrome.tabs.query({});
      return {
        ok: true,
        tabs: tabs.map((t) => ({ id: t.id, url: t.url, title: t.title, active: t.active, windowId: t.windowId })),
      };
    }
    case "navigate": {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab) throw new Error("No active tab");
      await chrome.tabs.update(tab.id, { url: args.url });
      return { ok: true, tabId: tab.id, url: args.url };
    }
    case "getBridgeStatus":
      return { ok: true, status: bridgeState.status, lastConnectedAt: bridgeState.lastConnectedAt };
    default:
      throw new Error(`Unknown bg action: ${action}`);
  }
}

function sendToActiveTab(message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab) return reject(new Error("No active tab"));
      chrome.tabs.sendMessage(tab.id, message, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(res);
      });
    });
  });
}

/* ── Internal API for popup/background ── */
function getBridgeState() {
  return {
    status: bridgeState.status,
    error: bridgeState.lastError,
    lastConnectedAt: bridgeState.lastConnectedAt,
    reconnectAttempts: bridgeState.reconnectAttempts,
    sessionId: bridgeState.sessionId,
    userId: bridgeState.userId,
  };
}

// Expose on `self` so the service worker (which imports this via
// importScripts) can reach the functions. `self` is the global in a
// service worker context.
self.ShortStackBridge = {
  connect: connectBridge,
  disconnect: disconnectBridge,
  state: getBridgeState,
  sendToActiveTab,
  emitEvent: emitBridgeEvent,
};
