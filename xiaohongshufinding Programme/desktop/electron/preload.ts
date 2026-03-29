import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getApiBase: (): Promise<string> => ipcRenderer.invoke("get-api-base"),
  getPythonStatus: (): Promise<boolean> => ipcRenderer.invoke("get-python-status"),
  adjustZoomDelta: (delta: number): Promise<number> =>
    ipcRenderer.invoke("adjust-zoom-delta", delta),
  selectHistoryDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke("select-history-directory"),
  shellOpenPath: (targetPath: string): Promise<void> =>
    ipcRenderer.invoke("shell-open-path", targetPath),
});
