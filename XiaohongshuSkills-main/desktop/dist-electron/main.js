"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path = require("path");
const child_process = require("child_process");
const http = require("http");
const API_HOST = "127.0.0.1";
const API_PORT = 8765;
const HEALTH_CHECK_INTERVAL = 5e3;
const STARTUP_TIMEOUT = 15e3;
class PythonManager {
  constructor() {
    __publicField(this, "proc", null);
    __publicField(this, "healthTimer", null);
    __publicField(this, "restarting", false);
  }
  getApiBase() {
    return `http://${API_HOST}:${API_PORT}`;
  }
  getScriptPath() {
    const repoRoot = path.resolve(__dirname, "../..");
    return path.join(repoRoot, "scripts", "serve_local_app.py");
  }
  getPythonCmd() {
    return process.platform === "win32" ? "python" : "python3";
  }
  async start() {
    var _a, _b;
    if (this.proc && this.proc.exitCode === null) return;
    const scriptPath = this.getScriptPath();
    const env = {
      ...process.env,
      XHS_APP_HOST: API_HOST,
      XHS_APP_PORT: String(API_PORT),
      PYTHONIOENCODING: "utf-8"
    };
    console.log(`[python-manager] Starting: ${scriptPath}`);
    this.proc = child_process.spawn(this.getPythonCmd(), [scriptPath], {
      env,
      cwd: path.resolve(__dirname, "../.."),
      stdio: ["ignore", "pipe", "pipe"]
    });
    (_a = this.proc.stdout) == null ? void 0 : _a.on("data", (data) => {
      console.log(`[python] ${data.toString().trim()}`);
    });
    (_b = this.proc.stderr) == null ? void 0 : _b.on("data", (data) => {
      console.error(`[python:err] ${data.toString().trim()}`);
    });
    this.proc.on("exit", (code) => {
      console.log(`[python-manager] Process exited with code ${code}`);
      if (!this.restarting) {
        setTimeout(() => this.start(), 2e3);
      }
    });
    await this.waitForReady();
    this.startHealthCheck();
  }
  async stop() {
    this.restarting = true;
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    if (this.proc && this.proc.exitCode === null) {
      this.proc.kill("SIGTERM");
      await new Promise((resolve) => {
        var _a;
        const timer = setTimeout(() => {
          var _a2;
          (_a2 = this.proc) == null ? void 0 : _a2.kill("SIGKILL");
          resolve();
        }, 3e3);
        (_a = this.proc) == null ? void 0 : _a.on("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    this.proc = null;
    this.restarting = false;
  }
  isRunning() {
    return this.proc !== null && this.proc.exitCode === null;
  }
  async waitForReady() {
    const deadline = Date.now() + STARTUP_TIMEOUT;
    while (Date.now() < deadline) {
      if (await this.healthCheck()) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    console.warn("[python-manager] Startup timeout - backend may not be ready");
  }
  startHealthCheck() {
    this.healthTimer = setInterval(async () => {
      if (!await this.healthCheck() && !this.restarting) {
        console.warn("[python-manager] Health check failed, restarting...");
        await this.stop();
        await this.start();
      }
    }, HEALTH_CHECK_INTERVAL);
  }
  healthCheck() {
    return new Promise((resolve) => {
      const req = http.get(
        `http://${API_HOST}:${API_PORT}/api/health`,
        { timeout: 2e3 },
        (res) => resolve(res.statusCode === 200)
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
    });
  }
}
let mainWindow = null;
const pythonManager = new PythonManager();
function setupZhMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...isMac ? [
      {
        label: electron.app.name,
        submenu: [
          { role: "about", label: `关于 ${electron.app.name}` },
          { type: "separator" },
          { role: "services", label: "服务" },
          { type: "separator" },
          { role: "hide", label: "隐藏" },
          { role: "hideOthers", label: "隐藏其他" },
          { role: "unhide", label: "显示全部" },
          { type: "separator" },
          { role: "quit", label: "退出" }
        ]
      }
    ] : [],
    {
      label: "文件",
      submenu: isMac ? [{ role: "close", label: "关闭窗口" }] : [
        { role: "close", label: "关闭窗口" },
        { type: "separator" },
        { role: "quit", label: "退出" }
      ]
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
        { role: "selectAll", label: "全选" }
      ]
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
        { role: "togglefullscreen", label: "全屏" }
      ]
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize", label: "最小化" },
        ...isMac ? [
          { role: "zoom", label: "缩放" },
          { type: "separator" },
          { role: "front", label: "前置全部窗口" }
        ] : []
      ]
    }
  ];
  electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(template));
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "RedBook Desktop",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
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
electron.app.whenReady().then(async () => {
  setupZhMenu();
  await pythonManager.start();
  electron.ipcMain.handle("get-api-base", () => pythonManager.getApiBase());
  electron.ipcMain.handle("get-python-status", () => pythonManager.isRunning());
  electron.ipcMain.handle("adjust-zoom-delta", (_event, delta) => {
    const contents = mainWindow == null ? void 0 : mainWindow.webContents;
    if (!contents) return 1;
    const d = Number(delta);
    if (!Number.isFinite(d)) return contents.getZoomFactor();
    const cur = contents.getZoomFactor();
    const next = Math.min(2, Math.max(0.5, Math.round((cur + d) * 100) / 100));
    contents.setZoomFactor(next);
    return next;
  });
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("before-quit", async () => {
  await pythonManager.stop();
});
