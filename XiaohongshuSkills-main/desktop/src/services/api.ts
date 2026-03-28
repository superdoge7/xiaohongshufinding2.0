const DEFAULT_API_BASE = "http://127.0.0.1:8765";

let _apiBase: string | null = null;

async function getApiBase(): Promise<string> {
  if (_apiBase) return _apiBase;
  if (window.electronAPI) {
    _apiBase = await window.electronAPI.getApiBase();
  } else {
    _apiBase = DEFAULT_API_BASE;
  }
  return _apiBase;
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const base = await getApiBase();
  const url = `${base}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed.detail || text;
    } catch {}
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json();
}

export const api = {
  // Chrome
  chromeStart: (headless = false) =>
    request<{ ok: boolean }>("/api/chrome/start", {
      method: "POST",
      body: JSON.stringify({ headless }),
    }),
  chromeStop: () =>
    request<{ ok: boolean }>("/api/chrome/stop", { method: "POST" }),
  chromeStatus: () =>
    request<{ running: boolean }>("/api/chrome/status", { method: "POST" }),

  // Login
  loginQrcode: () =>
    request<{
      qrcode_base64?: string;
      qrcode_data_url?: string;
      status?: string;
    }>("/api/login/qrcode", { method: "POST" }),
  loginCheck: () =>
    request<{ logged_in: boolean; cached?: boolean }>("/api/login/check", {
      method: "POST",
    }),

  // Accounts
  listAccounts: () =>
    request<{
      accounts: Array<{
        name: string;
        alias: string;
        is_default: boolean;
        profile_dir: string;
      }>;
    }>("/api/accounts"),
  addAccount: (name: string, alias?: string) =>
    request<{ ok: boolean }>("/api/accounts", {
      method: "POST",
      body: JSON.stringify({ name, alias }),
    }),
  deleteAccount: (name: string) =>
    request<{ ok: boolean }>(`/api/accounts/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),
  setDefaultAccount: (name: string) =>
    request<{ ok: boolean }>("/api/accounts/default", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  // Search
  searchFeeds: (
    keyword: string,
    sortBy?: string,
    noteType?: string
  ) =>
    request<{
      keyword: string;
      feeds: Array<Record<string, unknown>>;
      recommended_keywords?: string[];
    }>("/api/search", {
      method: "POST",
      body: JSON.stringify({
        keyword,
        sort_by: sortBy,
        note_type: noteType,
      }),
    }),
  homeFeeds: () =>
    request<{ feeds: Array<Record<string, unknown>> }>("/api/feeds/home", {
      method: "POST",
    }),
  feedDetail: (feedId: string, xsecToken: string) =>
    request<Record<string, unknown>>("/api/feeds/detail", {
      method: "POST",
      body: JSON.stringify({ feed_id: feedId, xsec_token: xsecToken }),
    }),

  // AI
  aiAnalyze: (body: {
    feeds: Array<Record<string, unknown>>;
    preset: string;
    keyword?: string;
  }) =>
    request<{
      results: Array<Record<string, unknown>>;
      summary?: string;
    }>("/api/ai/analyze", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  aiScoreBatch: (body: {
    feeds: Array<Record<string, unknown>>;
    preset: string;
  }) =>
    request<{
      scored_feeds: Array<Record<string, unknown>>;
    }>("/api/ai/score-batch", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  aiGenerateReport: (body: {
    feeds: Array<Record<string, unknown>>;
    keyword: string;
    preset?: string;
  }) =>
    request<{
      report: {
        title: string;
        overview: string;
        top_feeds: Array<Record<string, unknown>>;
        analysis: string;
        recommendations: string[];
      };
    }>("/api/ai/generate-report", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  aiSettings: {
    get: () =>
      request<{
        provider: string;
        api_key_set: boolean;
        model: string;
        base_url: string;
      }>("/api/ai/settings"),
    save: (body: {
      provider: string;
      api_key: string;
      model: string;
      base_url?: string;
    }) =>
      request<{ ok: boolean }>("/api/ai/settings", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  // Health
  health: () => request<{ status: string }>("/api/health"),
};
