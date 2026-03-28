export {};

declare global {
  interface Window {
    electronAPI?: {
      getApiBase: () => Promise<string>;
      getPythonStatus: () => Promise<boolean>;
    };
  }
}
