import { useEffect, useRef, useState } from "react";
import { useNavigation } from "@/state/Navigation";
import { ViewerAPI } from "@/api/viewerApi";
import {
  ALL_HOME_ROWS,
  ALL_TRACKED_TYPE_VALUES,
  pluralTitle,
  type HomeCatalogRow,
} from "@/catalogue";
import type { ContentItem, ContinueWatchingItem } from "@/api/types";
import { Hero } from "@/components/Hero";
import { ContentRow } from "@/components/ContentRow";
import { useRemote } from "@/tv/useRemote";

export function Home() {
  const { openDetail, openPlayer, back } = useNavigation();
  const [featured, setFeatured] = useState<ContentItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [trending, setTrending] = useState<ContentItem[]>([]);
  const [rows, setRows] = useState<HomeCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  useRemote({ onBack: back });

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    const [f, t, cw, typeRows] = await Promise.all([
      ViewerAPI.fetchContent({ featured: true, limit: 8 }).catch(() => []),
      ViewerAPI.fetchContent({ limit: 24 }).catch(() => []),
      ViewerAPI.fetchContinueWatching().catch(() => []),
      fetchTypeRows(),
    ]);

    setFeatured(f.length ? f : t.slice(0, 5));
    setTrending(t);
    setContinueWatching(cw);
    setRows(mergeDiscovered(typeRows, [...t, ...f]));

    if (f.length === 0 && t.length === 0 && typeRows.every((r) => r.items.length === 0)) {
      setError("Could not load the catalogue. Please try again.");
    }
    setLoading(false);
  }

  async function fetchTypeRows(): Promise<HomeCatalogRow[]> {
    const results = await Promise.all(
      ALL_HOME_ROWS.map(async (def) => {
        const items = await ViewerAPI.fetchCatalogRow(def, 16);
        return { id: def.id, typeValue: def.typeValues[0] ?? def.id, title: def.title, items };
      }),
    );
    return results;
  }

  function mergeDiscovered(known: HomeCatalogRow[], sample: ContentItem[]): HomeCatalogRow[] {
    const rowsOut = [...known];
    const extras = new Map<string, ContentItem[]>();
    for (const item of sample) {
      const key = item.type?.trim().toUpperCase();
      if (!key || ALL_TRACKED_TYPE_VALUES.has(key)) continue;
      const list = extras.get(key) ?? [];
      list.push(item);
      extras.set(key, list);
    }
    for (const [typeValue, items] of [...extras.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      rowsOut.push({ id: typeValue, typeValue, title: pluralTitle(typeValue), items: items.slice(0, 16) });
    }
    return rowsOut;
  }

  if (loading) {
    return (
      <div className="page">
        <div className="center-stage">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page" data-scroll="page">
      {featured.length > 0 && (
        <Hero
          items={featured}
          onPlay={(item) => openPlayer({ contentId: item.id, title: item.title })}
          onInfo={openDetail}
        />
      )}

      <div className="rows">
        {continueWatching.length > 0 && (
          <ContentRow
            title="Continue Watching"
            items={continueWatching}
            onSelect={(item) => openPlayer({ contentId: item.id, title: item.title })}
            progressFor={(item) => {
              const cw = continueWatching.find((c) => c.id === item.id);
              if (!cw) return undefined;
              if (cw.progressPercent != null) return cw.progressPercent / 100;
              const pos = cw.positionSeconds ?? 0;
              const dur = cw.durationSeconds ?? cw.duration ?? 0;
              return dur > 0 ? pos / dur : undefined;
            }}
          />
        )}

        <ContentRow title="Trending Now" items={trending} onSelect={openDetail} />

        {rows
          .filter((r) => r.items.length > 0)
          .map((row) => (
            <ContentRow key={row.id} title={row.title} items={row.items} onSelect={openDetail} />
          ))}

        {error && <div className="error-text" style={{ margin: "0 var(--safe-x)" }}>{error}</div>}
      </div>

      <div style={{ height: 60 }} />
    </div>
  );
}
