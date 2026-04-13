const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agent", {
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
});
