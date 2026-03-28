import { cn } from "@/lib/utils";
import { Heart, MessageCircle, Star, ExternalLink } from "lucide-react";

interface FeedCardProps {
  feed: Record<string, unknown>;
  onClick?: () => void;
  selected?: boolean;
  showScore?: boolean;
}

function extractField(feed: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (feed[key] !== undefined) return feed[key];
    const nc = (feed.noteCard ?? feed.note_card) as Record<string, unknown> | undefined;
    if (nc && nc[key] !== undefined) return nc[key];
  }
  return undefined;
}

function extractImage(feed: Record<string, unknown>): string | null {
  const nc = (feed.noteCard ?? feed.note_card ?? feed) as Record<string, unknown>;
  const cover = nc.cover as Record<string, unknown> | undefined;
  if (cover) {
    const info = (cover.infoList ?? cover.info_list) as Array<Record<string, unknown>> | undefined;
    if (info && info.length > 0) {
      return (info[0].url as string) || null;
    }
    if (cover.url) return cover.url as string;
    if (cover.urlDefault) return cover.urlDefault as string;
  }
  return null;
}

export function FeedCard({ feed, onClick, selected, showScore }: FeedCardProps) {
  const nc = (feed.noteCard ?? feed.note_card ?? feed) as Record<string, unknown>;
  const title = (nc.displayTitle ?? nc.display_title ?? nc.title ?? "") as string;
  const user = nc.user as Record<string, unknown> | undefined;
  const nickname = (user?.nickname ?? user?.nickName ?? "") as string;
  const likes = (nc.interactInfo as Record<string, unknown>)?.likedCount as string | undefined;
  const imgUrl = extractImage(feed);
  const score = feed.ai_score as number | undefined;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group rounded-xl overflow-hidden bg-white border cursor-pointer transition-all hover:shadow-md",
        selected ? "border-brand-400 ring-2 ring-brand-100" : "border-gray-200"
      )}
    >
      {imgUrl && (
        <div className="aspect-[4/3] overflow-hidden bg-gray-100">
          <img
            src={imgUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      <div className="p-3">
        <h3 className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug">
          {title || "无标题"}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500 truncate max-w-[60%]">
            {nickname}
          </span>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {likes && (
              <span className="flex items-center gap-0.5">
                <Heart size={12} /> {likes}
              </span>
            )}
          </div>
        </div>
        {showScore && score !== undefined && (
          <div className="mt-2 flex items-center gap-1.5">
            <Star size={14} className="text-amber-500 fill-amber-500" />
            <span className="text-sm font-semibold text-amber-700">
              {typeof score === "number" ? score.toFixed(1) : score}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
