import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { api } from "@/services/api";
import {
  buildSessionSnapshot,
  applySessionSnapshot,
  type SessionSnapshotInput,
} from "@/store/sessionSnapshot";
import type {
  AiWorkbenchStep,
  ReportData,
  ReportHistoryItem,
} from "@/store/types";

export type {
  AiWorkbenchStep,
  ReportData,
  ReportHistoryItem,
  ReportVisuals,
} from "@/store/types";

interface AppState {
  backendOk: boolean | null;
  chromeOk: boolean | null;
  loggedIn: boolean | null;
  activeBrowser: string | null;
  searchKeyword: string;
  searchFeeds: Array<Record<string, unknown>>;
  searchRecommended: string[];
  aiInput: string;
  aiSelectedPreset: string;
  aiMinCount: number;
  aiAnalyzeMaxFeeds: number;
  aiLoading: boolean;
  aiStep: AiWorkbenchStep;
  aiFeeds: Array<Record<string, unknown>>;
  aiResults: Array<Record<string, unknown>>;
  aiSummary: string;
  aiFilteredByBlock: number | null;
  aiError: string;
  reportKeyword: string;
  reportMinCount: number;
  reportMaxFeeds: number;
  reportWithIllustrations: boolean;
  reportLoading: boolean;
  reportError: string;
  report: ReportData | null;
  reportFeeds: Array<Record<string, unknown>>;
  reportHistory: ReportHistoryItem[];
}

interface AppContextType extends AppState {
  refreshStatus: () => Promise<void>;
  setSearchResults: (
    kw: string,
    feeds: Array<Record<string, unknown>>,
    recommended: string[]
  ) => void;
  clearSearch: () => void;
  setAiInput: (v: string) => void;
  setAiSelectedPreset: (v: string) => void;
  setAiMinCount: (v: number) => void;
  setAiAnalyzeMaxFeeds: (v: number) => void;
  runAiAnalysis: () => Promise<void>;
  setReportKeyword: (v: string) => void;
  setReportMinCount: (v: number) => void;
  setReportMaxFeeds: (v: number) => void;
  setReportWithIllustrations: (v: boolean) => void;
  runGenerateReport: () => Promise<void>;
  selectReportHistory: (item: ReportHistoryItem) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    backendOk: null,
    chromeOk: null,
    loggedIn: null,
    activeBrowser: null,
    searchKeyword: "",
    searchFeeds: [],
    searchRecommended: [],
    aiInput: "",
    aiSelectedPreset: "quality",
    aiMinCount: 50,
    aiAnalyzeMaxFeeds: 10,
    aiLoading: false,
    aiStep: "idle",
    aiFeeds: [],
    aiResults: [],
    aiSummary: "",
    aiFilteredByBlock: null,
    aiError: "",
    reportKeyword: "",
    reportMinCount: 50,
    reportMaxFeeds: 15,
    reportWithIllustrations: true,
    reportLoading: false,
    reportError: "",
    report: null,
    reportFeeds: [],
    reportHistory: [],
  });

  const refreshingRef = useRef(false);
  const lastRefreshRef = useRef(0);
  const aiRunningRef = useRef(false);
  const aiParamsRef = useRef({
    input: "",
    minCount: 50,
    preset: "quality",
    analyzeMaxFeeds: 10,
  });
  const reportRunningRef = useRef(false);
  const reportParamsRef = useRef({
    keyword: "",
    minCount: 50,
    maxFeeds: 15,
    withIllustrations: true,
  });

  const persistSliceFromState = useCallback((s: AppState): SessionSnapshotInput => {
    return {
      searchKeyword: s.searchKeyword,
      searchFeeds: s.searchFeeds,
      searchRecommended: s.searchRecommended,
      reportHistory: s.reportHistory,
      report: s.report,
      reportKeyword: s.reportKeyword,
      reportFeeds: s.reportFeeds,
      reportMinCount: s.reportMinCount,
      reportMaxFeeds: s.reportMaxFeeds,
      reportWithIllustrations: s.reportWithIllustrations,
      aiInput: s.aiInput,
      aiSelectedPreset: s.aiSelectedPreset,
      aiMinCount: s.aiMinCount,
      aiAnalyzeMaxFeeds: s.aiAnalyzeMaxFeeds,
      aiFeeds: s.aiFeeds,
      aiResults: s.aiResults,
      aiSummary: s.aiSummary,
      aiFilteredByBlock: s.aiFilteredByBlock,
      aiStep: s.aiStep,
      aiError: s.aiError,
    };
  }, []);

  const [sessionHydrated, setSessionHydrated] = useState(false);
  const lastPersistedJson = useRef("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await api.health();
        const res = await api.desktop.session.get();
        if (cancelled) return;
        if (res.snapshot) {
          const partial = applySessionSnapshot(res.snapshot);
          if (partial) {
            setState((s) => {
              const next = { ...s, ...partial };
              lastPersistedJson.current = JSON.stringify(
                buildSessionSnapshot(persistSliceFromState(next))
              );
              return next;
            });
          }
        }
      } catch {
        /* 后端未启动时跳过恢复 */
      }
      if (!cancelled) {
        window.setTimeout(() => {
          if (!cancelled) setSessionHydrated(true);
        }, 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persistSliceFromState]);

  useEffect(() => {
    const reload = () => {
      void (async () => {
        try {
          const res = await api.desktop.session.get();
          if (!res.snapshot) {
            lastPersistedJson.current = "";
            return;
          }
          const partial = applySessionSnapshot(res.snapshot);
          if (!partial) return;
          setState((s) => {
            const next = { ...s, ...partial };
            lastPersistedJson.current = JSON.stringify(
              buildSessionSnapshot(persistSliceFromState(next))
            );
            return next;
          });
        } catch {
          /* ignore */
        }
      })();
    };
    window.addEventListener("redbook-reload-session", reload);
    return () => window.removeEventListener("redbook-reload-session", reload);
  }, [persistSliceFromState]);

  useEffect(() => {
    if (!sessionHydrated) return;
    const snap = buildSessionSnapshot(persistSliceFromState(state));
    const serialized = JSON.stringify(snap);
    if (serialized === lastPersistedJson.current) return;
    const t = window.setTimeout(() => {
      void api.desktop.session.save(snap).then(() => {
        lastPersistedJson.current = serialized;
      }).catch(() => {});
    }, 1200);
    return () => window.clearTimeout(t);
  }, [state, sessionHydrated, persistSliceFromState]);

  useEffect(() => {
    aiParamsRef.current = {
      input: state.aiInput,
      minCount: state.aiMinCount,
      preset: state.aiSelectedPreset,
      analyzeMaxFeeds: state.aiAnalyzeMaxFeeds,
    };
  }, [
    state.aiInput,
    state.aiMinCount,
    state.aiSelectedPreset,
    state.aiAnalyzeMaxFeeds,
  ]);

  useEffect(() => {
    reportParamsRef.current = {
      keyword: state.reportKeyword,
      minCount: state.reportMinCount,
      maxFeeds: state.reportMaxFeeds,
      withIllustrations: state.reportWithIllustrations,
    };
  }, [
    state.reportKeyword,
    state.reportMinCount,
    state.reportMaxFeeds,
    state.reportWithIllustrations,
  ]);

  const refreshStatus = useCallback(async () => {
    const now = Date.now();
    if (refreshingRef.current || now - lastRefreshRef.current < 3000) return;
    refreshingRef.current = true;
    lastRefreshRef.current = now;

    try {
      await api.health();
      setState((s) => ({ ...s, backendOk: true }));

      const [chromeRes, loginRes] = await Promise.allSettled([
        api.chromeStatus(),
        api.loginCheck(),
      ]);

      setState((s) => ({
        ...s,
        chromeOk:
          chromeRes.status === "fulfilled" ? chromeRes.value.running : false,
        activeBrowser:
          chromeRes.status === "fulfilled"
            ? chromeRes.value.browser ?? null
            : null,
        loggedIn:
          loginRes.status === "fulfilled"
            ? loginRes.value.logged_in
            : false,
      }));
    } catch {
      setState((s) => ({
        ...s,
        backendOk: false,
        chromeOk: false,
        loggedIn: false,
      }));
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  const setSearchResults = useCallback(
    (
      kw: string,
      feeds: Array<Record<string, unknown>>,
      recommended: string[]
    ) => {
      setState((s) => ({
        ...s,
        searchKeyword: kw,
        searchFeeds: feeds,
        searchRecommended: recommended,
      }));
    },
    []
  );

  const clearSearch = useCallback(() => {
    setState((s) => ({
      ...s,
      searchKeyword: "",
      searchFeeds: [],
      searchRecommended: [],
    }));
  }, []);

  const setAiInput = useCallback((v: string) => {
    setState((s) => ({ ...s, aiInput: v }));
  }, []);

  const setAiSelectedPreset = useCallback((v: string) => {
    setState((s) => ({ ...s, aiSelectedPreset: v }));
  }, []);

  const setAiMinCount = useCallback((v: number) => {
    setState((s) => ({ ...s, aiMinCount: v }));
  }, []);

  const setAiAnalyzeMaxFeeds = useCallback((v: number) => {
    const n = Math.min(50, Math.max(1, Math.round(v)));
    setState((s) => ({ ...s, aiAnalyzeMaxFeeds: n }));
  }, []);

  const runAiAnalysis = useCallback(async () => {
    const { input, minCount, preset, analyzeMaxFeeds } = aiParamsRef.current;
    const q = input.trim();
    if (!q || aiRunningRef.current) return;

    aiRunningRef.current = true;
    setState((s) => ({
      ...s,
      aiLoading: true,
      aiError: "",
      aiResults: [],
      aiSummary: "",
      aiFilteredByBlock: null,
      aiStep: "searching",
    }));

    try {
      const searchRes = await api.searchFeeds(q, undefined, undefined, minCount);
      const rawFeeds = searchRes.feeds;
      const foundFeeds = Array.isArray(rawFeeds) ? rawFeeds : [];
      setState((s) => ({ ...s, aiFeeds: foundFeeds }));

      if (foundFeeds.length === 0) {
        setState((s) => ({
          ...s,
          aiError: "未找到相关笔记，请尝试其他关键词",
          aiStep: "idle",
        }));
        return;
      }

      setState((s) => ({ ...s, aiStep: "analyzing" }));

      const aiRes = await api.aiAnalyze({
        feeds: foundFeeds,
        preset,
        keyword: q,
        max_feeds: analyzeMaxFeeds,
      });

      setState((s) => ({
        ...s,
        aiResults: aiRes.results || [],
        aiSummary: aiRes.summary || "",
        aiFilteredByBlock:
          typeof aiRes.filtered_by_block_words === "number" &&
          aiRes.filtered_by_block_words > 0
            ? aiRes.filtered_by_block_words
            : null,
        aiStep: "done",
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        aiError: e instanceof Error ? e.message : "分析失败",
        aiStep: "idle",
      }));
    } finally {
      aiRunningRef.current = false;
      setState((s) => ({ ...s, aiLoading: false }));
    }
  }, []);

  const setReportKeyword = useCallback((v: string) => {
    setState((s) => ({ ...s, reportKeyword: v }));
  }, []);

  const setReportMinCount = useCallback((v: number) => {
    setState((s) => ({ ...s, reportMinCount: v }));
  }, []);

  const setReportMaxFeeds = useCallback((v: number) => {
    const n = Math.min(40, Math.max(1, Math.round(v)));
    setState((s) => ({ ...s, reportMaxFeeds: n }));
  }, []);

  const setReportWithIllustrations = useCallback((v: boolean) => {
    setState((s) => ({ ...s, reportWithIllustrations: v }));
  }, []);

  const selectReportHistory = useCallback((item: ReportHistoryItem) => {
    setState((s) => ({
      ...s,
      reportKeyword: item.keyword,
      report: item.report,
      reportFeeds: item.feeds,
      reportError: "",
    }));
  }, []);

  const runGenerateReport = useCallback(async () => {
    const { keyword, minCount, maxFeeds, withIllustrations } =
      reportParamsRef.current;
    const q = keyword.trim();
    if (!q || reportRunningRef.current) return;

    reportRunningRef.current = true;
    setState((s) => ({
      ...s,
      reportLoading: true,
      reportError: "",
    }));

    try {
      const searchRes = await api.searchFeeds(q, undefined, undefined, minCount);
      const rawFeeds = searchRes.feeds;
      const feeds = Array.isArray(rawFeeds) ? rawFeeds : [];
      if (feeds.length === 0) {
        setState((s) => ({
          ...s,
          reportError: "未找到相关笔记，请尝试其他关键词",
        }));
        return;
      }
      setState((s) => ({ ...s, reportFeeds: feeds }));

      const res = await api.aiGenerateReport({
        feeds,
        keyword: q,
        max_feeds: maxFeeds,
        with_illustrations: withIllustrations,
      });

      const rep = res.report;
      setState((s) => ({
        ...s,
        report: rep,
        reportHistory: [
          {
            keyword: q,
            report: rep,
            feeds,
            date: new Date().toLocaleString("zh-CN"),
          },
          ...s.reportHistory,
        ],
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        reportError: e instanceof Error ? e.message : "报告生成失败",
      }));
    } finally {
      reportRunningRef.current = false;
      setState((s) => ({ ...s, reportLoading: false }));
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return (
    <AppContext.Provider
      value={{
        ...state,
        refreshStatus,
        setSearchResults,
        clearSearch,
        setAiInput,
        setAiSelectedPreset,
        setAiMinCount,
        setAiAnalyzeMaxFeeds,
        runAiAnalysis,
        setReportKeyword,
        setReportMinCount,
        setReportMaxFeeds,
        setReportWithIllustrations,
        runGenerateReport,
        selectReportHistory,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
