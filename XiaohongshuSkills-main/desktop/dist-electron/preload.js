"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  getApiBase: () => electron.ipcRenderer.invoke("get-api-base"),
  getPythonStatus: () => electron.ipcRenderer.invoke("get-python-status"),
  adjustZoomDelta: (delta) => electron.ipcRenderer.invoke("adjust-zoom-delta", delta)
});
