import { ChildProcess, spawn } from "child_process";
import path from "path";
import http from "http";

const API_HOST = "127.0.0.1";
const API_PORT = 8765;
const HEALTH_CHECK_INTERVAL = 5000;
const STARTUP_TIMEOUT = 15000;

export class PythonManager {
  private proc: ChildProcess | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private restarting = false;

  getApiBase(): string {
    return `http://${API_HOST}:${API_PORT}`;
  }

  private getScriptPath(): string {
    const repoRoot = path.resolve(__dirname, "../..");
    return path.join(repoRoot, "scripts", "serve_local_app.py");
  }

  private getPythonCmd(): string {
    return process.platform === "win32" ? "python" : "python3";
  }

  async start(): Promise<void> {
    if (this.proc && this.proc.exitCode === null) return;

    const scriptPath = this.getScriptPath();
    const env = {
      ...process.env,
      XHS_APP_HOST: API_HOST,
      XHS_APP_PORT: String(API_PORT),
      PYTHONIOENCODING: "utf-8",
    };

    console.log(`[python-manager] Starting: ${scriptPath}`);
    this.proc = spawn(this.getPythonCmd(), [scriptPath], {
      env,
      cwd: path.resolve(__dirname, "../.."),
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.proc.stdout?.on("data", (data: Buffer) => {
      console.log(`[python] ${data.toString().trim()}`);
    });
    this.proc.stderr?.on("data", (data: Buffer) => {
      console.error(`[python:err] ${data.toString().trim()}`);
    });
    this.proc.on("exit", (code) => {
      console.log(`[python-manager] Process exited with code ${code}`);
      if (!this.restarting) {
        setTimeout(() => this.start(), 2000);
      }
    });

    await this.waitForReady();
    this.startHealthCheck();
  }

  async stop(): Promise<void> {
    this.restarting = true;
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    if (this.proc && this.proc.exitCode === null) {
      this.proc.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          this.proc?.kill("SIGKILL");
          resolve();
        }, 3000);
        this.proc?.on("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    this.proc = null;
    this.restarting = false;
  }

  isRunning(): boolean {
    return this.proc !== null && this.proc.exitCode === null;
  }

  private async waitForReady(): Promise<void> {
    const deadline = Date.now() + STARTUP_TIMEOUT;
    while (Date.now() < deadline) {
      if (await this.healthCheck()) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    console.warn("[python-manager] Startup timeout - backend may not be ready");
  }

  private startHealthCheck(): void {
    this.healthTimer = setInterval(async () => {
      if (!(await this.healthCheck()) && !this.restarting) {
        console.warn("[python-manager] Health check failed, restarting...");
        await this.stop();
        await this.start();
      }
    }, HEALTH_CHECK_INTERVAL);
  }

  private healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(
        `http://${API_HOST}:${API_PORT}/api/health`,
        { timeout: 2000 },
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
