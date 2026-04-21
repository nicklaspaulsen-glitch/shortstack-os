// ShortStack OS — Global Hotkeys
//
// Desktop-only differentiator: system-wide shortcuts that work even when
// ShortStack is minimized / in the tray. Uses Electron's `globalShortcut`
// which registers with the OS keyboard subsystem (Win32 RegisterHotKey,
// macOS Event Tap, X11 XGrabKey).
//
// Shortcuts shipped:
//   Ctrl+Shift+S  → capture primary screen → push to current client as asset
//   Ctrl+Shift+N  → pop a floating quick-note window, saves to current client
//   Ctrl+Shift+T  → focus (or spawn) the Trinity / AI agent window
//
// Shortcut choice rationale: Ctrl+Shift+<X> avoids collisions with OS and
// most IDE / browser defaults on Windows and Linux. On macOS the
// accelerator is automatically remapped to Cmd+Shift+<X> by Electron.
//
// Web dashboard CAN'T do any of this — browsers deliberately sandbox away
// system-wide keyboard capture.

const { app, globalShortcut, BrowserWindow, Notification, screen, desktopCapturer, nativeImage, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

let ctx = null; // { getMainWindow, getAgentWindow, createAgentWindow, apiFetch, notify }
const registered = [];
let ipcBound = false;

function bindQuickNoteIpc() {
  if (ipcBound) return;
  ipcBound = true;
  // Forward the quick-note popup's save event to the main window so the
  // renderer can persist it via the existing notes API.
  ipcMain.on("desktop:quick-note", (_event, payload) => {
    const mw = ctx?.getMainWindow?.();
    if (mw && !mw.isDestroyed()) {
      mw.webContents.send("desktop:quick-note", payload);
    } else {
      // Queue: the renderer picks up queued intents via desktop:drain-intent-queue
      try {
        const queueFile = path.join(app.getPath("userData"), "desktop-note-queue.json");
        let queue = [];
        if (fs.existsSync(queueFile)) {
          try { queue = JSON.parse(fs.readFileSync(queueFile, "utf8")); } catch {}
        }
        queue.push(payload);
        fs.writeFileSync(queueFile, JSON.stringify(queue.slice(-50), null, 2));
      } catch {}
    }
  });
}

/**
 * Capture the primary display and save to disk. Returns the file path.
 * Uses desktopCapturer (no native deps, works offline).
 */
async function captureScreen() {
  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.size;
  const scale = primary.scaleFactor || 1;

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: Math.floor(width * scale), height: Math.floor(height * scale) },
  });

  const primarySource = sources.find(s => s.display_id === String(primary.id)) || sources[0];
  if (!primarySource) throw new Error("No screen source available");

  const png = primarySource.thumbnail.toPNG();
  const dir = path.join(app.getPath("userData"), "quick-captures");
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  const file = path.join(dir, `screen-${Date.now()}.png`);
  fs.writeFileSync(file, png);
  return { file, size: png.length };
}

/**
 * Send an asset upload intent to the renderer. The renderer picks it up,
 * resolves the "current client" (from route context / client switcher), and
 * POSTs to the existing /api/clients/:id/assets endpoint. If no main window
 * is present yet, we queue the intent on disk so the next launch picks up.
 */
function dispatchAssetIntent(payload) {
  const mw = ctx?.getMainWindow?.();
  if (mw && !mw.isDestroyed()) {
    mw.webContents.send("desktop:asset-intent", payload);
    return true;
  }
  // Queue to disk — renderer drains this on next ready-to-show
  try {
    const queueFile = path.join(app.getPath("userData"), "desktop-intent-queue.json");
    let queue = [];
    if (fs.existsSync(queueFile)) {
      try { queue = JSON.parse(fs.readFileSync(queueFile, "utf8")); } catch {}
    }
    queue.push({ ...payload, queuedAt: new Date().toISOString() });
    fs.writeFileSync(queueFile, JSON.stringify(queue.slice(-50), null, 2));
  } catch {}
  return false;
}

async function handleScreenshot() {
  try {
    const { file, size } = await captureScreen();
    dispatchAssetIntent({ kind: "screenshot", path: file, size, origin: "hotkey" });
    ctx?.notify?.({
      title: "Screenshot captured",
      body: `Saved ${(size / 1024).toFixed(0)} KB. Uploading to current client.`,
      silent: true,
    });
  } catch (err) {
    ctx?.notify?.({
      title: "Screenshot failed",
      body: String(err?.message || err),
    });
  }
}

function handleQuickNote() {
  // Lightweight borderless window — native, not a browser popup.
  const win = new BrowserWindow({
    width: 380,
    height: 260,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#0c1017",
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;font-family:Segoe UI,system-ui,sans-serif}
    body{background:#0c1017;color:#e2e8f0;display:flex;flex-direction:column;height:100vh;-webkit-app-region:drag;border:1px solid rgba(201,168,76,0.25);border-radius:10px}
    .hdr{padding:10px 14px;font-size:11px;letter-spacing:2px;color:#C9A84C;font-weight:600;border-bottom:1px solid #1e2a3a}
    textarea{flex:1;background:transparent;border:none;outline:none;color:#e2e8f0;padding:12px 14px;font-size:13px;resize:none;-webkit-app-region:no-drag;font-family:inherit}
    textarea::placeholder{color:#475569}
    .row{display:flex;gap:8px;padding:10px 14px;border-top:1px solid #1e2a3a;-webkit-app-region:no-drag}
    button{flex:1;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);color:#C9A84C;padding:7px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer}
    button.ghost{background:transparent;border-color:#1e2a3a;color:#64748b}
    button:hover{background:rgba(201,168,76,0.25)}
    .hint{font-size:9px;color:#475569;padding:0 14px 10px;letter-spacing:1px}
  </style>
  <body>
    <div class="hdr">QUICK NOTE</div>
    <textarea id="n" autofocus placeholder="Type a note for the current client..."></textarea>
    <div class="hint">Ctrl+Enter to save • Esc to cancel</div>
    <div class="row">
      <button class="ghost" onclick="window.close()">Cancel</button>
      <button onclick="save()">Save</button>
    </div>
    <script>
      const { ipcRenderer } = require('electron');
      function save(){
        const body = document.getElementById('n').value.trim();
        if(!body) { window.close(); return; }
        ipcRenderer.send('desktop:quick-note', { body, createdAt: new Date().toISOString() });
        window.close();
      }
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') window.close();
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
      });
      window.addEventListener('blur', () => setTimeout(() => window.close(), 150));
    </script>
  </body></html>`;

  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  win.once("ready-to-show", () => win.show());
}

function handleTrinityOpen() {
  const createAgent = ctx?.createAgentWindow;
  if (typeof createAgent === "function") {
    createAgent();
    return;
  }
  // Fallback: focus main window
  const mw = ctx?.getMainWindow?.();
  if (mw && !mw.isDestroyed()) {
    if (mw.isMinimized()) mw.restore();
    mw.show();
    mw.focus();
  }
}

/**
 * Register all global hotkeys. Failures are logged and silently swallowed
 * (e.g. another app already owns the same accelerator). Returns a summary
 * so the caller can surface the state in settings / diagnostics.
 */
function register() {
  const bindings = [
    { accel: "CommandOrControl+Shift+S", handler: handleScreenshot, label: "Screenshot" },
    { accel: "CommandOrControl+Shift+N", handler: handleQuickNote, label: "QuickNote" },
    { accel: "CommandOrControl+Shift+T", handler: handleTrinityOpen, label: "Trinity" },
  ];

  const summary = [];
  for (const b of bindings) {
    try {
      const ok = globalShortcut.register(b.accel, b.handler);
      summary.push({ ...b, registered: ok });
      if (ok) registered.push(b.accel);
    } catch (err) {
      summary.push({ ...b, registered: false, error: String(err?.message || err) });
    }
  }
  return summary;
}

function unregisterAll() {
  for (const accel of registered) {
    try { globalShortcut.unregister(accel); } catch {}
  }
  registered.length = 0;
}

/**
 * Wire up the hotkeys module. Called from main.js after app is ready.
 * `context` gives us handles back to window factories and notification helpers.
 */
function install(context) {
  ctx = context || {};
  bindQuickNoteIpc();
  const summary = register();
  app.on("will-quit", () => unregisterAll());
  return summary;
}

module.exports = {
  install,
  register,
  unregisterAll,
  captureScreen, // exported for reuse by the tray "Quick Screenshot" action
};
