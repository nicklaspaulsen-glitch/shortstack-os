// ShortStack OS — Custom Protocol Handler
//
// Registers `shortstack://` as an OS-level URL scheme. Clicking a link like
// `shortstack://client/abc123` anywhere on the desktop (emails, Slack,
// browser bookmarks) opens the app and navigates the main window to the
// matching dashboard route.
//
// This is a sharp desktop-only feature: the web dashboard has no URL scheme
// of its own, and you can't register one from a regular web page. The
// browser can only launch *us* once we're the registered handler.
//
// Deep-link payloads we currently handle:
//   shortstack://client/<id>         → /dashboard/clients/<id>
//   shortstack://lead/<id>           → /dashboard/leads/<id>
//   shortstack://campaign/<id>       → /dashboard/campaigns/<id>
//   shortstack://agent/<prompt>      → /dashboard/agent?q=<prompt>
//   shortstack://open/<path>         → /<path>  (generic escape hatch)
//
// Anything else is logged and dropped.

const { app, ipcMain } = require("electron");
const path = require("path");

const SCHEME = "shortstack";
let ctx = null;
let pendingDeepLink = null;

function register() {
  try {
    if (process.defaultApp) {
      // Dev mode: the launcher runs `electron .` — argv[1] is the app path.
      // We need to tell the OS how to re-launch us cleanly when the
      // protocol is invoked from outside.
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(SCHEME, process.execPath, [path.resolve(process.argv[1])]);
      }
    } else {
      app.setAsDefaultProtocolClient(SCHEME);
    }
    return true;
  } catch (err) {
    console.warn("[shortstack] protocol registration failed:", err?.message);
    return false;
  }
}

/** Map a shortstack://... URL into a dashboard path. */
function urlToRoute(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== SCHEME + ":") return null;
    const host = u.hostname || "";
    // pathname comes through as "/id" — strip the leading slash
    const rest = (u.pathname || "").replace(/^\/+/, "");
    const qs = u.search || "";

    switch (host) {
      case "client":
        return `/dashboard/clients/${encodeURIComponent(rest)}${qs}`;
      case "lead":
        return `/dashboard/leads/${encodeURIComponent(rest)}${qs}`;
      case "campaign":
        return `/dashboard/campaigns/${encodeURIComponent(rest)}${qs}`;
      case "agent":
        return `/dashboard/agent?q=${encodeURIComponent(rest)}${qs ? "&" + qs.slice(1) : ""}`;
      case "open":
        return "/" + rest.replace(/^\/+/, "") + qs;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function navigateTo(route) {
  if (!route) return false;
  const mw = ctx?.getMainWindow?.();
  const appUrl = ctx?.appUrl || "";
  const fullUrl = appUrl + route;

  if (mw && !mw.isDestroyed()) {
    if (mw.isMinimized()) mw.restore();
    mw.show();
    mw.focus();
    mw.loadURL(fullUrl);
    return true;
  }

  // Main window not yet open — stash the intent. When the renderer signals
  // ready (via desktop:consume-deep-link), we hand it back.
  pendingDeepLink = { route, fullUrl, at: new Date().toISOString() };
  return false;
}

/**
 * Pull a URL off an argv array. Windows passes the protocol URL as a CLI
 * argument to a fresh app instance; the `second-instance` handler in
 * main.js catches these and routes them here.
 */
function argvToUrl(argv) {
  if (!Array.isArray(argv)) return null;
  return argv.find(a => typeof a === "string" && a.startsWith(SCHEME + "://")) || null;
}

function install(context) {
  ctx = context || {};

  const ok = register();

  // macOS: the OS fires the `open-url` event on first and subsequent launches.
  app.on("open-url", (event, url) => {
    event.preventDefault();
    const route = urlToRoute(url);
    navigateTo(route);
  });

  // Windows / Linux: the protocol launch shows up as an extra argv on either
  // a fresh process or a second-instance event. We subscribe to both.
  app.on("second-instance", (_e, argv) => {
    const url = argvToUrl(argv);
    if (!url) return;
    const route = urlToRoute(url);
    navigateTo(route);
  });

  // If THIS process was launched via the protocol, the URL is already in
  // our argv — handle it once the first main window is up.
  const initialUrl = argvToUrl(process.argv);
  if (initialUrl) {
    const route = urlToRoute(initialUrl);
    if (route) pendingDeepLink = { route, fullUrl: (ctx.appUrl || "") + route, at: new Date().toISOString() };
  }

  // Renderer can drain any pending link on mount.
  ipcMain.handle("desktop:consume-deep-link", () => {
    const out = pendingDeepLink;
    pendingDeepLink = null;
    return out;
  });

  // Debugging helper — lets the renderer synthesize a deep link.
  ipcMain.handle("desktop:open-deep-link", (_e, url) => {
    const route = urlToRoute(url);
    const handled = navigateTo(route);
    return { ok: handled, route };
  });

  return { ok, scheme: SCHEME, registered: ok };
}

module.exports = {
  install,
  urlToRoute,
  argvToUrl,
  SCHEME,
};
