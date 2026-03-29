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
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("network")
    ) {
      throw new Error(
        "无法连接后端（Failed to fetch）。请确认已在本机运行：python scripts/serve_local_app.py，且防火墙未拦截 8765 端口。"
      );
    }
    throw e;
  }
  if (!res.ok) {
    const text = await res.text();
    let detail: string | unknown = text;
    try {
      const parsed = JSON.parse(text) as { detail?: unknown };
      if (parsed.detail !== undefined) detail = parsed.detail;
    } catch {
      /* keep text */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Chrome / Edge browser
  chromeStart: (headless = false, browser = "auto") =>
    request<{ ok: boolean; browser?: string }>("/api/chrome/start", {
      method: "POST",
      body: JSON.stringify({ headless, browser }),
    }),
  chromeStop: () =>
    request<{ ok: boolean }>("/api/chrome/stop", { method: "POST" }),
  chromeStatus: () =>
    request<{ running: boolean; browser?: string | null }>("/api/chrome/status", {
      method: "POST",
    }),
  chromeBrowsers: () =>
    request<{
      browsers: Array<{ name: string; label: string; path: string }>;
    }>("/api/chrome/browsers"),

  // Login - QR code
  loginQrcode: () =>
    request<{
      qrcode_base64?: string;
      qrcode_data_url?: string;
      status?: string;
    }>("/api/login/qrcode", { method: "POST" }),
  loginCheck: () =>
    request<{ logged_in: boolean; cached?: boolean; error?: string }>("/api/login/check", {
      method: "POST",
    }),

  // Login - phone SMS
  loginPhoneStart: (phone: string, countryCode = "86") =>
    request<{
      ok: boolean;
      code_sent?: boolean;
      already_logged_in?: boolean;
      message?: string;
      reason?: string;
    }>("/api/login/phone/start", {
      method: "POST",
      body: JSON.stringify({ phone, country_code: countryCode }),
    }),
  loginPhoneVerify: (phone: string, code: string, countryCode = "86") =>
    request<{
      ok: boolean;
      logged_in?: boolean;
      current_url?: string;
      reason?: string;
    }>("/api/login/phone/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code, country_code: countryCode }),
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
    noteType?: string,
    minCount?: number,
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
        min_count: minCount ?? 20,
      }),
    }),
  homeFeeds: () =>
    request<{ feeds: Array<Record<string, unknown>> }>("/api/feeds/home", {
      method: "POST",
    }),
  feedDetail: (
    feedId: string,
    xsecToken: string,
    opts?: {
      load_all_comments?: boolean;
      limit?: number;
      click_more_replies?: boolean;
      reply_limit?: number;
      scroll_speed?: string;
    }
  ) =>
    request<Record<string, unknown>>("/api/feeds/detail", {
      method: "POST",
      body: JSON.stringify({
        feed_id: feedId,
        xsec_token: xsecToken,
        load_all_comments: opts?.load_all_comments ?? false,
        limit: opts?.limit ?? 20,
        click_more_replies: opts?.click_more_replies ?? false,
        reply_limit: opts?.reply_limit ?? 10,
        scroll_speed: opts?.scroll_speed ?? "normal",
      }),
    }),

  browserNavigate: (body: { url: string }) =>
    request<{ ok: boolean }>("/api/browser/navigate", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // AI
  aiAnalyze: (body: {
    feeds: Array<Record<string, unknown>>;
    preset: string;
    keyword?: string;
    max_feeds?: number;
  }) =>
    request<{
      results: Array<Record<string, unknown>>;
      summary?: string;
      filtered_by_block_words?: number;
      feeds_analyzed?: number;
    }>("/api/ai/analyze", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  aiScoreBatch: (body: {
    feeds: Array<Record<string, unknown>>;
    preset: string;
    max_feeds?: number;
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
    max_feeds?: number;
    with_illustrations?: boolean;
  }) =>
    request<{
      report: {
        title: string;
        overview: string;
        top_feeds: Array<Record<string, unknown>>;
        analysis: string;
        recommendations: string[];
        filtered_by_block_words?: number;
        report_visuals?: {
          primary_image_url?: string;
          more_image_urls?: string[];
          caption?: string;
          image_prompt_hint?: string;
        } | null;
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
        max_tokens: number;
        block_words: string[];
        use_note_covers?: boolean;
      }>("/api/ai/settings"),
    save: (body: {
      provider: string;
      api_key: string;
      model: string;
      base_url?: string;
      max_tokens?: number;
      block_words?: string[];
      use_note_covers?: boolean;
    }) =>
      request<{ ok: boolean }>("/api/ai/settings", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  // Health
  health: () => request<{ status: string }>("/api/health"),
};
