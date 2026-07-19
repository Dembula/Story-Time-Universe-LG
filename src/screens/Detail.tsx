import { useEffect, useMemo, useState } from "react";
import { useNavigation } from "@/state/Navigation";
import { ViewerAPI } from "@/api/viewerApi";
import type {
  ContentDetail,
  ContentItem,
  CrewCredit,
  EpisodePlaybackInfo,
} from "@/api/types";
import { backdropCandidates, posterCandidates } from "@/api/mediaUrl";
import { displayType } from "@/catalogue";
import { RemoteImage } from "@/components/RemoteImage";
import { FocusButton } from "@/components/FocusButton";
import { PosterCard } from "@/components/PosterCard";
import { useFocusable } from "@/tv/useFocusable";
import { useRemote } from "@/tv/useRemote";
import { profileColor } from "@/theme";

interface DetailProps {
  contentId: string;
  seed?: ContentItem;
}

export function Detail({ contentId, seed }: DetailProps) {
  const { openPlayer, openDetail, openPerson, back } = useNavigation();
  const [detail, setDetail] = useState<ContentDetail | null>(null);
  const [crew, setCrew] = useState<CrewCredit[]>([]);
  const [related, setRelated] = useState<ContentItem[]>([]);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useRemote({ onBack: back });

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId]);

  async function load() {
    try {
      const loaded = await ViewerAPI.fetchContentDetail(contentId);
      setDetail(loaded);
      const [crewData, relatedData, list] = await Promise.all([
        ViewerAPI.fetchCrew(contentId).catch(() => []),
        ViewerAPI.fetchRelated({
          excludingId: contentId,
          category: loaded.category,
          type: loaded.type,
          limit: 12,
        }).catch(() => []),
        ViewerAPI.fetchWatchlist().catch(() => []),
      ]);
      setCrew(crewData);
      setRelated(relatedData);
      setInWatchlist(list.some((c) => c.id === contentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this title.");
    }
  }

  const title = detail?.title ?? seed?.title ?? "";
  const heroUrls = useMemo(() => {
    if (detail) {
      const b = backdropCandidates(detail);
      if (b.length) return b;
    }
    if (seed) {
      const b = backdropCandidates(seed);
      if (b.length) return b;
    }
    return detail ? posterCandidates(detail) : seed ? posterCandidates(seed) : [];
  }, [detail, seed]);

  const episodes: EpisodePlaybackInfo[] = useMemo(() => {
    if (!detail?.seasons) return [];
    const list: EpisodePlaybackInfo[] = [];
    for (const season of detail.seasons) {
      const sNum = season.seasonNumber ?? 1;
      for (const ep of season.episodes ?? []) {
        const eNum = ep.episodeNumber ?? list.length + 1;
        list.push({
          episodeId: ep.id,
          title: ep.title ?? `Episode ${eNum}`,
          episodeLabel: `S${sNum} E${eNum}`,
          thumbnailUrl: ep.thumbnailUrl,
          durationSeconds: ep.duration,
        });
      }
    }
    return list;
  }, [detail]);

  const hasTrailer = !!(detail?.trailerUrl && detail.trailerUrl.trim());
  const firstEpisodeId = detail?.seasons?.[0]?.episodes?.[0]?.id;

  const meta = [
    displayType(detail?.type ?? seed?.type),
    detail?.category ?? seed?.category,
    (detail?.year ?? seed?.year) ? String(detail?.year ?? seed?.year) : null,
    runtimeLabel(detail?.duration),
    detail?.ageRating,
    detail?.creator?.name ? `By ${detail.creator.name}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const play = () => openPlayer({ contentId, title, episodeId: firstEpisodeId, episodes });
  const playTrailer = () => openPlayer({ contentId, title, isTrailer: true });

  async function toggleWatchlist() {
    setWatchlistBusy(true);
    try {
      await ViewerAPI.updateWatchlist(contentId, !inWatchlist);
      setInWatchlist((v) => !v);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update My List.");
    } finally {
      setWatchlistBusy(false);
    }
  }

  return (
    <div className="page detail" data-scroll="page">
      <div className="detail-hero">
        <div className="hero-bg">
          <RemoteImage urls={heroUrls} className="poster-img" alt="" />
        </div>
        <div className="detail-hero-scrim" />
        <div className="detail-hero-content">
          <h1 className="hero-title">{title}</h1>
          {meta && <div className="hero-meta">{meta}</div>}
          {detail?.ratingStats && (detail.ratingStats.count ?? 0) > 0 && (
            <div className="rating-row">
              <span className="star">★</span>
              {(detail.ratingStats.average ?? 0).toFixed(1)}
              <span className="rating-count">({detail.ratingStats.count})</span>
            </div>
          )}
          <div className="hero-actions">
            <FocusButton onEnter={play} className="btn btn-primary" autoFocus>
              <span className="btn-ico">▶</span> Play
            </FocusButton>
            {hasTrailer && (
              <FocusButton onEnter={playTrailer} className="btn btn-secondary" ariaLabel="Play trailer">
                <span className="btn-ico">🎬</span> Trailer
              </FocusButton>
            )}
            <FocusButton
              onEnter={() => void toggleWatchlist()}
              className="btn btn-secondary btn-circle"
              disabled={watchlistBusy}
              ariaLabel={inWatchlist ? "In My List" : "Add to My List"}
            >
              {inWatchlist ? "✓" : "+"}
            </FocusButton>
          </div>
        </div>
      </div>

      <div className="detail-body">
        {(detail?.description ?? seed?.description) && (
          <p className="detail-synopsis">{detail?.description ?? seed?.description}</p>
        )}

        {episodes.length > 0 && detail?.seasons && (
          <section className="detail-section">
            <h2 className="section-title">Episodes</h2>
            {detail.seasons.map((season) => (
              <div key={season.id ?? `s${season.seasonNumber}`} className="season-block">
                <h3 className="season-title">Season {season.seasonNumber ?? 1}</h3>
                {(season.episodes ?? []).map((ep) => (
                  <EpisodeRow
                    key={ep.id}
                    number={ep.episodeNumber ?? 0}
                    title={ep.title ?? "Episode"}
                    description={ep.description}
                    duration={ep.duration}
                    thumbUrls={posterCandidates({ posterUrl: ep.thumbnailUrl, videoUrl: ep.videoUrl })}
                    onPlay={() => openPlayer({ contentId, title, episodeId: ep.id, episodes })}
                  />
                ))}
              </div>
            ))}
          </section>
        )}

        {crew.length > 0 && (
          <section className="detail-section">
            <div className="section-head">
              <h2 className="section-title">Cast &amp; Crew</h2>
              <span className="pill">{crew.length} credited</span>
            </div>
            <div className="row-scroller" data-scroll="row">
              {crew.map((member) => (
                <CastCard
                  key={member.id}
                  member={member}
                  onSelect={() =>
                    openPerson({
                      personId: member.creditPersonId,
                      crewMemberId: member.id,
                      fallbackName: member.name,
                      fallbackRole: member.role,
                    })
                  }
                />
              ))}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="detail-section">
            <h2 className="section-title">More Like This</h2>
            <div className="row-scroller" data-scroll="row">
              {related.map((item) => (
                <PosterCard key={item.id} item={item} onSelect={openDetail} />
              ))}
            </div>
          </section>
        )}

        {(detail?.btsVideos?.length ?? 0) > 0 && (
          <section className="detail-section">
            <h2 className="section-title">Behind the Scenes</h2>
            <div className="row-scroller" data-scroll="row">
              {detail!.btsVideos!.map((video) => (
                <div key={video.id} className="bts-card">
                  <RemoteImage
                    urls={posterCandidates({ posterUrl: video.thumbnail, videoUrl: video.videoUrl })}
                    className="bts-thumb"
                    alt={video.title ?? ""}
                  />
                  <div className="bts-title">{video.title ?? "Behind the Scenes"}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {error && <div className="error-text">{error}</div>}
      </div>
    </div>
  );
}

function EpisodeRow({
  number,
  title,
  description,
  duration,
  thumbUrls,
  onPlay,
}: {
  number: number;
  title: string;
  description?: string | null;
  duration?: number | null;
  thumbUrls: string[];
  onPlay: () => void;
}) {
  const { ref, focused } = useFocusable<HTMLDivElement>({ onEnter: onPlay });
  return (
    <div
      ref={ref}
      onClick={onPlay}
      className={`episode-row tv-focusable focus-lift ${focused ? "tv-focused" : ""}`}
    >
      <div className="episode-thumb">
        <RemoteImage urls={thumbUrls} className="poster-img" alt={title} />
        <span className="episode-play">▶</span>
      </div>
      <div className="episode-info">
        <div className="episode-title">
          {number}. {title}
        </div>
        {description && <div className="episode-desc">{description}</div>}
        {!!duration && duration > 0 && <div className="episode-dur">{duration} min</div>}
      </div>
    </div>
  );
}

function CastCard({ member, onSelect }: { member: CrewCredit; onSelect: () => void }) {
  const { ref, focused } = useFocusable<HTMLDivElement>({ onEnter: onSelect });
  const initials = member.name
    .split(" ")
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase();
  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={`cast-card tv-focusable focus-lift ${focused ? "tv-focused" : ""}`}
    >
      <div className="cast-avatar" style={{ background: profileColor(member.id) }}>
        {initials}
      </div>
      <div className="cast-name">{member.name}</div>
      <div className="cast-role">{member.role ?? "Crew"}</div>
    </div>
  );
}

function runtimeLabel(duration?: number | null): string | null {
  if (!duration || duration <= 0) return null;
  const hours = Math.floor(duration / 60);
  const mins = duration % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;
}
