import { PosterCard } from "./PosterCard";
import type { ContentItem } from "@/api/types";

interface ContentRowProps {
  title: string;
  items: ContentItem[];
  onSelect: (item: ContentItem) => void;
  onFocusItem?: (item: ContentItem) => void;
  progressFor?: (item: ContentItem) => number | undefined;
}

export function ContentRow({ title, items, onSelect, onFocusItem, progressFor }: ContentRowProps) {
  if (items.length === 0) return null;
  return (
    <section className="content-row">
      <h2 className="row-title">{title}</h2>
      <div className="row-scroller" data-scroll="row">
        {items.map((item) => (
          <PosterCard
            key={item.id}
            item={item}
            onSelect={onSelect}
            onFocus={onFocusItem}
            progress={progressFor?.(item)}
          />
        ))}
      </div>
    </section>
  );
}
