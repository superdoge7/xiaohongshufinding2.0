import { useState, useCallback } from "react";
import { api } from "@/services/api";
import { FeedCard } from "@/components/FeedCard";
import {
  Search,
  Loader2,
  SlidersHorizontal,
  X,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = ["综合", "最新", "最多点赞", "最多评论", "最多收藏"];
const TYPE_OPTIONS = ["不限", "视频", "图文"];

export function SearchPage() {
  const [keyword, setKeyword] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [noteType, setNoteType] = useState("");
  const [feeds, setFeeds] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState<Record<string, unknown> | null>(null);
  const [recommendedKw, setRecommendedKw] = useState<string[]>([]);

  const doSearch = useCallback(
    async (kw?: string) => {
      const q = (kw ?? keyword).trim();
      if (!q) return;
      setLoading(true);
      setError("");
      setSelectedFeed(null);
      try {
        const res = await api.searchFeeds(q, sortBy || undefined, noteType || undefined);
        setFeeds(res.feeds || []);
        setRecommendedKw(res.recommended_keywords || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "搜索失败");
        setFeeds([]);
      } finally {
        setLoading(false);
      }
    },
    [keyword, sortBy, noteType]
  );

  const getFeedLink = (feed: Record<string, unknown>): string | null => {
    const nc = (feed.noteCard ?? feed.note_card ?? feed) as Record<string, unknown>;
    const id = (nc.noteId ?? nc.note_id ?? nc.id ?? feed.id) as string | undefined;
    if (!id) return null;
    return `https://www.xiaohongshu.com/explore/${id}`;
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search bar */}
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="输入关键词搜索小红书笔记..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              />
            </div>
            <button
              onClick={() => doSearch()}
              disabled={loading}
              className="px-5 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              搜索
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-2.5 border rounded-lg transition-colors",
                showFilters
                  ? "bg-brand-50 border-brand-300 text-brand-600"
                  : "border-gray-300 text-gray-500 hover:bg-gray-50"
              )}
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 flex flex-wrap gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">排序</label>
                <div className="flex gap-1">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSortBy(sortBy === opt ? "" : opt)}
                      className={cn(
                        "px-2.5 py-1 text-xs rounded-md border transition-colors",
                        sortBy === opt
                          ? "bg-brand-50 border-brand-300 text-brand-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">类型</label>
                <div className="flex gap-1">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setNoteType(noteType === opt ? "" : opt)}
                      className={cn(
                        "px-2.5 py-1 text-xs rounded-md border transition-colors",
                        noteType === opt
                          ? "bg-brand-50 border-brand-300 text-brand-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {recommendedKw.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-gray-400">推荐：</span>
              {recommendedKw.slice(0, 8).map((kw) => (
                <button
                  key={kw}
                  onClick={() => {
                    setKeyword(kw);
                    doSearch(kw);
                  }}
                  className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-brand-50 hover:text-brand-600"
                >
                  {kw}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {!loading && feeds.length === 0 && !error && (
            <div className="text-center py-20 text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>输入关键词开始搜索</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {feeds.map((feed, idx) => (
              <FeedCard
                key={idx}
                feed={feed}
                onClick={() => setSelectedFeed(feed)}
                selected={selectedFeed === feed}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedFeed && (
        <div className="w-96 border-l border-gray-200 bg-white overflow-y-auto scrollbar-thin">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-medium text-sm">笔记详情</h3>
            <button onClick={() => setSelectedFeed(null)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <div className="p-4">
            <FeedDetailPanel feed={selectedFeed} />
          </div>
        </div>
      )}
    </div>
  );
}

function FeedDetailPanel({ feed }: { feed: Record<string, unknown> }) {
  const nc = (feed.noteCard ?? feed.note_card ?? feed) as Record<string, unknown>;
  const title = (nc.displayTitle ?? nc.display_title ?? nc.title ?? "") as string;
  const desc = (nc.desc ?? nc.description ?? "") as string;
  const user = nc.user as Record<string, unknown> | undefined;
  const nickname = (user?.nickname ?? user?.nickName ?? "") as string;
  const interact = nc.interactInfo as Record<string, unknown> | undefined;
  const id = (nc.noteId ?? nc.note_id ?? nc.id ?? feed.id) as string | undefined;
  const link = id ? `https://www.xiaohongshu.com/explore/${id}` : null;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-gray-800">{title || "无标题"}</h4>
        <p className="text-xs text-gray-500 mt-1">作者：{nickname}</p>
      </div>

      {desc && (
        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{desc}</p>
      )}

      {interact && (
        <div className="flex gap-4 text-xs text-gray-500">
          {interact.likedCount !== undefined && <span>点赞 {String(interact.likedCount)}</span>}
          {interact.commentCount !== undefined && <span>评论 {String(interact.commentCount)}</span>}
          {interact.collectedCount !== undefined && <span>收藏 {String(interact.collectedCount)}</span>}
          {interact.shareCount !== undefined && <span>分享 {String(interact.shareCount)}</span>}
        </div>
      )}

      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
        >
          <ExternalLink size={14} /> 在浏览器中查看
        </a>
      )}

      <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto max-h-60 text-gray-500">
        {JSON.stringify(nc, null, 2).slice(0, 2000)}
      </pre>
    </div>
  );
}
