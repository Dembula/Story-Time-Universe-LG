import { useEffect, useState } from "react";
import type { ContentItem } from "@/api/types";
import { backdropCandidates } from "@/api/mediaUrl";
import { displayType } from "@/catalogue";
import { RemoteImage } from "./RemoteImage";
import { FocusButton } from "./FocusButton";

interface HeroProps {
  items: ContentItem[];
  onPlay: (item: ContentItem) => void;
  onInfo: (item: ContentItem) => void;
}

export function Hero({ items, onPlay, onInfo }: HeroProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), 9000);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;
  const item = items[index % items.length];

  const meta = [displayType(item.type), item.category, item.year ? String(item.year) : null]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div className="hero">
      <div className="hero-bg">
        <RemoteImage key={item.id} urls={backdropCandidates(item)} className="poster-img fade-in" alt="" />
      </div>
      <div className="hero-scrim" />

      <div className="hero-content">
        <div className="hero-kicker">Featured</div>
        <h1 className="hero-title">{item.title}</h1>
        {meta && <div className="hero-meta">{meta}</div>}
        {item.description && <p className="hero-desc">{item.description}</p>}
        <div className="hero-actions">
          <FocusButton onEnter={() => onPlay(item)} className="btn btn-primary" autoFocus>
            <span className="btn-ico">▶</span> Play
          </FocusButton>
          <FocusButton onEnter={() => onInfo(item)} className="btn btn-secondary">
            <span className="btn-ico">ⓘ</span> More Info
          </FocusButton>
        </div>
      </div>

      {items.length > 1 && (
        <div className="hero-dots">
          {items.map((it, i) => (
            <span key={it.id} className={`hero-dot ${i === index ? "active" : ""}`} />
          ))}
        </div>
      )}
    </div>
  );
}
