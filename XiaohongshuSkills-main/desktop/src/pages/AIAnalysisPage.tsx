import { useAppContext } from "@/store/AppContext";
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
import { openArticleLink } from "@/lib/openArticleLink";

const PRESETS = [
  { id: "quality", label: "内容质量评估", icon: Star, desc: "分析文案质量、结构完整性，1-10 打分" },
  { id: "viral", label: "爆款潜力预测", icon: TrendingUp, desc: "预测内容的爆款概率与传播潜力" },
  { id: "risk", label: "违规风险检测", icon: AlertTriangle, desc: "检查违禁词、敏感内容、广告嫌疑" },
  { id: "competitor", label: "竞品分析", icon: FileText, desc: "对比同类笔记，提取差异化要点" },
  { id: "rewrite", label: "内容改写建议", icon: Sparkles, desc: "基于高分笔记特征给出优化建议" },
];

const COUNT_PRESETS = [20, 30, 50, 80, 100];
const ANALYZE_MAX_PRESETS = [5, 10, 15, 20, 30, 40];

export function AIAnalysisPage() {
  const {
    aiInput,
    aiSelectedPreset,
    aiMinCount,
    aiAnalyzeMaxFeeds,
    aiLoading,
    aiStep,
    aiFeeds,
    aiResults,
    aiSummary,
    aiFilteredByBlock,
    aiError,
    setAiInput,
    setAiSelectedPreset,
    setAiMinCount,
    setAiAnalyzeMaxFeeds,
    runAiAnalysis,
  } = useAppContext();

  return (
    <div className="flex min-h-0 w-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
          <div className="mb-3 flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-brand-500" />
            <h2 className="font-semibold text-gray-800">AI 工作台</h2>
            {aiLoading && (
              <span className="text-xs text-amber-600">
                任务在后台运行，可切换页面，完成后回到此处查看结果
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !aiLoading && void runAiAnalysis()
                }
                placeholder="输入你的需求，例如：分析春招相关的热门笔记..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <button
              type="button"
              onClick={() => void runAiAnalysis()}
              disabled={aiLoading || !aiInput.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {aiLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              分析
            </button>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-xs text-gray-500">
              检索条数（与搜索页一致，先拉取候选笔记）
            </label>
            <div className="flex flex-wrap gap-1">
              {COUNT_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAiMinCount(n)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs transition-colors",
                    aiMinCount === n
                      ? "border-brand-300 bg-brand-50 text-brand-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-xs text-gray-500">
              送入模型的笔记条数（屏蔽词过滤后，至多取该数量；默认 10，最大 50）
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1">
                {ANALYZE_MAX_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAiAnalyzeMaxFeeds(n)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs transition-colors",
                      aiAnalyzeMaxFeeds === n
                        ? "border-brand-300 bg-brand-50 text-brand-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={50}
                value={aiAnalyzeMaxFeeds}
                onChange={(e) =>
                  setAiAnalyzeMaxFeeds(Number(e.target.value) || 1)
                }
                className="w-16 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
                title="自定义 1–50"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setAiSelectedPreset(p.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors",
                  aiSelectedPreset === p.id
                    ? "border-brand-300 bg-brand-50 text-brand-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                <p.icon size={14} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="scrollbar-thin min-h-[200px] flex-1 overflow-y-auto p-6">
          {aiStep === "idle" && !aiError && (
            <div className="py-20 text-center text-gray-400">
              <BrainCircuit className="mx-auto mb-3 h-12 w-12 opacity-40" />
              <p>输入需求，AI 将自动搜索并分析相关笔记</p>
              <p className="mt-2 text-xs">
                支持自然语言，如「帮我看看最近关于 AI 绘画的爆款笔记」
              </p>
            </div>
          )}

          {aiStep === "searching" && (
            <div className="py-20 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-500" />
              <p className="mt-3 text-sm text-gray-500">正在搜索相关笔记...</p>
            </div>
          )}

          {aiStep === "analyzing" && (
            <div className="py-20 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-500" />
              <p className="mt-3 text-sm text-gray-500">
                正在调用模型分析笔记（本次共检索 {aiFeeds.length} 篇，屏蔽词过滤后至多送入{" "}
                {aiAnalyzeMaxFeeds} 篇）
              </p>
            </div>
          )}

          {aiError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              {aiError}
            </div>
          )}

          {aiStep === "done" && (
            <div className="space-y-6">
              {aiFilteredByBlock != null && aiFilteredByBlock > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  已根据「设置」中的屏蔽词过滤 {aiFilteredByBlock}{" "}
                  篇笔记，未参与 AI 分析。
                </div>
              )}
              {aiSummary && (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h3 className="mb-2 flex items-center gap-2 font-medium text-gray-800">
                    <Sparkles size={16} className="text-brand-500" />
                    分析总结
                  </h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                    {aiSummary}
                  </p>
                </div>
              )}

              <div>
                <h3 className="mb-3 font-medium text-gray-800">
                  分析结果（{aiResults.length} 篇）
                </h3>
                <div className="space-y-3">
                  {aiResults.map((r, idx) => (
                    <div
                      key={idx}
                      className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4"
                    >
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-800">
                          {(r.title as string) || "无标题"}
                        </h4>
                        {r.score !== undefined && (
                          <div className="mt-1 flex items-center gap-1">
                            <Star
                              size={14}
                              className="fill-amber-500 text-amber-500"
                            />
                            <span className="text-sm font-semibold text-amber-700">
                              {Number(r.score).toFixed(1)}
                            </span>
                            {r.labels && (
                              <span className="ml-2 text-xs text-gray-400">
                                {(r.labels as string[]).join(" · ")}
                              </span>
                            )}
                          </div>
                        )}
                        {r.reason && (
                          <p className="mt-2 text-xs text-gray-500">
                            {r.reason as string}
                          </p>
                        )}
                        {r.link && (
                          <button
                            type="button"
                            onClick={() =>
                              void openArticleLink(r.link as string)
                            }
                            className="mt-1 block text-left text-xs text-brand-600 hover:underline"
                          >
                            查看原文（已登录浏览器）
                          </button>
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
