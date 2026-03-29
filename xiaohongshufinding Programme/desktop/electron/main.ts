import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import path from "path";
import { PythonManager } from "./python-manager";

let mainWindow: BrowserWindow | null = null;
const pythonManager = new PythonManager();

function setupZhMenu() {
  const isMac = process.platform === "darwin";
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about", label: `关于 ${app.name}` },
              { type: "separator" },
              { role: "services", label: "服务" },
              { type: "separator" },
              { role: "hide", label: "隐藏" },
              { role: "hideOthers", label: "隐藏其他" },
              { role: "unhide", label: "显示全部" },
              { type: "separator" },
              { role: "quit", label: "退出" },
            ],
          } as Electron.MenuItemConstructorOptions,
        ]
      : []),
    {
      label: "文件",
      submenu: isMac
        ? [{ role: "close" as const, label: "关闭窗口" }]
        : [
            { role: "close" as const, label: "关闭窗口" },
            { type: "separator" },
            { role: "quit" as const, label: "退出" },
          ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "视图",
      submenu: [
        { role: "reload", label: "重新加载" },
        { role: "forceReload", label: "强制重新加载" },
        { role: "toggleDevTools", label: "开发者工具" },
        { type: "separator" },
        { role: "resetZoom", label: "实际大小" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
        { type: "separator" },
        { role: "togglefullscreen", label: "全屏" },
      ],
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize", label: "最小化" },
        ...(isMac
          ? [
              { role: "zoom", label: "缩放" },
              { type: "separator" },
              { role: "front", label: "前置全部窗口" },
            ]
          : []),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "RedBook Desktop",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  setupZhMenu();
  await pythonManager.start();

  ipcMain.handle("get-api-base", () => pythonManager.getApiBase());
  ipcMain.handle("get-python-status", () => pythonManager.isRunning());
  ipcMain.handle("adjust-zoom-delta", (_event, delta: number) => {
    const contents = mainWindow?.webContents;
    if (!contents) return 1;
    const d = Number(delta);
    if (!Number.isFinite(d)) return contents.getZoomFactor();
    const cur = contents.getZoomFactor();
    const next = Math.min(2, Math.max(0.5, Math.round((cur + d) * 100) / 100));
    contents.setZoomFactor(next);
    return next;
  });

  ipcMain.handle("select-history-directory", async () => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
    const r = await dialog.showOpenDialog(win ?? undefined, {
      properties: ["openDirectory", "createDirectory"],
      title: "选择历史记录保存文件夹",
    });
    if (r.canceled || r.filePaths.length === 0) return null;
    return r.filePaths[0];
  });

  ipcMain.handle("shell-open-path", async (_event, targetPath: string) => {
    if (!targetPath || typeof targetPath !== "string") return;
    await shell.openPath(targetPath);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  await pythonManager.stop();
});
