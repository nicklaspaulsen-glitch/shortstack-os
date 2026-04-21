// ShortStack OS — Desktop-Only Features Orchestrator
//
// Single entry point. `require('./desktop-features')(context)` installs all
// modules and returns a summary. Order matters: notifications must install
// before tray-enhancer (which wraps notify() to auto-bump the unread count).
//
// This module is ADDITIVE. It does not modify the existing main.js flow —
// it layers capabilities on top. Disable any feature by flipping a flag in
// context.features.

const hotkeys = require("./hotkeys");
const notifications = require("./notifications");
const trayEnhancer = require("./tray-enhancer");
const watchers = require("./watchers");
const protocol = require("./protocol");
const screenRecorder = require("./screen-recorder");

/**
 * Install all desktop-only features.
 *
 * @param {object} context
 * @param {() => Electron.BrowserWindow|null} context.getMainWindow
 * @param {() => Electron.BrowserWindow|null} context.getAgentWindow
 * @param {() => void} context.createAgentWindow
 * @param {() => void} context.createMainWindow
 * @param {() => object|null} context.getLicense
 * @param {string} context.appUrl
 * @param {string} context.version
 * @param {Electron.Tray|null} [context.existingTray]  — tray created by main.js; will be destroyed
 * @param {object} [context.features]
 * @param {boolean} [context.features.hotkeys=true]
 * @param {boolean} [context.features.notifications=true]
 * @param {boolean} [context.features.tray=true]
 * @param {boolean} [context.features.watchers=true]
 * @param {boolean} [context.features.protocol=true]
 * @param {boolean} [context.features.screenRecorder=true]
 */
function install(context = {}) {
  const features = Object.assign({
    hotkeys: true,
    notifications: true,
    tray: true,
    watchers: true,
    protocol: true,
    screenRecorder: true,
  }, context.features || {});

  const results = {};

  // 1. Notifications first — other modules want to call notify(...)
  if (features.notifications) {
    try {
      results.notifications = notifications.install(context);
      // Wire a convenience notifier back onto the shared context so the
      // other modules don't have to know the implementation lives in
      // `./notifications`.
      context.notify = notifications.notify;
    } catch (err) {
      results.notifications = { ok: false, error: String(err?.message || err) };
    }
  }

  // 2. Tray enhancer — wraps notifications, so it comes after.
  if (features.tray) {
    try {
      results.tray = trayEnhancer.install(context);
    } catch (err) {
      results.tray = { ok: false, error: String(err?.message || err) };
    }
  }

  // 3. Global hotkeys — uses captureScreen which needs app to be ready.
  if (features.hotkeys) {
    try {
      context.hotkeys = hotkeys; // exposed to tray-enhancer's Quick Screenshot
      results.hotkeys = hotkeys.install(context);
    } catch (err) {
      results.hotkeys = { ok: false, error: String(err?.message || err) };
    }
  }

  // 4. Filesystem & clipboard watchers — independent.
  if (features.watchers) {
    try {
      results.watchers = watchers.install(context);
    } catch (err) {
      results.watchers = { ok: false, error: String(err?.message || err) };
    }
  }

  // 5. Protocol handler — can be called at any time, but must survive
  //    re-launch, so we register it eagerly.
  if (features.protocol) {
    try {
      results.protocol = protocol.install(context);
    } catch (err) {
      results.protocol = { ok: false, error: String(err?.message || err) };
    }
  }

  // 6. Screen recorder — registers its own global hotkey (Ctrl+Shift+R)
  //    and IPC surface. Hidden BrowserWindow handles MediaRecorder.
  if (features.screenRecorder) {
    try {
      results.screenRecorder = screenRecorder.install(context);
    } catch (err) {
      results.screenRecorder = { ok: false, error: String(err?.message || err) };
    }
  }

  // Single diagnostic IPC for the renderer to inspect what landed.
  try {
    const { ipcMain } = require("electron");
    ipcMain.handle("desktop:features-status", () => ({
      enabled: features,
      results,
      installedAt: new Date().toISOString(),
    }));
  } catch {}

  return results;
}

module.exports = {
  install,
  // Re-export modules for callers that want direct access
  hotkeys,
  notifications,
  trayEnhancer,
  watchers,
  protocol,
  screenRecorder,
};
