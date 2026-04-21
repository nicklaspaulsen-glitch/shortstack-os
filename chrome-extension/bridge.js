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
const EXTENSION_VERSION = "1.2.0";

/* ── Rate limit config (v2) ──
 * Token bucket: refill at 30 tokens/min (0.5/sec), max burst 10.
 * Per-user. If the bucket is empty the command is rejected with
 * { error: "rate_limited", retryAfterMs }.
 */
const RATE_LIMIT_PER_MIN = 30;
const RATE_LIMIT_BURST = 10;
const RATE_LIMIT_REFILL_PER_MS = RATE_LIMIT_PER_MIN / 60000;

/* Actions the allowlist/blocklist does NOT apply to — these are either
 * bridge introspection or host-level operations that don't touch page
 * content. */
const HOST_INDEPENDENT_ACTIONS = new Set([
  "getBridgeStatus",
  "listTabs",
]);

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
  /* Rate-limit buckets keyed by userId. Service-worker restarts drop the
   * map, which is fine — a user can't meaningfully exceed the limit
   * across restarts faster than they could fresh. */
  rateBuckets: new Map(),
  /* Debugger attached tabs so we don't double-attach for coord clicks. */
  debuggerAttached: new Set(),
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
  const sync = await chrome.storage.sync.get([
    "bridgeUrl",
    "bridgeEnabled",
    "agenticAllowlist",
    "agenticBlocklist",
  ]);
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
    allowlist: Array.isArray(sync.agenticAllowlist) ? sync.agenticAllowlist : [],
    blocklist: Array.isArray(sync.agenticBlocklist) ? sync.agenticBlocklist : [],
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

/* ── Rate limiting (token bucket) ──
 * Buckets keyed by userId. Returns { ok: true } if the command may proceed,
 * or { ok: false, retryAfterMs } when the user has exceeded the limit.
 */
function checkRateLimit(userId) {
  const key = userId || "anon";
  const now = Date.now();
  let bucket = bridgeState.rateBuckets.get(key);
  if (!bucket) {
    bucket = { tokens: RATE_LIMIT_BURST, lastRefill: now };
    bridgeState.rateBuckets.set(key, bucket);
  }
  // Refill
  const elapsed = now - bucket.lastRefill;
  if (elapsed > 0) {
    bucket.tokens = Math.min(RATE_LIMIT_BURST, bucket.tokens + elapsed * RATE_LIMIT_REFILL_PER_MS);
    bucket.lastRefill = now;
  }
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { ok: true, remaining: Math.floor(bucket.tokens) };
  }
  const retryAfterMs = Math.ceil((1 - bucket.tokens) / RATE_LIMIT_REFILL_PER_MS);
  return { ok: false, retryAfterMs };
}

/* ── Host allowlist / blocklist ── */
function hostFromUrl(url) {
  try { return new URL(url).host; } catch { return ""; }
}

function hostMatches(host, pattern) {
  if (!host || !pattern) return false;
  if (pattern === host) return true;
  // Wildcard support: "*.example.com" matches "foo.example.com" and root.
  if (pattern.startsWith("*.")) {
    const bare = pattern.slice(2);
    return host === bare || host.endsWith("." + bare);
  }
  return false;
}

async function checkHostPolicy(action) {
  if (HOST_INDEPENDENT_ACTIONS.has(action)) return { ok: true, host: null };
  const { allowlist, blocklist } = await getBridgeConfig();
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) return { ok: false, error: "no_active_tab" };
  const host = hostFromUrl(tab.url || "");
  if (blocklist.some((p) => hostMatches(host, p))) {
    return { ok: false, error: "host_blocked", host };
  }
  if (allowlist.length > 0 && !allowlist.some((p) => hostMatches(host, p))) {
    return { ok: false, error: "host_not_allowed", host };
  }
  return { ok: true, host };
}

/* ── Server command dispatch ── */
async function handleServerCommand(cmd) {
  const { id, target, action, params } = cmd;

  // Rate limit first — cheap and before any IO.
  const rl = checkRateLimit(bridgeState.userId);
  if (!rl.ok) {
    await ackToServer({ type: "result", id, ok: false, error: "rate_limited", retryAfterMs: rl.retryAfterMs });
    return;
  }

  // Host policy check for anything that touches the active tab.
  if (target !== "bg" || !HOST_INDEPENDENT_ACTIONS.has(action)) {
    const policy = await checkHostPolicy(action);
    if (!policy.ok) {
      await ackToServer({ type: "result", id, ok: false, error: policy.error, host: policy.host });
      return;
    }
  }

  try {
    let data;
    if (target === "bg") {
      data = await handleBackgroundAction(action, params || {});
    } else {
      const frameId = params && typeof params.frameId === "number" ? params.frameId : undefined;
      data = await sendToActiveTab({ type: "SS_AGENTIC", action, args: params || {} }, frameId);
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
    case "screenshot":        return bgScreenshot(args);
    case "listTabs":          return bgListTabs();
    case "navigate":          return bgNavigate(args);
    case "waitForNavigation": return bgWaitForNavigation(args);
    case "coordClick":        return bgCoordClick(args);
    case "getBridgeStatus":
      return { ok: true, status: bridgeState.status, lastConnectedAt: bridgeState.lastConnectedAt };
    default:
      throw new Error("Unknown bg action: " + action);
  }
}

async function bgListTabs() {
  const tabs = await chrome.tabs.query({});
  return {
    ok: true,
    tabs: tabs.map((t) => ({ id: t.id, url: t.url, title: t.title, active: t.active, windowId: t.windowId })),
  };
}

async function bgNavigate(args) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) throw new Error("No active tab");
  await chrome.tabs.update(tab.id, { url: args.url });
  return { ok: true, tabId: tab.id, url: args.url };
}

/* ── Screenshot (with optional highlight) ──
 * If `args.highlight` is a selector, we first fetch the element's
 * on-screen rect from the content script, then composite a red rectangle
 * onto the captured PNG using OffscreenCanvas. Returns
 * { dataUrl, highlighted: rect }.
 */
async function bgScreenshot(args) {
  const opts = args || {};
  const format = opts.format || "png";
  const baseDataUrl = await new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(null, { format }, (dataUrl) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(dataUrl);
    });
  });

  if (!opts.highlight) {
    return { ok: true, dataUrl: baseDataUrl };
  }

  let rectInfo = null;
  // Preferred: small scripting.executeScript to get rect + devicePixelRatio
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [opts.highlight],
        func: (sel) => {
          try {
            const el = document.querySelector(sel);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { rect: { x: r.x, y: r.y, w: r.width, h: r.height }, dpr: window.devicePixelRatio || 1 };
          } catch (_) { return null; }
        },
      });
      rectInfo = (results && results[0] && results[0].result) || null;
    }
  } catch (_) { /* fall through */ }

  if (!rectInfo) {
    return { ok: true, dataUrl: baseDataUrl, highlighted: null, warning: "highlight_selector_not_found" };
  }
  try {
    const annotated = await annotateDataUrl(baseDataUrl, rectInfo.rect, rectInfo.dpr || 1);
    return { ok: true, dataUrl: annotated, highlighted: rectInfo.rect };
  } catch (e) {
    return { ok: true, dataUrl: baseDataUrl, highlighted: rectInfo.rect, warning: "annotate_failed: " + e };
  }
}

/* Composite a red rectangle over the captured PNG using OffscreenCanvas.
 * Service workers have OffscreenCanvas + createImageBitmap, so no DOM
 * needed. */
async function annotateDataUrl(dataUrl, rect, dpr) {
  const scale = dpr || 1;
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0);
  ctx.strokeStyle = "#ff3b3b";
  ctx.lineWidth = Math.max(3, Math.floor(3 * scale));
  const x = rect.x * scale;
  const y = rect.y * scale;
  const w = rect.w * scale;
  const h = rect.h * scale;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "rgba(255, 59, 59, 0.15)";
  ctx.fillRect(x, y, w, h);
  const outBlob = await canvas.convertToBlob({ type: "image/png" });
  return await blobToDataUrl(outBlob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/* ── waitForNavigation (background) ──
 * Stronger than the content-script variant — listens to
 * chrome.webNavigation.onCompleted on the active tab and resolves as
 * soon as a top-frame navigation finishes. Returns the final URL.
 */
async function bgWaitForNavigation(args) {
  const opts = args || {};
  const timeout = typeof opts.timeout === "number" ? opts.timeout : 15000;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) throw new Error("No active tab");
  const tabId = tab.id;
  const startUrl = tab.url;

  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { chrome.webNavigation.onCompleted.removeListener(listener); } catch (_) {}
      resolve({ ok: false, error: "waitForNavigation timed out", timeoutMs: timeout, startUrl });
    }, timeout);
    const listener = (details) => {
      if (details.tabId !== tabId || details.frameId !== 0) return;
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { chrome.webNavigation.onCompleted.removeListener(listener); } catch (_) {}
      resolve({ ok: true, url: details.url, startUrl, navigated: details.url !== startUrl });
    };
    try {
      chrome.webNavigation.onCompleted.addListener(listener);
    } catch (e) {
      done = true;
      clearTimeout(timer);
      resolve({ ok: false, error: "webNavigation not available: " + String(e) });
    }
  });
}

/* ── coordClick ──
 * Real mouse event at (x, y) via chrome.debugger protocol. Useful for
 * canvas apps (Figma, Miro, games) that ignore synthetic DOM events.
 * Requires the optional `debugger` permission.
 */
async function bgCoordClick(args) {
  const opts = args || {};
  const x = opts.x;
  const y = opts.y;
  const button = opts.button || "left";
  const clickCount = opts.clickCount || 1;
  if (typeof x !== "number" || typeof y !== "number") {
    return { ok: false, error: "coordClick requires numeric x/y" };
  }
  const granted = await new Promise((res) => {
    chrome.permissions.contains({ permissions: ["debugger"] }, (ok) => res(!!ok));
  });
  if (!granted) {
    return {
      ok: false,
      error: "debugger_permission_required",
      hint: "Call chrome.permissions.request({permissions:['debugger']}) via the extension popup before running coordClick.",
    };
  }
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) return { ok: false, error: "No active tab" };
  const target = { tabId: tab.id };

  if (!bridgeState.debuggerAttached.has(tab.id)) {
    await new Promise((res, rej) => {
      chrome.debugger.attach(target, "1.3", () => {
        if (chrome.runtime.lastError) rej(new Error(chrome.runtime.lastError.message));
        else res();
      });
    });
    bridgeState.debuggerAttached.add(tab.id);
  }

  const btn = button === "right" ? "right" : button === "middle" ? "middle" : "left";
  try {
    await sendDebugger(target, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
    await sendDebugger(target, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: btn, clickCount });
    await sendDebugger(target, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: btn, clickCount });
    return { ok: true, x, y, button: btn };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function sendDebugger(target, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params, (result) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(result);
    });
  });
}

// Detach debugger when the user manually closes DevTools or we lose a tab.
try {
  chrome.debugger.onDetach.addListener((source) => {
    if (source && typeof source.tabId === "number") {
      bridgeState.debuggerAttached.delete(source.tabId);
    }
  });
} catch (_) { /* not available in some test contexts */ }

/* ── Active-tab message helper ──
 * Supports an optional frameId so the bridge can route commands into a
 * specific (potentially cross-origin) nested frame instead of the top
 * frame. chrome.tabs.sendMessage's `frameId` option delivers only to
 * that frame's content scripts.
 */
function sendToActiveTab(message, frameId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab) return reject(new Error("No active tab"));
      const cb = (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(res);
      };
      if (typeof frameId === "number") {
        chrome.tabs.sendMessage(tab.id, message, { frameId }, cb);
      } else {
        chrome.tabs.sendMessage(tab.id, message, cb);
      }
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
  // v2 helpers exported so popup / tests can exercise them without a
  // long-poll round trip.
  _handleServerCommand: handleServerCommand,
  _checkRateLimit: checkRateLimit,
  _checkHostPolicy: checkHostPolicy,
};
