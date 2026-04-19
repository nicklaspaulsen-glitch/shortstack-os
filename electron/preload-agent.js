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
