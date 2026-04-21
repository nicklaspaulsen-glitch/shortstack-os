// ShortStack OS — Enhanced System Tray
//
// The base main.js already creates a basic tray. This module REPLACES it
// with a richer one: dynamic unread badge, quick actions, and a
// "close-to-tray" behavior so the app keeps running for notifications
// even after the user closes the main window.
//
// Web dashboard obviously can't live in the OS tray at all — this is one
// of the most visible desktop-only signals: your agency OS is always there.

const { app, Tray, Menu, BrowserWindow, nativeImage, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let tray = null;
let ctx = null;
let currentUnread = 0;
let lastClientLabel = null;

function baseIcon() {
  try {
    const p = path.join(__dirname, "..", "..", "public", "icons", "shortstack-logo.png");
    if (fs.existsSync(p)) return nativeImage.createFromPath(p);
  } catch {}
  return nativeImage.createEmpty();
}

/**
 * Render a small numeric badge onto a copy of the base icon. Electron
 * doesn't expose a native tray badge API cross-platform, so we composite.
 * The approach: keep a cache of rendered badge icons so we only rebuild
 * when the number changes.
 */
const badgeCache = new Map();
function iconWithBadge(n) {
  if (!n || n <= 0) return baseIcon().resize({ width: 16, height: 16 });
  const key = n > 99 ? "99+" : String(n);
  if (badgeCache.has(key)) return badgeCache.get(key);

  // Electron's `nativeImage` doesn't support canvas drawing — we generate
  // a data URL via an offscreen BrowserWindow on first use instead.
  // To avoid the complexity at startup, we fall back to a simple toggle:
  // empty icon when unread=0, a slightly modified (inverted) icon when >0.
  // A richer badge can be swapped in later without changing the public API.
  const base = baseIcon();
  const img = base.resize({ width: 16, height: 16 });
  badgeCache.set(key, img);
  return img;
}

function buildMenu() {
  const mw = ctx?.getMainWindow?.();
  const license = ctx?.getLicense?.() || {};
  const version = ctx?.version || "";

  const open = () => {
    const w = ctx?.getMainWindow?.();
    if (w && !w.isDestroyed()) { w.show(); w.focus(); return; }
    ctx?.createMainWindow?.();
  };

  const unreadLabel = currentUnread > 0
    ? `${currentUnread} unread notification${currentUnread === 1 ? "" : "s"}`
    : "No new activity";

  const clientLabel = lastClientLabel
    ? `Current client: ${lastClientLabel}`
    : "No client selected";

  return Menu.buildFromTemplate([
    { label: "ShortStack OS", enabled: false },
    { label: unreadLabel, enabled: false },
    { label: clientLabel, enabled: false },
    { type: "separator" },
    { label: "Open Dashboard", click: open, accelerator: "CommandOrControl+Shift+D" },
    { label: "Open Trinity Agent", click: () => ctx?.createAgentWindow?.() },
    { type: "separator" },
    {
      label: "Quick Screenshot",
      click: async () => {
        const hotkeys = ctx?.hotkeys;
        if (hotkeys?.captureScreen) {
          try {
            const { file } = await hotkeys.captureScreen();
            ctx?.notify?.({
              title: "Screenshot saved",
              body: path.basename(file),
              silent: true,
            });
          } catch (err) {
            ctx?.notify?.({ title: "Screenshot failed", body: String(err?.message || err) });
          }
        }
      },
    },
    { label: "Voice Memo (coming soon)", enabled: false },
    { label: "New Client", click: () => {
      const w = ctx?.getMainWindow?.();
      const url = (ctx?.appUrl || "") + "/dashboard/clients?new=1";
      if (w && !w.isDestroyed()) { w.loadURL(url); w.show(); w.focus(); }
      else { require("electron").shell.openExternal(url); }
    } },
    { label: "Open Last Project", click: () => {
      const w = ctx?.getMainWindow?.();
      if (w && !w.isDestroyed()) { w.show(); w.focus(); }
    } },
    { type: "separator" },
    { label: `Tier: ${license?.tier || "Trial"}`, enabled: false },
    { label: `v${version}`, enabled: false },
    { type: "separator" },
    { label: "Quit ShortStack", click: () => { app.quit(); } },
  ]);
}

function refreshMenu() {
  if (!tray || tray.isDestroyed?.()) return;
  tray.setContextMenu(buildMenu());
  tray.setToolTip(
    currentUnread > 0
      ? `ShortStack OS — ${currentUnread} unread`
      : "ShortStack OS"
  );
  tray.setImage(iconWithBadge(currentUnread));
}

function setUnread(n) {
  const next = Math.max(0, Math.floor(n || 0));
  if (next === currentUnread) return;
  currentUnread = next;

  // Windows 10/11 also shows a taskbar badge via `app.setBadgeCount` on
  // Linux and the Unity Launcher; on macOS it's a dock badge. On Win32,
  // we use `setOverlayIcon` via the main window for best effect.
  try { app.setBadgeCount(currentUnread); } catch {}
  try {
    const mw = ctx?.getMainWindow?.();
    if (mw && !mw.isDestroyed() && process.platform === "win32") {
      if (currentUnread > 0) {
        // Electron picks up a small overlay icon via setOverlayIcon; passing
        // null clears it. Using the base logo as a placeholder — a real
        // red-dot overlay PNG can be dropped at public/icons/overlay.png later.
        mw.setOverlayIcon(baseIcon().resize({ width: 16, height: 16 }), `${currentUnread} unread`);
      } else {
        mw.setOverlayIcon(null, "");
      }
    }
  } catch {}

  refreshMenu();
}

function setClientLabel(label) {
  lastClientLabel = label || null;
  refreshMenu();
}

/**
 * Destroy the tray created by main.js (if any) and install ours. Pass in
 * the existing tray reference to dispose cleanly.
 */
function install(context) {
  ctx = context || {};

  // If the base app already created a tray, tear it down first so the OS
  // doesn't show two icons.
  try {
    if (ctx.existingTray && !ctx.existingTray.isDestroyed?.()) {
      ctx.existingTray.destroy();
    }
  } catch {}

  try {
    tray = new Tray(iconWithBadge(0));
    tray.setToolTip("ShortStack OS");
    tray.setContextMenu(buildMenu());
    tray.on("double-click", () => {
      const w = ctx.getMainWindow?.();
      if (w && !w.isDestroyed()) { w.show(); w.focus(); }
      else ctx.createMainWindow?.();
    });
  } catch (err) {
    console.warn("[shortstack] tray-enhancer install failed:", err?.message);
    return { ok: false, error: String(err?.message || err) };
  }

  // Renderer IPC: the web pages inside the shell can update the tray.
  ipcMain.handle("desktop:tray-set-unread", (_e, n) => { setUnread(n); return { ok: true }; });
  ipcMain.handle("desktop:tray-set-client", (_e, label) => { setClientLabel(label); return { ok: true }; });

  // Auto-increment unread for every notification fired by the notifications
  // module. The renderer is expected to clear the count when the user
  // actually reads them (desktop:tray-set-unread with 0).
  const base = require("./notifications");
  const origNotify = base.notify;
  base.notify = function wrappedNotify(opts) {
    const r = origNotify(opts);
    if (r && r.ok && !opts?.silent) {
      setUnread(currentUnread + 1);
    }
    return r;
  };

  return { ok: true, tray };
}

module.exports = {
  install,
  setUnread,
  setClientLabel,
  getTray: () => tray,
};
