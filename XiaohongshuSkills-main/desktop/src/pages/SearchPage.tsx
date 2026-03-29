import { useState, useCallback } from "react";
import { api } from "@/services/api";
import { useAppContext } from "@/store/AppContext";
import { FeedCard } from "@/components/FeedCard";
import {
  Search,
  Loader2,
  SlidersHorizontal,
  X,
  ExternalLink,
  Home,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { openArticleLink } from "@/lib/openArticleLink";

const SORT_OPTIONS = ["综合", "最新", "最多点赞", "最多评论", "最多收藏"];
const TYPE_OPTIONS = ["不限", "视频", "图文"];
const COUNT_PRESETS = [20, 30, 50, 80, 100];

export function getFeedLink(feed: Record<string, unknown>): string | null {
  const nc = (feed.noteCard ?? feed.note_card ?? feed) as Record<string, unknown>;
  const id = (nc.noteId ?? nc.note_id ?? nc.id ?? feed.id) as string | undefined;
  if (!id) return null;
  const xsecToken = (nc.xsecToken ?? nc.xsec_token ?? feed.xsecToken ?? feed.xsec_token) as
    | string
    | undefined;
  let url = `https://www.xiaohongshu.com/explore/${id}`;
  if (xsecToken) {
    url += `?xsec_token=${encodeURIComponent(xsecToken)}&xsec_source=pc_search`;
  }
  return url;
}

function getFeedIdAndToken(feed: Record<string, unknown>): { id: string; xsec: string } | null {
  const nc = (feed.noteCard ?? feed.note_card ?? feed) as Record<string, unknown>;
  const id = (nc.noteId ?? nc.note_id ?? nc.id ?? feed.id) as string | undefined;
  const xsec = (nc.xsecToken ?? nc.xsec_token ?? feed.xsecToken ?? feed.xsec_token) as
    | string
    | undefined;
  if (!id || !xsec) return null;
  return { id, xsec };
}

type Mode = "search" | "home";

export function SearchPage() {
  const {
    searchKeyword,
    searchFeeds: cachedFeeds,
    searchRecommended,
    setSearchResults,
  } = useAppContext();
  const [mode, setMode] = useState<Mode>("search");
  const [keyword, setKeyword] = useState(searchKeyword);
  const [sortBy, setSortBy] = useState("");
  const [noteType, setNoteType] = useState("");
  const [minCount, setMinCount] = useState(50);
  const [customCount, setCustomCount] = useState("");
  const [feeds, setFeeds] = useState<Array<Record<string, unknown>>>(cachedFeeds);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState<Record<string, unknown> | null>(null);
  const [recommendedKw, setRecommendedKw] = useState<string[]>(searchRecommended);

  const applyCustomCount = () => {
    const n = parseInt(customCount, 10);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(200, Math.max(5, n));
    setMinCount(clamped);
    setCustomCount(String(clamped));
  };

  const doSearch = useCallback(
    async (kw?: string) => {
      const q = (kw ?? keyword).trim();
      if (!q) return;
      setLoading(true);
      setError("");
      setSelectedFeed(null);
      try {
        const res = await api.searchFeeds(q, sortBy || undefined, noteType || undefined, minCount);
        const newFeeds = Array.isArray(res.feeds) ? res.feeds : [];
        const newRecommended = res.recommended_keywords || [];
        setFeeds(newFeeds);
        setRecommendedKw(newRecommended);
        setSearchResults(q, newFeeds, newRecommended);
      } catch (e) {
        setError(e instanceof Error ? e.message : "搜索失败");
        setFeeds([]);
      } finally {
        setLoading(false);
      }
    },
    [keyword, sortBy, noteType, minCount, setSearchResults]
  );

  const loadHomeFeeds = useCallback(async () => {
    setLoading(true);
    setError("");
    setSelectedFeed(null);
    try {
      const res = await api.homeFeeds();
      const list = Array.isArray(res.feeds) ? res.feeds : [];
      setFeeds(list);
      setRecommendedKw([]);
      setSearchResults("", list, []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载首页推荐失败");
      setFeeds([]);
    } finally {
      setLoading(false);
    }
  }, [setSearchResults]);

  const openLink = (url: string) => {
    void openArticleLink(url);
  };

  return (
    <div className="flex flex-col xl:flex-row min-w-0 min-h-0">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Toolbar */}
        <div className="px-6 py-4 bg-white border-b border-gray-200 shrink-0">
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                setMode("search");
                setError("");
              }}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg border transition-colors flex items-center gap-1.5",
                mode === "search"
                  ? "bg-brand-50 border-brand-300 text-brand-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              <Search size={14} /> 关键词搜索
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("home");
                setError("");
              }}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg border transition-colors flex items-center gap-1.5",
                mode === "home"
                  ? "bg-brand-50 border-brand-300 text-brand-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              <Home size={14} /> 首页推荐流
            </button>
            {mode === "home" && (
              <button
                type="button"
                onClick={() => loadHomeFeeds()}
                disabled={loading}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                刷新列表
              </button>
            )}
          </div>

          {mode === "search" && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
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
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "p-2.5 border rounded-lg transition-colors",
                    showFilters
                      ? "bg-brand-50 border-brand-300 text-brand-600"
                      : "border-gray-300 text-gray-500 hover:bg-gray-50"
                  )}
                  title="更多筛选"
                >
                  <SlidersHorizontal size={18} />
                </button>
              </div>

              {/* 搜索条数：始终可见 */}
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">目标条数（会滚动页面尽量凑齐）</label>
                  <div className="flex gap-1 flex-wrap">
                    {COUNT_PRESETS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setMinCount(n);
                          setCustomCount("");
                        }}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-md border transition-colors",
                          minCount === n && !customCount
                            ? "bg-brand-50 border-brand-300 text-brand-700"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 sr-only">自定义条数</label>
                  <input
                    type="number"
                    min={5}
                    max={200}
                    placeholder="自定义"
                    value={customCount}
                    onChange={(e) => setCustomCount(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applyCustomCount()}
                    className="w-24 px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                  <button
                    type="button"
                    onClick={applyCustomCount}
                    className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50"
                  >
                    应用
                  </button>
                </div>
              </div>

              {showFilters && (
                <div className="mt-3 flex flex-wrap gap-4 pt-2 border-t border-gray-100">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">排序</label>
                    <div className="flex gap-1 flex-wrap">
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
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
                    <div className="flex gap-1 flex-wrap">
                      {TYPE_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
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
                      type="button"
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
            </>
          )}

          {mode === "home" && (
            <p className="text-sm text-gray-500">
              抓取小红书首页推荐流（需已登录）。点击「刷新列表」加载最新内容。
            </p>
          )}

          {feeds.length > 0 && (
            <p className="mt-2 text-xs text-gray-400">当前共 {feeds.length} 篇笔记</p>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin min-h-[280px]">
          {loading && (
            <div className="mb-6 flex flex-col items-center justify-center rounded-lg border border-gray-100 bg-gray-50 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
              <p className="mt-2 text-sm text-gray-500">
                {mode === "home" ? "正在加载首页推荐…" : "正在搜索小红书…"}
              </p>
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">
              {error}
            </div>
          )}

          {mode === "home" && !loading && feeds.length === 0 && !error && (
            <div className="text-center py-16 text-gray-400">
              <Home className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="mb-3">尚未加载首页推荐</p>
              <button
                type="button"
                onClick={() => loadHomeFeeds()}
                className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600"
              >
                加载首页推荐
              </button>
            </div>
          )}

          {mode === "search" && !loading && feeds.length === 0 && !error && (
            <div className="text-center py-20 text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>输入关键词开始搜索</p>
            </div>
          )}

          {!loading && (
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
          )}
        </div>
      </div>

      {selectedFeed && (
        <div className="w-full xl:w-96 border-t xl:border-t-0 xl:border-l border-gray-200 bg-white overflow-y-auto scrollbar-thin xl:max-h-[calc(100vh-2rem)] xl:sticky xl:top-0 xl:self-start shrink-0">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-medium text-sm">笔记详情</h3>
            <button
              type="button"
              onClick={() => setSelectedFeed(null)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="关闭笔记详情"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          <div className="p-4">
            <FeedDetailPanel feed={selectedFeed} onOpenLink={openLink} />
          </div>
        </div>
      )}
    </div>
  );
}

function FeedDetailPanel({
  feed,
  onOpenLink,
}: {
  feed: Record<string, unknown>;
  onOpenLink: (url: string) => void;
}) {
  const nc = (feed.noteCard ?? feed.note_card ?? feed) as Record<string, unknown>;
  const title = (nc.displayTitle ?? nc.display_title ?? nc.title ?? "") as string;
  const desc = (nc.desc ?? nc.description ?? "") as string;
  const user = nc.user as Record<string, unknown> | undefined;
  const nickname = (user?.nickname ?? user?.nickName ?? "") as string;
  const interact = nc.interactInfo as Record<string, unknown> | undefined;
  const link = getFeedLink(feed);
  const ids = getFeedIdAndToken(feed);

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailErr, setDetailErr] = useState("");
  const [fullDetail, setFullDetail] = useState<Record<string, unknown> | null>(null);
  const [loadComments, setLoadComments] = useState(true);

  const fetchDetail = async (options: {
    load_all_comments: boolean;
    limit?: number;
    click_more_replies?: boolean;
  }) => {
    if (!ids) {
      setDetailErr("缺少笔记 ID 或 xsec_token，无法拉取详情");
      return;
    }
    setLoadingDetail(true);
    setDetailErr("");
    try {
      const res = await api.feedDetail(ids.id, ids.xsec, {
        load_all_comments: options.load_all_comments,
        limit: options.limit ?? 30,
        click_more_replies: options.click_more_replies ?? false,
        reply_limit: 10,
      });
      setFullDetail(res);
    } catch (e) {
      setDetailErr(e instanceof Error ? e.message : "加载详情失败");
    } finally {
      setLoadingDetail(false);
    }
  };

  const detailObj = fullDetail?.detail as Record<string, unknown> | undefined;
  const commentLoading = fullDetail?.comment_loading as Record<string, unknown> | undefined;

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
        <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
          {interact.likedCount !== undefined && <span>点赞 {String(interact.likedCount)}</span>}
          {interact.commentCount !== undefined && <span>评论 {String(interact.commentCount)}</span>}
          {interact.collectedCount !== undefined && (
            <span>收藏 {String(interact.collectedCount)}</span>
          )}
          {interact.shareCount !== undefined && <span>分享 {String(interact.shareCount)}</span>}
        </div>
      )}

      {link && (
        <button
          type="button"
          onClick={() => onOpenLink(link)}
          className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 cursor-pointer"
        >
          <ExternalLink size={14} /> 在浏览器中查看原文
        </button>
      )}

      {ids && (
        <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-xs font-medium text-gray-700">服务端详情（含评论数据）</p>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={loadComments}
              onChange={(e) => setLoadComments(e.target.checked)}
            />
            滚动加载更多一级评论（较慢）
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loadingDetail}
              onClick={() => fetchDetail({ load_all_comments: false })}
              className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              {loadingDetail ? "加载中…" : "仅加载详情 JSON"}
            </button>
            <button
              type="button"
              disabled={loadingDetail}
              onClick={() =>
                fetchDetail({
                  load_all_comments: loadComments,
                  click_more_replies: false,
                })
              }
              className="px-2.5 py-1.5 text-xs bg-brand-500 text-white rounded-md hover:bg-brand-600 disabled:opacity-50"
            >
              {loadingDetail ? "加载中…" : loadComments ? "详情 + 评论" : "详情（不滚评论）"}
            </button>
          </div>
          {detailErr && <p className="text-xs text-red-600">{detailErr}</p>}
          {commentLoading && (
            <p className="text-xs text-gray-500">
              评论加载：{JSON.stringify(commentLoading).slice(0, 500)}
            </p>
          )}
        </div>
      )}

      {detailObj && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">详情摘录</p>
          <pre className="text-xs bg-white p-3 rounded-lg border overflow-x-auto max-h-72 overflow-y-auto text-gray-600">
            {JSON.stringify(detailObj, null, 2).slice(0, 12000)}
          </pre>
        </div>
      )}

      {!fullDetail && (
        <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto max-h-40 text-gray-500">
          {JSON.stringify(nc, null, 2).slice(0, 2000)}
        </pre>
      )}
    </div>
  );
}
