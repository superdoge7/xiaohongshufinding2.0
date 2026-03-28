import { useState, useCallback } from "react";
import { api } from "@/services/api";
import { FeedCard } from "@/components/FeedCard";
import {
  BrainCircuit,
  Loader2,
  Send,
  Star,
  AlertTriangle,
  TrendingUp,
  FileText,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { id: "quality", label: "内容质量评估", icon: Star, desc: "分析文案质量、结构完整性，1-10 打分" },
  { id: "viral", label: "爆款潜力预测", icon: TrendingUp, desc: "预测内容的爆款概率与传播潜力" },
  { id: "risk", label: "违规风险检测", icon: AlertTriangle, desc: "检查违禁词、敏感内容、广告嫌疑" },
  { id: "competitor", label: "竞品分析", icon: FileText, desc: "对比同类笔记，提取差异化要点" },
  { id: "rewrite", label: "内容改写建议", icon: Sparkles, desc: "基于高分笔记特征给出优化建议" },
];

export function AIAnalysisPage() {
  const [input, setInput] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("quality");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"idle" | "searching" | "analyzing" | "done">("idle");
  const [feeds, setFeeds] = useState<Array<Record<string, unknown>>>([]);
  const [results, setResults] = useState<Array<Record<string, unknown>>>([]);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = useCallback(async () => {
    const q = input.trim();
    if (!q) return;
    setLoading(true);
    setError("");
    setResults([]);
    setSummary("");

    try {
      setStep("searching");
      const searchRes = await api.searchFeeds(q);
      const foundFeeds = searchRes.feeds || [];
      setFeeds(foundFeeds);

      if (foundFeeds.length === 0) {
        setError("未找到相关笔记，请尝试其他关键词");
        setStep("idle");
        setLoading(false);
        return;
      }

      setStep("analyzing");
      const aiRes = await api.aiAnalyze({
        feeds: foundFeeds.slice(0, 10),
        preset: selectedPreset,
        keyword: q,
      });
      setResults(aiRes.results || []);
      setSummary(aiRes.summary || "");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析失败");
      setStep("idle");
    } finally {
      setLoading(false);
    }
  }, [input, selectedPreset]);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <BrainCircuit className="w-5 h-5 text-brand-500" />
            <h2 className="font-semibold text-gray-800">AI 工作台</h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
                placeholder="输入你的需求，例如：分析春招相关的热门笔记..."
                className="w-full pl-4 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
              className="px-5 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              分析
            </button>
          </div>

          {/* Preset selection */}
          <div className="mt-3 flex gap-2 flex-wrap">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPreset(p.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors",
                  selectedPreset === p.id
                    ? "bg-brand-50 border-brand-300 text-brand-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                <p.icon size={14} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {step === "idle" && !error && (
            <div className="text-center py-20 text-gray-400">
              <BrainCircuit className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>输入需求，AI 将自动搜索并分析相关笔记</p>
              <p className="text-xs mt-2">
                支持自然语言，如「帮我看看最近关于 AI 绘画的爆款笔记」
              </p>
            </div>
          )}

          {step === "searching" && (
            <div className="text-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto" />
              <p className="text-sm text-gray-500 mt-3">正在搜索相关笔记...</p>
            </div>
          )}

          {step === "analyzing" && (
            <div className="text-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto" />
              <p className="text-sm text-gray-500 mt-3">AI 正在分析 {feeds.length} 篇笔记...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">
              {error}
            </div>
          )}

          {step === "done" && (
            <div className="space-y-6">
              {summary && (
                <div className="p-5 bg-white rounded-xl border border-gray-200">
                  <h3 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                    <Sparkles size={16} className="text-brand-500" />
                    分析总结
                  </h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {summary}
                  </p>
                </div>
              )}

              <div>
                <h3 className="font-medium text-gray-800 mb-3">
                  分析结果（{results.length} 篇）
                </h3>
                <div className="space-y-3">
                  {results.map((r, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-white rounded-xl border border-gray-200 flex gap-4"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-gray-800">
                          {(r.title as string) || "无标题"}
                        </h4>
                        {r.score !== undefined && (
                          <div className="flex items-center gap-1 mt-1">
                            <Star size={14} className="text-amber-500 fill-amber-500" />
                            <span className="text-sm font-semibold text-amber-700">
                              {Number(r.score).toFixed(1)}
                            </span>
                            {r.labels && (
                              <span className="text-xs text-gray-400 ml-2">
                                {(r.labels as string[]).join(" · ")}
                              </span>
                            )}
                          </div>
                        )}
                        {r.reason && (
                          <p className="text-xs text-gray-500 mt-2">{r.reason as string}</p>
                        )}
                        {r.link && (
                          <a
                            href={r.link as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-600 hover:underline mt-1 inline-block"
                          >
                            查看原文
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
