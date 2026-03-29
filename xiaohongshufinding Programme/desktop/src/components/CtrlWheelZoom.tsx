import { useEffect } from "react";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const STEP = 0.1;
const CSS_ZOOM_KEY = "appZoomFactorCss";

/**
 * Ctrl + 滚轮（macOS 上为 Cmd + 滚轮）缩放页面内容。
 * Electron 下与主进程 webContents 缩放一致，菜单「视图 → 放大/缩小/实际大小」仍可用。
 */
export function CtrlWheelZoom() {
  useEffect(() => {
    const api = window.electronAPI;

    if (!api?.adjustZoomDelta) {
      const saved = sessionStorage.getItem(CSS_ZOOM_KEY);
      if (saved) {
        const z = parseFloat(saved);
        if (!Number.isNaN(z) && z >= ZOOM_MIN && z <= ZOOM_MAX) {
          document.documentElement.style.zoom = String(z);
        }
      }
    }

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? STEP : -STEP;

      if (api?.adjustZoomDelta) {
        void api.adjustZoomDelta(delta);
      } else {
        const html = document.documentElement;
        const cur =
          parseFloat((html.style.zoom || "1").replace(",", ".")) || 1;
        const next = Math.min(
          ZOOM_MAX,
          Math.max(ZOOM_MIN, Math.round((cur + delta) * 100) / 100)
        );
        html.style.zoom = String(next);
        sessionStorage.setItem(CSS_ZOOM_KEY, String(next));
      }
    };

    document.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () =>
      document.removeEventListener("wheel", onWheel, { capture: true });
  }, []);

  return null;
}
