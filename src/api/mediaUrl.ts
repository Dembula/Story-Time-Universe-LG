import { AppConfig } from "@/config";

/**
 * Ordered image-URL resolution — ported from the iOS `MediaURL` helper so the
 * TV app renders the exact same artwork the web/mobile clients do. Callers get
 * a prioritised list of candidate URLs and fall back through them on error.
 */

const STREAM_HOSTS = ["videodelivery.net", "cloudflarestream.com"];

function trimmed(raw?: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  return t.length ? t : null;
}

function isNonImageMediaURL(raw: string): boolean {
  const lower = raw.toLowerCase();
  return (
    lower.includes("manifest/video") ||
    lower.endsWith(".m3u8") ||
    lower.endsWith(".mpd") ||
    lower.endsWith(".mp4") ||
    lower.includes("/iframe") ||
    lower.includes("/downloads/")
  );
}

function displayableHttpUrl(raw?: string | null): string | null {
  const t = trimmed(raw);
  if (!t) return null;
  const lower = t.toLowerCase();
  if (!lower.startsWith("http://") && !lower.startsWith("https://")) return null;
  if (isNonImageMediaURL(t)) return null;
  return t;
}

function siteRelativeUrl(raw?: string | null): string | null {
  const t = trimmed(raw);
  if (!t) return null;
  if (t.startsWith("/")) return `${AppConfig.apiBaseURL}${t}`;
  return null;
}

function previewProxyUrl(raw?: string | null): string | null {
  const t = trimmed(raw);
  if (!t) return null;
  const looksPrivate =
    t.startsWith("s3://") ||
    t.includes(".amazonaws.com/") ||
    t.includes("r2.cloudflarestorage.com") ||
    t.includes("storage.googleapis.com") ||
    (!t.toLowerCase().startsWith("http://") &&
      !t.toLowerCase().startsWith("https://") &&
      !t.startsWith("/"));
  if (!looksPrivate) return null;
  const url = new URL(`${AppConfig.apiBaseURL}/api/files/preview`);
  url.searchParams.set("ref", t);
  url.searchParams.set("context", "marketplace");
  return url.toString();
}

function extractStreamUid(videoUrl?: string | null): string | null {
  const v = trimmed(videoUrl);
  if (!v) return null;
  if (/^[a-fA-F0-9]{32}$/.test(v)) return v;
  let candidate = v;
  if (!/^https?:\/\//i.test(v) && STREAM_HOSTS.some((h) => v.includes(h))) {
    candidate = `https://${v}`;
  }
  try {
    const url = new URL(candidate);
    const host = url.host.toLowerCase();
    if (!STREAM_HOSTS.some((h) => host.includes(h))) return null;
    const first = url.pathname.split("/").filter(Boolean)[0];
    if (!first || first.includes(".")) return null;
    return first;
  } catch {
    return null;
  }
}

function streamThumbnailUrl(
  videoUrl?: string | null,
  time = "3s",
  height = 480,
  width?: number,
): string | null {
  const uid = extractStreamUid(videoUrl);
  if (!uid) return null;
  const url = new URL(`https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`);
  url.searchParams.set("time", time);
  url.searchParams.set("height", String(height));
  if (width) {
    url.searchParams.set("width", String(width));
    url.searchParams.set("fit", "crop");
  }
  return url.toString();
}

export interface MediaSource {
  posterUrl?: string | null;
  backdropUrl?: string | null;
  videoUrl?: string | null;
}

export function imageCandidates(
  source: MediaSource,
  preferBackdrop = false,
): string[] {
  const { posterUrl, backdropUrl, videoUrl } = source;
  const seen = new Set<string>();
  const result: string[] = [];
  const push = (url: string | null) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    result.push(url);
  };

  const primary = preferBackdrop ? backdropUrl : posterUrl;
  const secondary = preferBackdrop ? posterUrl : backdropUrl;
  const backdropKey = trimmed(backdropUrl)?.toLowerCase() ?? null;

  const posterOnly = (url: string | null): string | null => {
    if (!url) return null;
    if (backdropKey && url.toLowerCase() === backdropKey) return null;
    return url;
  };

  if (preferBackdrop) {
    push(displayableHttpUrl(primary));
    push(previewProxyUrl(primary));
    push(siteRelativeUrl(primary));
    push(streamThumbnailUrl(videoUrl, "5s", 720));
    push(displayableHttpUrl(secondary));
    push(previewProxyUrl(secondary));
    push(siteRelativeUrl(secondary));
  } else {
    push(posterOnly(displayableHttpUrl(primary)));
    push(posterOnly(previewProxyUrl(primary)));
    push(posterOnly(siteRelativeUrl(primary)));
    const hasPoster = !!trimmed(posterUrl);
    if (!hasPoster) push(streamThumbnailUrl(videoUrl, "2s", 480, 320));
  }

  return result.slice(0, 4);
}

export function posterCandidates(source: MediaSource): string[] {
  return imageCandidates(source, false);
}

export function backdropCandidates(source: MediaSource): string[] {
  const list = imageCandidates(source, true);
  return list.length ? list : posterCandidates(source);
}

/** Resolve a stream URL that may be site-relative (proxied HLS manifest). */
export function resolveStreamUrl(src?: string | null): string | null {
  const t = trimmed(src);
  if (!t) return null;
  if (t.startsWith("http")) return t;
  return `${AppConfig.apiBaseURL}${t.startsWith("/") ? "" : "/"}${t}`;
}
