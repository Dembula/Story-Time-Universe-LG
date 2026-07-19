import { useEffect, useState } from "react";

interface RemoteImageProps {
  urls: string[];
  alt?: string;
  className?: string;
  /** Rendered when no candidate loads. */
  fallback?: React.ReactNode;
}

/**
 * Tries each candidate URL in order, falling through on error — mirrors the
 * iOS `RemoteImage` so artwork resolves the same way across S3 / Stream / proxy.
 */
export function RemoteImage({ urls, alt = "", className, fallback }: RemoteImageProps) {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const urlsKey = urls.join("|");

  useEffect(() => {
    setIndex(0);
    setLoaded(false);
  }, [urlsKey]);

  const src = urls[index];
  const exhausted = !src || (index >= urls.length && !loaded);

  if (exhausted && !loaded) {
    return <>{fallback ?? <div className={className} style={{ background: "var(--card)" }} />}</>;
  }

  return (
    <>
      {!loaded && (fallback ?? <div className={className} style={{ background: "var(--card)" }} />)}
      <img
        key={src}
        src={src}
        alt={alt}
        className={className}
        style={{ display: loaded ? undefined : "none" }}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (index < urls.length - 1) {
            setIndex((i) => i + 1);
            setLoaded(false);
          } else {
            setLoaded(false);
            setIndex(urls.length); // exhausted
          }
        }}
      />
    </>
  );
}
