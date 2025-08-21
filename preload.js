const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("rpcApi", {
  loadConfig: () => ipcRenderer.invoke("load-config"),
  saveConfig: (cfg) => ipcRenderer.invoke("save-config", cfg),
  setPresence: (cfg) => ipcRenderer.invoke("set-presence", cfg),
  clearPresence: () => ipcRenderer.invoke("clear-presence"),
  onStatus: (cb) => ipcRenderer.on("status", (_e, data) => cb(data)),
})
