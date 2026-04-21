/* ShortStack OS — Extension Bridge Client
 *
 * Lightweight WebSocket client that lives in the background service
 * worker. Talks to wss://app.shortstack.work/api/extension-bridge.
 *
 * Wire protocol (JSON text frames):
 *   Client → Server:
 *     { type: "hello", token, extId, ver }
 *     { type: "ack", cmdId, result }        // response to a server command
 *     { type: "error", cmdId, error }
 *     { type: "event", name, data }         // unsolicited (e.g. page changed)
 *
 *   Server → Client:
 *     { type: "cmd", cmdId, target, action, args }
 *       target: "tab" (active tab content script) | "bg" (background)
 *       action: matches HANDLERS in agentic.js OR background-only ones
 *               ("screenshot", "navigate", "getTabs", "listTabs")
 *
 * This module is deliberately standalone: no imports beyond
 * chrome.* APIs so it stays loadable from service-worker context.
 *
 * IMPORTANT: This is the client-side scaffold only. The server side
 * at app.shortstack.work/api/extension-bridge is a future buildout.
 * Until the endpoint exists, connect() will fail quickly and stay
 * idle — this is intentional and not an error.
 */

const BRIDGE_URL_DEFAULT = "wss://app.shortstack.work/api/extension-bridge";
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 60000;
const HEARTBEAT_MS = 25000;

const bridgeState = {
  ws: null,
  status: "disconnected", // disconnected | connecting | connected | error
  lastError: null,
  reconnectAttempts: 0,
  heartbeatTimer: null,
  reconnectTimer: null,
  manualDisconnect: false,
  lastConnectedAt: 0,
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
  return {
    url: (sync.bridgeUrl && sync.bridgeUrl.trim()) || BRIDGE_URL_DEFAULT,
    enabled: sync.bridgeEnabled !== false, // default on
    token: local.ss_access_token || "",
  };
}

async function connectBridge() {
  const { url, enabled, token } = await getBridgeConfig();
  if (!enabled) {
    setBridgeStatus("disconnected");
    return;
  }
  if (!token) {
    // No auth yet — don't spam the server with anonymous connects.
    setBridgeStatus("disconnected", { error: "Not authenticated" });
    return;
  }
  if (bridgeState.ws && (bridgeState.ws.readyState === WebSocket.OPEN || bridgeState.ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  setBridgeStatus("connecting");
  bridgeState.manualDisconnect = false;

  let ws;
  try {
    // Token is sent in the hello frame (not the URL) so it isn't
    // logged by intermediate proxies.
    ws = new WebSocket(url);
  } catch (e) {
    setBridgeStatus("error", { error: String(e) });
    scheduleReconnect();
    return;
  }
  bridgeState.ws = ws;

  ws.addEventListener("open", () => {
    bridgeState.reconnectAttempts = 0;
    bridgeState.lastConnectedAt = Date.now();
    setBridgeStatus("connected");
    safeSend({ type: "hello", token, extId: chrome.runtime.id, ver: chrome.runtime.getManifest().version });
    startHeartbeat();
  });

  ws.addEventListener("message", (evt) => {
    let msg;
    try { msg = JSON.parse(evt.data); } catch { return; }
    if (!msg || typeof msg !== "object") return;
    handleServerMessage(msg).catch((e) => {
      safeSend({ type: "error", cmdId: msg.cmdId, error: String(e) });
    });
  });

  ws.addEventListener("close", () => {
    stopHeartbeat();
    bridgeState.ws = null;
    if (bridgeState.manualDisconnect) {
      setBridgeStatus("disconnected");
      return;
    }
    setBridgeStatus("disconnected");
    scheduleReconnect();
  });

  ws.addEventListener("error", () => {
    // Fires in addition to close — just flag state
    setBridgeStatus("error", { error: "WebSocket error" });
  });
}

function disconnectBridge() {
  bridgeState.manualDisconnect = true;
  stopHeartbeat();
  clearReconnect();
  if (bridgeState.ws) {
    try { bridgeState.ws.close(1000, "manual"); } catch (_) {}
    bridgeState.ws = null;
  }
  setBridgeStatus("disconnected");
}

function safeSend(obj) {
  if (!bridgeState.ws || bridgeState.ws.readyState !== WebSocket.OPEN) return false;
  try {
    bridgeState.ws.send(JSON.stringify(obj));
    return true;
  } catch {
    return false;
  }
}

function startHeartbeat() {
  stopHeartbeat();
  bridgeState.heartbeatTimer = setInterval(() => {
    safeSend({ type: "ping", t: Date.now() });
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

/* ── Server command dispatch ── */
async function handleServerMessage(msg) {
  if (msg.type === "pong") return;
  if (msg.type !== "cmd") return;

  const { cmdId, target, action, args } = msg;
  try {
    let result;
    if (target === "bg") {
      result = await handleBackgroundAction(action, args || {});
    } else {
      // Default to active tab
      result = await sendToActiveTab({ type: "SS_AGENTIC", action, args: args || {} });
    }
    safeSend({ type: "ack", cmdId, result });
  } catch (e) {
    safeSend({ type: "error", cmdId, error: String(e) });
  }
}

async function handleBackgroundAction(action, args) {
  switch (action) {
    case "screenshot": {
      // Capture currently visible tab. Requires "activeTab" + user gesture,
      // but as long as the extension was invoked via the bridge recently
      // Chrome allows captureVisibleTab on the focused window.
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
};
