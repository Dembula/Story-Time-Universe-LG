import { useFocusable } from "@/tv/useFocusable";
import { RemoteImage } from "./RemoteImage";
import { posterCandidates } from "@/api/mediaUrl";
import { displayType } from "@/catalogue";
import type { ContentItem } from "@/api/types";

interface PosterCardProps {
  item: ContentItem;
  onSelect: (item: ContentItem) => void;
  onFocus?: (item: ContentItem) => void;
  /** 0..1 progress bar shown under the poster (Continue Watching). */
  progress?: number;
  showTitle?: boolean;
  autoFocus?: boolean;
}

export function PosterCard({
  item,
  onSelect,
  onFocus,
  progress,
  showTitle = true,
  autoFocus,
}: PosterCardProps) {
  const { ref, focused } = useFocusable<HTMLDivElement>({
    onEnter: () => onSelect(item),
    onFocus: () => onFocus?.(item),
    autoFocus,
  });

  const urls = posterCandidates(item);

  return (
    <div className="poster-card-wrap">
      <div
        ref={ref}
        role="button"
        tabIndex={-1}
        onClick={() => onSelect(item)}
        className={`poster-card tv-focusable focus-ring ${focused ? "tv-focused" : ""}`}
      >
        <RemoteImage
          urls={urls}
          alt={item.title}
          className="poster-img"
          fallback={
            <div className="poster-fallback">
              <span>{item.title}</span>
            </div>
          }
        />
        {typeof progress === "number" && progress > 0 && (
          <div className="poster-progress">
            <div className="poster-progress-fill" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
        )}
      </div>
      {showTitle && (
        <div className="poster-meta">
          <div className="poster-title">{item.title}</div>
          <div className="poster-sub">{displayType(item.type)}</div>
        </div>
      )}
    </div>
  );
}
