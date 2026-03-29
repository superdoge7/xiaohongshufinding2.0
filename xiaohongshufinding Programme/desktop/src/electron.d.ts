export {};

declare global {
  interface Window {
    electronAPI?: {
      getApiBase: () => Promise<string>;
      getPythonStatus: () => Promise<boolean>;
      /** 与 setZoomFactor 一致，delta 如 0.1 / -0.1 */
      adjustZoomDelta: (delta: number) => Promise<number>;
      selectHistoryDirectory: () => Promise<string | null>;
      shellOpenPath: (targetPath: string) => Promise<void>;
    };
  }
}
