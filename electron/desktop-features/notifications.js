// ShortStack OS — Native OS Notifications
//
// Uses Electron's `Notification` which wraps:
//   Windows  → Toast / Action Center (needs AppUserModelID)
//   macOS    → NSUserNotification / UNUserNotificationCenter
//   Linux    → libnotify / dbus
//
// Fires even when the main window is closed but the app is still running
// (minimized-to-tray). Web dashboard can only use Web Notifications, which
// require the tab to be open — this is fundamentally different UX.
//
// The renderer calls through `window.ssDesktop.notify(...)` (preload).
// Main-process code can call `notify(...)` directly.

const { app, Notification, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");

let ctx = null;
const deliveryLog = [];
const MAX_LOG = 200;

// Windows Action Center groups toasts by AppUserModelID. If this isn't set,
// they'll appear under a generic "electron.app" tile. We set it explicitly
// to match the build config's `appId`.
function applyAppIdentity() {
  try {
    if (process.platform === "win32") {
      app.setAppUserModelId("com.shortstack.os");
    }
  } catch {}
}

function iconPath() {
  try {
    const p = path.join(__dirname, "..", "..", "public", "icons", "shortstack-logo.png");
    if (fs.existsSync(p)) return p;
  } catch {}
  return undefined;
}

/**
 * Send a native OS notification.
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {string} [opts.subtitle]  — macOS only
 * @param {boolean} [opts.silent]
 * @param {string} [opts.urgency]   — "low"|"normal"|"critical" (Linux)
 * @param {object} [opts.meta]      — opaque app data, logged + passed to click handler
 * @param {string} [opts.onClickRoute] — dashboard route to open on click (e.g. "/dashboard/leads")
 */
function notify(opts = {}) {
  if (!Notification.isSupported()) return { ok: false, error: "not-supported" };
  const title = String(opts.title || "ShortStack OS");
  const body = String(opts.body || "");

  try {
    const n = new Notification({
      title,
      body,
      subtitle: opts.subtitle,
      silent: !!opts.silent,
      urgency: opts.urgency,
      icon: iconPath(),
      timeoutType: opts.timeoutType || "default",
    });

    n.on("click", () => {
      try {
        const mw = ctx?.getMainWindow?.();
        if (mw && !mw.isDestroyed()) {
          if (mw.isMinimized()) mw.restore();
          mw.show();
          mw.focus();
          if (opts.onClickRoute && typeof opts.onClickRoute === "string") {
            const base = ctx?.appUrl || "https://shortstack-os.vercel.app";
            mw.loadURL(base + opts.onClickRoute);
          }
        } else if (opts.onClickRoute && ctx?.appUrl) {
          // No main window — open in OS default browser
          shell.openExternal(ctx.appUrl + opts.onClickRoute);
        }
      } catch {}
    });

    n.show();

    deliveryLog.unshift({
      title, body, at: new Date().toISOString(),
      meta: opts.meta || null,
    });
    if (deliveryLog.length > MAX_LOG) deliveryLog.length = MAX_LOG;

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

// ── Pre-baked notification kinds. The renderer / main-process polling loops
// call these with a specific payload instead of re-implementing title-body.
// This keeps phrasing consistent across the app and makes it trivial to
// add localization later.
const presets = {
  leadScraped: ({ count, source }) => notify({
    title: "New leads captured",
    body: `${count} new lead${count === 1 ? "" : "s"} from ${source || "Lead Engine"}.`,
    onClickRoute: "/dashboard/leads",
    meta: { kind: "lead-scraped", count, source },
  }),
  emailOpened: ({ recipient, subject }) => notify({
    title: "Email opened",
    body: `${recipient || "A recipient"} opened "${subject || "your email"}".`,
    silent: true,
    onClickRoute: "/dashboard/outreach",
    meta: { kind: "email-opened", recipient, subject },
  }),
  adAlert: ({ campaign, message }) => notify({
    title: `Ad alert — ${campaign || "campaign"}`,
    body: String(message || "Campaign needs attention."),
    urgency: "critical",
    onClickRoute: "/dashboard/ads-manager",
    meta: { kind: "ad-alert", campaign, message },
  }),
  agentReply: ({ snippet }) => notify({
    title: "Trinity replied",
    body: String(snippet || "Your AI agent has an update for you.").slice(0, 160),
    onClickRoute: "/dashboard/agent",
    meta: { kind: "agent-reply" },
  }),
};

function install(context) {
  ctx = context || {};
  applyAppIdentity();

  // Expose a generic notify IPC for the renderer. All web pages running inside
  // the shell can fire OS notifications even when the tab is not focused.
  ipcMain.handle("desktop:notify", (_event, opts) => notify(opts || {}));
  ipcMain.handle("desktop:notify-preset", (_event, kind, payload) => {
    const fn = presets[kind];
    if (typeof fn !== "function") return { ok: false, error: "unknown-preset" };
    return fn(payload || {});
  });
  ipcMain.handle("desktop:notification-log", () => deliveryLog.slice(0, 50));

  return { supported: Notification.isSupported() };
}

module.exports = { install, notify, presets };
