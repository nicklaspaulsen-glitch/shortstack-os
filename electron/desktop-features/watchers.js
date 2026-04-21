// ShortStack OS — Filesystem & Clipboard Watchers
//
// Two desktop-only channels for fast client-asset capture:
//
//  1. **Dropbox folder.** We create `~/ShortStack/Dropbox/` and watch for
//     new files. Drop a video from OBS / a screenshot from ShareX / an
//     exported PSD and the app queues it for upload to the currently
//     selected client. No clicks, no drag-and-drop UI — just drop and
//     it's gone.
//
//  2. **Clipboard image watcher.** Polls the clipboard for image content
//     every 1.5s. When a new image lands (Shift+PrintScreen, Snipping
//     Tool, Greenshot, anything), we offer to attach it via a native
//     notification. Click the notification → it lands on the current
//     client's asset library.
//
// The web dashboard has *no* way to do this. Browsers can't watch the
// filesystem at all, and the Clipboard API only fires on user-activated
// paste events within a focused tab.

const { app, clipboard, Notification, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

let ctx = null;
let fsWatcher = null;
let clipboardTimer = null;
let lastClipboardHash = null;
let enabled = { dropbox: true, clipboard: true };

// ── Dropbox folder watcher ───────────────────────────────────────

function dropboxDir() {
  return path.join(os.homedir(), "ShortStack", "Dropbox");
}

function ensureDropbox() {
  const dir = dropboxDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
    // Write a README on first creation so the folder isn't mysterious.
    const readme = path.join(dir, "README.txt");
    if (!fs.existsSync(readme)) {
      fs.writeFileSync(readme,
        "Drop any file here and ShortStack OS will auto-upload it as an asset\n" +
        "for your currently selected client.\n\n" +
        "Works offline — files are queued and sent on next sync.\n"
      );
    }
  } catch (err) {
    console.warn("[shortstack] dropbox ensure failed:", err?.message);
  }
  return dir;
}

function dispatchAssetIntent(payload) {
  const mw = ctx?.getMainWindow?.();
  if (mw && !mw.isDestroyed()) {
    mw.webContents.send("desktop:asset-intent", payload);
    return true;
  }
  try {
    const queueFile = path.join(app.getPath("userData"), "desktop-intent-queue.json");
    let queue = [];
    if (fs.existsSync(queueFile)) {
      try { queue = JSON.parse(fs.readFileSync(queueFile, "utf8")); } catch {}
    }
    queue.push({ ...payload, queuedAt: new Date().toISOString() });
    fs.writeFileSync(queueFile, JSON.stringify(queue.slice(-100), null, 2));
  } catch {}
  return false;
}

function startDropboxWatcher() {
  const dir = ensureDropbox();
  try {
    // Recursive:true works on Win + macOS; Linux falls back to flat.
    fsWatcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
      if (!filename || eventType !== "rename") return;
      const full = path.join(dir, filename);
      // Ignore README / our own temp state
      if (path.basename(full).startsWith(".")) return;
      if (path.basename(full) === "README.txt") return;

      // File may still be writing — wait a short beat, then check size
      // stability so we don't upload a half-written MP4.
      setTimeout(() => {
        let size1 = -1, size2 = -2;
        try { size1 = fs.statSync(full).size; } catch { return; }
        setTimeout(() => {
          try { size2 = fs.statSync(full).size; } catch { return; }
          if (size1 !== size2 || size1 === 0) return;

          dispatchAssetIntent({
            kind: "dropbox-file",
            path: full,
            name: path.basename(full),
            size: size2,
            origin: "dropbox",
          });
          ctx?.notify?.({
            title: "Asset queued",
            body: `${path.basename(full)} queued for the current client.`,
            silent: true,
          });
        }, 400);
      }, 200);
    });

    fsWatcher.on("error", (err) => {
      console.warn("[shortstack] dropbox watcher error:", err?.message);
    });
  } catch (err) {
    console.warn("[shortstack] dropbox watcher failed to start:", err?.message);
    fsWatcher = null;
  }
}

function stopDropboxWatcher() {
  try { fsWatcher?.close(); } catch {}
  fsWatcher = null;
}

// ── Clipboard image watcher ──────────────────────────────────────

function hashBuffer(buf) {
  return crypto.createHash("md5").update(buf).digest("hex");
}

function tickClipboard() {
  if (!enabled.clipboard) return;
  try {
    const img = clipboard.readImage();
    if (!img || img.isEmpty()) return;
    const png = img.toPNG();
    if (!png || png.length < 1024) return; // ignore tiny / empty frames
    const h = hashBuffer(png);
    if (h === lastClipboardHash) return;
    lastClipboardHash = h;

    // Save a temp copy in userData so we have a stable path to hand off.
    const dir = path.join(app.getPath("userData"), "clipboard-captures");
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    const file = path.join(dir, `clip-${Date.now()}.png`);
    fs.writeFileSync(file, png);

    // Don't auto-upload (noisy) — offer via a notification.
    const n = new Notification({
      title: "Clipboard image detected",
      body: "Click to attach to the current client's library.",
      silent: true,
    });
    n.on("click", () => {
      dispatchAssetIntent({
        kind: "clipboard-image",
        path: file,
        size: png.length,
        origin: "clipboard",
      });
      const mw = ctx?.getMainWindow?.();
      if (mw && !mw.isDestroyed()) { mw.show(); mw.focus(); }
    });
    try { n.show(); } catch {}
  } catch (err) {
    // Silent fail — clipboard access can legitimately error on Wayland etc.
  }
}

function startClipboardWatcher() {
  if (clipboardTimer) return;
  // Prime the current clipboard so we don't immediately notify on startup.
  try {
    const img = clipboard.readImage();
    if (img && !img.isEmpty()) {
      const png = img.toPNG();
      if (png && png.length > 0) lastClipboardHash = hashBuffer(png);
    }
  } catch {}
  clipboardTimer = setInterval(tickClipboard, 1500);
}

function stopClipboardWatcher() {
  if (clipboardTimer) {
    clearInterval(clipboardTimer);
    clipboardTimer = null;
  }
}

// ── Public install API ───────────────────────────────────────────

function install(context) {
  ctx = context || {};

  if (enabled.dropbox) startDropboxWatcher();
  if (enabled.clipboard) startClipboardWatcher();

  ipcMain.handle("desktop:open-dropbox", () => {
    const dir = ensureDropbox();
    shell.openPath(dir).catch(() => {});
    return { ok: true, path: dir };
  });

  ipcMain.handle("desktop:watchers-status", () => ({
    dropbox: { enabled: enabled.dropbox && !!fsWatcher, path: dropboxDir() },
    clipboard: { enabled: enabled.clipboard && !!clipboardTimer },
  }));

  ipcMain.handle("desktop:watchers-toggle", (_e, which, value) => {
    if (which === "dropbox") {
      enabled.dropbox = !!value;
      if (enabled.dropbox) startDropboxWatcher(); else stopDropboxWatcher();
    }
    if (which === "clipboard") {
      enabled.clipboard = !!value;
      if (enabled.clipboard) startClipboardWatcher(); else stopClipboardWatcher();
    }
    return { ok: true };
  });

  ipcMain.handle("desktop:drain-intent-queue", () => {
    const queueFile = path.join(app.getPath("userData"), "desktop-intent-queue.json");
    try {
      if (!fs.existsSync(queueFile)) return [];
      const contents = JSON.parse(fs.readFileSync(queueFile, "utf8"));
      fs.writeFileSync(queueFile, "[]");
      return Array.isArray(contents) ? contents : [];
    } catch {
      return [];
    }
  });

  app.on("will-quit", () => {
    stopDropboxWatcher();
    stopClipboardWatcher();
  });

  return {
    dropbox: dropboxDir(),
    clipboardActive: !!clipboardTimer,
    fsActive: !!fsWatcher,
  };
}

module.exports = {
  install,
  dropboxDir,
  stopDropboxWatcher,
  stopClipboardWatcher,
};
