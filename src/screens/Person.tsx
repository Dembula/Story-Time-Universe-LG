import { useEffect, useState } from "react";
import { useNavigation, type PersonRoute } from "@/state/Navigation";
import { ViewerAPI } from "@/api/viewerApi";
import type { PersonPreview } from "@/api/types";
import { posterCandidates } from "@/api/mediaUrl";
import { RemoteImage } from "@/components/RemoteImage";
import { PosterCard } from "@/components/PosterCard";
import { useRemote } from "@/tv/useRemote";
import { profileColor } from "@/theme";

export function Person({ route }: { route: PersonRoute }) {
  const { openDetail, back } = useNavigation();
  const [person, setPerson] = useState<PersonPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useRemote({ onBack: back });

  useEffect(() => {
    void (async () => {
      try {
        let p: PersonPreview | null = null;
        if (route.personId) {
          p = await ViewerAPI.fetchPersonPreviewByPersonId(route.personId).catch(() => null);
        }
        if (!p && route.crewMemberId) {
          p = await ViewerAPI.fetchPersonPreviewByCrewId(route.crewMemberId);
        }
        if (!p) throw new Error("No profile is linked to this credit.");
        setPerson(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load this profile.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = person?.displayName ?? route.fallbackName;
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <div className="page page-pad-top person" data-scroll="page">
      <div className="person-head">
        <div className="person-avatar" style={{ background: profileColor(route.crewMemberId ?? name) }}>
          {person?.imageUrl ? (
            <RemoteImage urls={posterCandidates({ posterUrl: person.imageUrl })} className="poster-img" alt={name} />
          ) : (
            initials
          )}
        </div>
        <div className="person-meta">
          <h1 className="hero-title" style={{ fontSize: 56 }}>
            {name}
          </h1>
          {(person?.roles?.length || route.fallbackRole) && (
            <div className="hero-meta">{person?.roles?.join(" · ") ?? route.fallbackRole}</div>
          )}
          {person?.productionCount != null && (
            <div className="person-stat">{person.productionCount} productions</div>
          )}
          {(person?.bio || person?.blurb) && <p className="detail-synopsis">{person.bio ?? person.blurb}</p>}
        </div>
      </div>

      {person?.credits && person.credits.length > 0 && (
        <section className="detail-section">
          <h2 className="section-title">Known For</h2>
          <div className="row-scroller" data-scroll="row">
            {person.credits.map((credit, i) => (
              <PosterCard
                key={`${credit.contentId}-${credit.role}`}
                item={{
                  id: credit.contentId,
                  title: credit.title,
                  type: credit.type,
                  year: credit.year,
                  posterUrl: credit.posterUrl,
                }}
                onSelect={openDetail}
                autoFocus={i === 0}
              />
            ))}
          </div>
        </section>
      )}

      {error && <div className="error-text" style={{ margin: "40px var(--safe-x)" }}>{error}</div>}
    </div>
  );
}
