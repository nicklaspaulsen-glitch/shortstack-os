const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agent", {
  // Auth
  login: (email, password) => ipcRenderer.invoke("agent:login", email, password),
  logout: () => ipcRenderer.invoke("agent:logout"),
  getSession: () => ipcRenderer.invoke("agent:get-session"),

  // Chat
  chat: (message) => ipcRenderer.invoke("agent:chat", message),
  getWorkspace: () => ipcRenderer.invoke("agent:workspace"),
  onStream: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("agent:stream", handler);
    return () => ipcRenderer.removeListener("agent:stream", handler);
  },
  onToolExec: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("agent:tool-exec", handler);
    return () => ipcRenderer.removeListener("agent:tool-exec", handler);
  },

  // Workspace & Tasks
  syncWorkspace: () => ipcRenderer.invoke("agent:sync-workspace"),
  getTasks: () => ipcRenderer.invoke("agent:get-tasks"),
  completeTask: (taskId) => ipcRenderer.invoke("agent:complete-task", taskId),
});

// ── Native automation bridge (AI-assisted clicks / keyboard) ────
// This is a thin wrapper around the IPC handlers registered in
// electron/automation-handlers.js. If the native backend (nut-js /
// robotjs) isn't installed, every call returns { success: false, error }
// rather than throwing, so renderer code is always safe to invoke.
contextBridge.exposeInMainWorld("ssAutomation", {
  info: () => ipcRenderer.invoke("agent:automation-info"),
  click: (x, y, opts = {}) => ipcRenderer.invoke("agent:click", { x, y, ...opts }),
  type: (text, opts = {}) => ipcRenderer.invoke("agent:type", { text, ...opts }),
  keypress: (key, modifiers = []) =>
    ipcRenderer.invoke("agent:keypress", { key, modifiers }),
  screenshot: () => ipcRenderer.invoke("agent:screenshot"),
  cursorPos: () => ipcRenderer.invoke("agent:cursor-pos"),
  browserNavigate: (url) => ipcRenderer.invoke("agent:browser-navigate", { url }),
  onEmbeddedNavigate: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("embedded-browser:navigate", handler);
    return () => ipcRenderer.removeListener("embedded-browser:navigate", handler);
  },
});

// ── Desktop-only features bridge ────────────────────────────────
// Exposed to the Next.js dashboard running inside the Electron shell.
// Detect presence at runtime with `typeof window.ssDesktop !== 'undefined'`
// to branch between web and desktop UX — the web dashboard will have
// `ssDesktop === undefined`, the desktop shell will have the full API.
contextBridge.exposeInMainWorld("ssDesktop", {
  // ── Feature discovery ────────────────────────────────────────
  isDesktop: true,
  featuresStatus: () => ipcRenderer.invoke("desktop:features-status"),

  // ── Native notifications ─────────────────────────────────────
  // opts: { title, body, subtitle?, silent?, urgency?, onClickRoute?, meta? }
  notify: (opts) => ipcRenderer.invoke("desktop:notify", opts),
  // preset kinds: 'leadScraped', 'emailOpened', 'adAlert', 'agentReply'
  notifyPreset: (kind, payload) => ipcRenderer.invoke("desktop:notify-preset", kind, payload),
  notificationLog: () => ipcRenderer.invoke("desktop:notification-log"),

  // ── Tray control ─────────────────────────────────────────────
  setUnread: (count) => ipcRenderer.invoke("desktop:tray-set-unread", count),
  setCurrentClient: (label) => ipcRenderer.invoke("desktop:tray-set-client", label),

  // ── Watchers ─────────────────────────────────────────────────
  openDropbox: () => ipcRenderer.invoke("desktop:open-dropbox"),
  watchersStatus: () => ipcRenderer.invoke("desktop:watchers-status"),
  toggleWatcher: (which, value) => ipcRenderer.invoke("desktop:watchers-toggle", which, value),
  drainIntentQueue: () => ipcRenderer.invoke("desktop:drain-intent-queue"),

  // ── Protocol / deep links ────────────────────────────────────
  consumeDeepLink: () => ipcRenderer.invoke("desktop:consume-deep-link"),
  openDeepLink: (url) => ipcRenderer.invoke("desktop:open-deep-link", url),

  // ── Streams from the main process ────────────────────────────
  // fires when a hotkey screenshot / dropbox file / clipboard image arrives
  onAssetIntent: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("desktop:asset-intent", handler);
    return () => ipcRenderer.removeListener("desktop:asset-intent", handler);
  },
  // fires when the user saves a Quick Note via the hotkey popup
  onQuickNote: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("desktop:quick-note", handler);
    return () => ipcRenderer.removeListener("desktop:quick-note", handler);
  },
});
