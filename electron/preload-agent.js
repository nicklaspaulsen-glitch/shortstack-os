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
