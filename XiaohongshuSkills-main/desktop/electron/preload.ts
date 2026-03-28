import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getApiBase: (): Promise<string> => ipcRenderer.invoke("get-api-base"),
  getPythonStatus: (): Promise<boolean> => ipcRenderer.invoke("get-python-status"),
});
