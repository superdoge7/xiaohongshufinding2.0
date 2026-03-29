import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api";
import {
  Settings,
  Save,
  Loader2,
  CheckCircle2,
  Key,
  Globe,
  Cpu,
  Monitor,
  AlertTriangle,
  FolderOpen,
  FolderInput,
} from "lucide-react";

const PROVIDERS = [
  { id: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { id: "claude", label: "Anthropic Claude", models: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"] },
  { id: "custom", label: "自定义（OpenAI 兼容）", models: [] },
];

interface BrowserInfo {
  name: string;
  label: string;
  path: string;
}

export function SettingsPage() {
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [baseUrl, setBaseUrl] = useState("");
  const [maxTokens, setMaxTokens] = useState(4096);
  const [maxTokensInput, setMaxTokensInput] = useState("4096");
  const [useNoteCovers, setUseNoteCovers] = useState(false);
  const [blockWordsText, setBlockWordsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const [chromeRunning, setChromeRunning] = useState(false);
  const [chromeLoading, setChromeLoading] = useState(false);
  const [chromeError, setChromeError] = useState("");
  const [activeBrowser, setActiveBrowser] = useState<string | null>(null);
  const [availableBrowsers, setAvailableBrowsers] = useState<BrowserInfo[]>([]);
  const [selectedBrowser, setSelectedBrowser] = useState("auto");
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  const [histDirInput, setHistDirInput] = useState("");
  const [histEffective, setHistEffective] = useState("");
  const [histSessionFile, setHistSessionFile] = useState("");
  const [histDefault, setHistDefault] = useState("");
  const [histSaving, setHistSaving] = useState(false);
  const [histSaved, setHistSaved] = useState(false);
  const [histErr, setHistErr] = useState("");

  useEffect(() => {
    api.health()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));

    api.aiSettings
      .get()
      .then((r: Record<string, unknown>) => {
        setProvider((r.provider as string) || "openai");
        setModel((r.model as string) || "gpt-4o");
        setBaseUrl((r.base_url as string) || "");
        if (r.max_tokens) {
          const mt = Number(r.max_tokens);
          setMaxTokens(Number.isFinite(mt) ? mt : 4096);
          setMaxTokensInput(String(Number.isFinite(mt) ? mt : 4096));
        }
        if (typeof (r as { use_note_covers?: boolean }).use_note_covers === "boolean") {
          setUseNoteCovers((r as { use_note_covers: boolean }).use_note_covers);
        }
        const bw = (r as { block_words?: string[] }).block_words;
        if (Array.isArray(bw)) setBlockWordsText(bw.join("\n"));
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    api.chromeStatus()
      .then((r) => {
        setChromeRunning(r.running);
        if (r.browser) setActiveBrowser(r.browser);
      })
      .catch(() => {});

    api.chromeBrowsers()
      .then((r) => setAvailableBrowsers(r.browsers || []))
      .catch(() => {});

    api.desktop.config
      .get()
      .then((c) => {
        setHistDirInput(c.history_dir || "");
        setHistEffective(c.effective_history_dir || "");
        setHistSessionFile(c.session_file || "");
        setHistDefault(c.default_history_dir || "");
      })
      .catch(() => {});
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const block_words = blockWordsText
        .split(/[\n,，;；]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const parsedMt = parseInt(maxTokensInput.replace(/\s/g, ""), 10);
      const saveMt = Number.isFinite(parsedMt)
        ? Math.min(32768, Math.max(256, parsedMt))
        : maxTokens;
      setMaxTokens(saveMt);
      setMaxTokensInput(String(saveMt));
      await api.aiSettings.save({
        provider,
        api_key: apiKey,
        model,
        base_url: baseUrl || undefined,
        max_tokens: saveMt,
        block_words,
        use_note_covers: useNoteCovers,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  }, [provider, apiKey, model, baseUrl, maxTokens, maxTokensInput, blockWordsText, useNoteCovers]);

  const currentProvider = PROVIDERS.find((p) => p.id === provider);
  const modelOptions = currentProvider?.models ?? [];

  const refreshHistoryConfig = useCallback(() => {
    api.desktop.config
      .get()
      .then((c) => {
        setHistDirInput(c.history_dir || "");
        setHistEffective(c.effective_history_dir || "");
        setHistSessionFile(c.session_file || "");
        setHistDefault(c.default_history_dir || "");
      })
      .catch(() => {});
  }, []);

  const saveHistoryConfig = async () => {
    setHistSaving(true);
    setHistErr("");
    setHistSaved(false);
    try {
      await api.desktop.config.save({ history_dir: histDirInput.trim() });
      refreshHistoryConfig();
      window.dispatchEvent(new Event("redbook-reload-session"));
      setHistSaved(true);
      setTimeout(() => setHistSaved(false), 3000);
    } catch (e) {
      setHistErr(e instanceof Error ? e.message : "保存失败");
    }
    setHistSaving(false);
  };

  const browseHistoryFolder = async () => {
    if (!window.electronAPI?.selectHistoryDirectory) {
      setHistErr("浏览器模式请手动填写路径；桌面版 Electron 支持选择文件夹。");
      return;
    }
    try {
      const p = await window.electronAPI.selectHistoryDirectory();
      if (p) setHistDirInput(p);
    } catch {
      setHistErr("选择文件夹失败");
    }
  };

  const openHistoryFolder = async () => {
    const target = histEffective || histDefault;
    if (!target) return;
    if (window.electronAPI?.shellOpenPath) {
      await window.electronAPI.shellOpenPath(target);
    } else {
      setHistErr("浏览器模式请自行在资源管理器中打开上述路径。");
    }
  };

  const handleChromeToggle = async () => {
    setChromeLoading(true);
    setChromeError("");
    try {
      if (chromeRunning) {
        await api.chromeStop();
      } else {
        const res = await api.chromeStart(false, selectedBrowser);
        if (!res.ok) {
          setChromeError("浏览器启动失败");
        }
        if (res.browser) setActiveBrowser(res.browser);
      }
      const s = await api.chromeStatus();
      setChromeRunning(s.running);
      if (s.browser) setActiveBrowser(s.browser);
    } catch (e) {
      setChromeError(e instanceof Error ? e.message : "操作失败");
    }
    setChromeLoading(false);
  };

  if (backendOk === false) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-500" />
            设置
          </h2>
        </div>
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="font-medium text-amber-800 mb-2">后端服务未启动</p>
          <div className="text-sm text-gray-600 text-left bg-white rounded-lg p-4 mb-4 space-y-2">
            <p>请在命令行（CMD / PowerShell / Terminal）中执行：</p>
            <code className="block bg-gray-100 p-2 rounded text-xs font-mono">
              cd {String.raw`项目根目录`}
            </code>
            <code className="block bg-gray-100 p-2 rounded text-xs font-mono">
              python scripts/serve_local_app.py
            </code>
          </div>
          <button
            onClick={() => {
              api.health()
                .then(() => {
                  setBackendOk(true);
                  api.chromeStatus().then((r) => {
                    setChromeRunning(r.running);
                    if (r.browser) setActiveBrowser(r.browser);
                  }).catch(() => {});
                  api.chromeBrowsers().then((r) => setAvailableBrowsers(r.browsers || [])).catch(() => {});
                  api.desktop.config.get().then((c) => {
                    setHistDirInput(c.history_dir || "");
                    setHistEffective(c.effective_history_dir || "");
                    setHistSessionFile(c.session_file || "");
                    setHistDefault(c.default_history_dir || "");
                  }).catch(() => {});
                })
                .catch(() => setBackendOk(false));
            }}
            className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600"
          >
            重新检测
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-500" />
          设置
        </h2>
        <p className="text-sm text-gray-500 mt-1">配置 AI 服务与浏览器参数</p>
      </div>

      {/* Browser control */}
      <section className="mb-8 p-5 bg-white rounded-xl border border-gray-200">
        <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
          <Monitor size={18} /> 浏览器
        </h3>

        {/* Browser selector */}
        {availableBrowsers.length > 0 && (
          <div className="mb-4">
            <label className="text-sm text-gray-600 mb-1.5 block">选择浏览器</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedBrowser("auto")}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  selectedBrowser === "auto"
                    ? "bg-brand-50 border-brand-300 text-brand-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                自动检测
              </button>
              {availableBrowsers.map((b) => (
                <button
                  key={b.name}
                  onClick={() => setSelectedBrowser(b.name)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    selectedBrowser === b.name
                      ? "bg-brand-50 border-brand-300 text-brand-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            {availableBrowsers.length === 0 && (
              <p className="text-xs text-red-500 mt-1">未检测到可用浏览器</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">CDP 调试浏览器</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {chromeRunning
                ? `${activeBrowser === "edge" ? "Edge" : "Chrome"} 运行中 (localhost:9222)`
                : "未启动"}
            </p>
          </div>
          <button
            onClick={handleChromeToggle}
            disabled={chromeLoading}
            className={`px-4 py-2 text-sm rounded-lg font-medium flex items-center gap-1.5 ${
              chromeRunning
                ? "border border-gray-300 text-gray-600 hover:bg-gray-50"
                : "bg-brand-500 text-white hover:bg-brand-600"
            } disabled:opacity-50`}
          >
            {chromeLoading && <Loader2 size={14} className="animate-spin" />}
            {chromeRunning ? "停止" : "启动"}
          </button>
        </div>
        {chromeError && (
          <p className="text-xs text-red-500 mt-2">{chromeError}</p>
        )}
      </section>

      {/* 历史记录目录 */}
      <section className="mb-8 p-5 bg-white rounded-xl border border-gray-200">
        <h3 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
          <FolderOpen size={18} /> 历史记录保存位置
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          搜索页结果、内容报告列表、AI 工作台状态会保存到该目录下的{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">redbook_session.json</code>
          。留空则使用项目内默认目录（见下方「当前实际目录」）。
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">自定义目录（可选）</label>
            <div className="flex gap-2 flex-wrap">
              <input
                value={histDirInput}
                onChange={(e) => setHistDirInput(e.target.value)}
                placeholder={`例如 E:\\VS code\\history 或留空使用默认`}
                className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              <button
                type="button"
                onClick={() => void browseHistoryFolder()}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
              >
                <FolderInput size={16} /> 浏览
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-500 space-y-1 bg-gray-50 rounded-lg p-3 font-mono break-all">
            <p>
              <span className="text-gray-400">当前实际目录：</span>
              {histEffective || "—"}
            </p>
            <p>
              <span className="text-gray-400">会话文件：</span>
              {histSessionFile || "—"}
            </p>
            <p>
              <span className="text-gray-400">内置默认（留空时）：</span>
              {histDefault || "—"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void saveHistoryConfig()}
              disabled={histSaving}
              className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1.5"
            >
              {histSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              保存目录设置
            </button>
            <button
              type="button"
              onClick={() => void openHistoryFolder()}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              打开当前目录
            </button>
            {histSaved && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 size={16} /> 已保存并已尝试载入会话
              </span>
            )}
          </div>
          {histErr && <p className="text-xs text-red-500">{histErr}</p>}
        </div>
      </section>

      {/* AI Settings */}
      <section className="p-5 bg-white rounded-xl border border-gray-200">
        <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
          <Cpu size={18} /> AI 服务配置
        </h3>

        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 mb-1.5 block flex items-center gap-1">
                <Globe size={14} /> API 提供商
              </label>
              <div className="flex gap-2 flex-wrap">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setProvider(p.id);
                      if (p.models.length > 0) setModel(p.models[0]);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      provider === p.id
                        ? "bg-brand-50 border-brand-300 text-brand-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-1.5 block flex items-center gap-1">
                <Key size={14} /> API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              <p className="text-xs text-gray-400 mt-1">密钥仅存储在本地，不会上传到任何服务器</p>
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-1.5 block flex items-center gap-1">
                <Cpu size={14} /> 模型
              </label>
              {modelOptions.length > 0 ? (
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  aria-label="选择 AI 模型"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  {modelOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="模型名称"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              )}
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-1.5 block">Base URL（自定义 API 地址）</label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={provider === "custom" ? "https://your-api.example.com/v1" : "留空使用默认地址，或填入自定义地址"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              <p className="text-xs text-gray-400 mt-1">如使用火山引擎：https://ark.cn-beijing.volces.com/api/v3</p>
            </div>

            <div>
              <label
                htmlFor="ai-max-tokens"
                className="text-sm text-gray-600 mb-1.5 block"
              >
                Max Tokens（最大输出长度）
              </label>
              <input
                id="ai-max-tokens"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={maxTokensInput}
                onChange={(e) => setMaxTokensInput(e.target.value)}
                onBlur={() => {
                  const n = parseInt(maxTokensInput.replace(/\s/g, ""), 10);
                  const clamped = Number.isFinite(n)
                    ? Math.min(32768, Math.max(256, n))
                    : maxTokens;
                  setMaxTokens(clamped);
                  setMaxTokensInput(String(clamped));
                }}
                placeholder="例如 4096 或 8192"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">
                控制模型<strong>单次输出</strong>长度；更长、更结构化的 JSON 报告可适当调高（如 8192）。
                输入数字后失焦会自动限制在 256–32768。
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <input
                id="ai-use-covers"
                type="checkbox"
                checked={useNoteCovers}
                onChange={(e) => setUseNoteCovers(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="ai-use-covers" className="text-sm text-gray-700 cursor-pointer">
                <span className="font-medium">将笔记封面图送入多模态模型</span>
                <p className="text-xs text-gray-500 mt-1">
                  开启后，对 OpenAI 兼容接口（含火山方舟视觉模型）会附带若干张封面
                  URL；模型需支持 <code className="text-xs">image_url</code>。
                  直连 Anthropic Claude 时仅把图片链接写在文本中（不送像素）。
                  外链图若需防盗链，模型侧可能无法拉取。
                </p>
              </label>
            </div>

            <div>
              <label
                htmlFor="ai-block-words"
                className="text-sm text-gray-600 mb-1.5 block"
              >
                内容屏蔽词（AI 分析 / 报告前自动过滤）
              </label>
              <textarea
                id="ai-block-words"
                value={blockWordsText}
                onChange={(e) => setBlockWordsText(e.target.value)}
                placeholder="每行一个词，或用逗号分隔。标题/描述/作者名中包含任一屏蔽词的笔记不会送入 AI。"
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">
                匹配不区分大小写。仅影响「AI 工作台」与「内容报告」；搜索页仍会显示全部结果。
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                保存设置
              </button>
              {saved && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 size={16} /> 已保存
                </span>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
