import { useEffect, useRef, useState } from "react";
import { useNavigation } from "@/state/Navigation";
import { ViewerAPI } from "@/api/viewerApi";
import type { SearchResult } from "@/api/types";
import { posterCandidates } from "@/api/mediaUrl";
import { RemoteImage } from "@/components/RemoteImage";
import { useFocusable } from "@/tv/useFocusable";
import { useRemote } from "@/tv/useRemote";
import { displayType } from "@/catalogue";

export function Search() {
  const { openDetail, back } = useNavigation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<number | null>(null);

  useRemote({ onBack: back });

  const field = useFocusable<HTMLDivElement>({
    autoFocus: true,
    onEnter: () => inputRef.current?.focus(),
  });

  useEffect(() => {
    if (debounce.current) window.clearTimeout(debounce.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounce.current = window.setTimeout(async () => {
      const res = await ViewerAPI.search(query).catch(() => []);
      setResults(res);
      setSearching(false);
    }, 350);
    return () => {
      if (debounce.current) window.clearTimeout(debounce.current);
    };
  }, [query]);

  return (
    <div className="page page-pad-top search" data-scroll="page">
      <h1 className="screen-title">Search</h1>

      <div
        ref={field.ref}
        className={`search-field tv-focusable ${field.focused ? "tv-focused" : ""}`}
        onClick={() => inputRef.current?.focus()}
      >
        <span className="search-ico">⌕</span>
        <input
          ref={inputRef}
          value={query}
          placeholder="Search films, series, people…"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {searching && <div className="spinner" style={{ margin: "40px var(--safe-x)" }} />}

      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <div className="empty-note">No results for “{query}”.</div>
      )}

      <div className="grid" data-scroll="row">
        {results.map((r) => (
          <SearchCard
            key={r.id}
            result={r}
            onSelect={() =>
              openDetail({
                id: r.id,
                title: r.title,
                type: r.type,
                category: r.category,
                year: r.year,
                posterUrl: r.posterUrl,
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

function SearchCard({ result, onSelect }: { result: SearchResult; onSelect: () => void }) {
  const { ref, focused } = useFocusable<HTMLDivElement>({ onEnter: onSelect });
  return (
    <div className="poster-card-wrap">
      <div
        ref={ref}
        onClick={onSelect}
        className={`poster-card tv-focusable focus-ring ${focused ? "tv-focused" : ""}`}
      >
        <RemoteImage
          urls={posterCandidates({ posterUrl: result.posterUrl })}
          className="poster-img"
          alt={result.title}
          fallback={<div className="poster-fallback">{result.title}</div>}
        />
      </div>
      <div className="poster-meta">
        <div className="poster-title">{result.title}</div>
        <div className="poster-sub">{displayType(result.type)}</div>
      </div>
    </div>
  );
}
