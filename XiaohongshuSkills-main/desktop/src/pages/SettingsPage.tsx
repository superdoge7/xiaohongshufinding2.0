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
} from "lucide-react";

const PROVIDERS = [
  { id: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { id: "claude", label: "Anthropic Claude", models: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"] },
  { id: "custom", label: "自定义（OpenAI 兼容）", models: [] },
];

export function SettingsPage() {
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chromeRunning, setChromeRunning] = useState(false);

  useEffect(() => {
    api.aiSettings
      .get()
      .then((r) => {
        setProvider(r.provider || "openai");
        setModel(r.model || "gpt-4o");
        setBaseUrl(r.base_url || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    api.chromeStatus().then((r) => setChromeRunning(r.running)).catch(() => {});
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.aiSettings.save({ provider, api_key: apiKey, model, base_url: baseUrl || undefined });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  }, [provider, apiKey, model, baseUrl]);

  const currentProvider = PROVIDERS.find((p) => p.id === provider);
  const modelOptions = currentProvider?.models ?? [];

  const handleChromeToggle = async () => {
    if (chromeRunning) {
      await api.chromeStop();
    } else {
      await api.chromeStart(false);
    }
    const s = await api.chromeStatus();
    setChromeRunning(s.running);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-500" />
          设置
        </h2>
        <p className="text-sm text-gray-500 mt-1">配置 AI 服务与浏览器参数</p>
      </div>

      {/* Chrome control */}
      <section className="mb-8 p-5 bg-white rounded-xl border border-gray-200">
        <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
          <Monitor size={18} /> Chrome 浏览器
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">CDP 调试浏览器</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {chromeRunning ? "运行中 (localhost:9222)" : "未启动"}
            </p>
          </div>
          <button
            onClick={handleChromeToggle}
            className={`px-4 py-2 text-sm rounded-lg font-medium ${
              chromeRunning
                ? "border border-gray-300 text-gray-600 hover:bg-gray-50"
                : "bg-brand-500 text-white hover:bg-brand-600"
            }`}
          >
            {chromeRunning ? "停止" : "启动"}
          </button>
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
              <div className="flex gap-2">
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

            {provider === "custom" && (
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block">Base URL</label>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://your-api.example.com/v1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
            )}

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
