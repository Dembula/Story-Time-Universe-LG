import { useEffect, useRef, useState } from "react";
import { useNavigation } from "@/state/Navigation";
import { ViewerAPI } from "@/api/viewerApi";
import type { ContentItem } from "@/api/types";
import { PosterCard } from "@/components/PosterCard";
import { useRemote } from "@/tv/useRemote";

export function MyList() {
  const { openDetail, back } = useNavigation();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const loaded = useRef(false);

  useRemote({ onBack: back });

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void (async () => {
      const list = await ViewerAPI.fetchWatchlist().catch(() => []);
      setItems(list);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="page page-pad-top mylist" data-scroll="page">
      <h1 className="screen-title">My List</h1>

      {loading ? (
        <div className="spinner" style={{ margin: "40px var(--safe-x)" }} />
      ) : items.length === 0 ? (
        <div className="empty-note">
          Your list is empty. Add films and series with the + button to watch them later.
        </div>
      ) : (
        <div className="grid" data-scroll="row">
          {items.map((item, i) => (
            <PosterCard key={item.id} item={item} onSelect={openDetail} autoFocus={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
