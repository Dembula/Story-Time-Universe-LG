import type { ContentItem } from "@/api/types";

/**
 * Home-row catalogue definitions — ported from the iOS `CatalogueTypes`, which
 * itself mirrors the production `src/lib/content-types.ts`. Rows fill in as
 * creators upload; no app update is needed when new content arrives.
 */
export interface RowDefinition {
  id: string;
  typeValues: string[];
  categoryFilter?: string;
  title: string;
}

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  MOVIE: "Movie",
  DOCUMENTARY: "Documentary",
  SHORT_FILM: "Short Film",
  SERIES: "Series",
  SHOW: "Show",
  PODCAST: "Podcast",
  COMEDY_SKIT: "Comedy Skit",
  STAND_UP: "Stand-Up",
  ANIMATION: "Animation",
  SPORTS: "Sports",
  MUSIC_VIDEO: "Music Video",
  LIVE_EVENT: "Live Event",
  REALITY: "Reality",
  NEWS: "News",
  EDUCATIONAL: "Educational",
  WEB_SERIES: "Web Series",
};

const CONTENT_TYPE_PLURAL: Record<string, string> = {
  MOVIE: "Movies",
  SERIES: "Series",
  SHOW: "Shows",
  DOCUMENTARY: "Documentaries",
  SHORT_FILM: "Short Films",
  PODCAST: "Podcasts",
  COMEDY_SKIT: "Comedy Skits",
  STAND_UP: "Stand-Up",
  ANIMATION: "Animation",
  SPORTS: "Sports",
  MUSIC_VIDEO: "Music Videos",
  LIVE_EVENT: "Live Events",
  REALITY: "Reality",
  WEB_SERIES: "Web Series",
  NEWS: "News",
  EDUCATIONAL: "Educational",
};

export const LONG_FORM_TYPES = new Set(["SERIES", "SHOW", "PODCAST", "WEB_SERIES", "REALITY", "NEWS"]);

export const ALL_CATALOGUE_TYPE_VALUES = [
  "MOVIE", "SERIES", "SHOW", "DOCUMENTARY", "SHORT_FILM", "PODCAST",
  "COMEDY_SKIT", "STAND_UP", "ANIMATION", "SPORTS", "MUSIC_VIDEO",
  "LIVE_EVENT", "REALITY", "WEB_SERIES", "NEWS", "EDUCATIONAL",
];

export const PRIMARY_HOME_ROWS: RowDefinition[] = [
  { id: "MOVIE", typeValues: ["MOVIE"], title: "Movies" },
  { id: "SERIES", typeValues: ["SERIES"], title: "Series" },
  { id: "ANIMATION", typeValues: ["ANIMATION"], title: "Animation" },
  { id: "SPORTS", typeValues: ["SPORTS"], title: "Sports" },
  { id: "COMEDY", typeValues: ["COMEDY_SKIT", "STAND_UP"], title: "Comedy" },
  { id: "DOCUMENTARY", typeValues: ["DOCUMENTARY"], title: "Documentaries" },
  { id: "SHOW", typeValues: ["SHOW"], title: "Shows" },
  { id: "PODCAST", typeValues: ["PODCAST"], title: "Podcasts" },
];

export const SECONDARY_HOME_ROWS: RowDefinition[] = [
  { id: "LIVE_EVENT", typeValues: ["LIVE_EVENT"], title: "Live Events" },
  { id: "COMEDY_SHOWS", typeValues: ["SHOW"], categoryFilter: "Comedy", title: "Comedy Shows" },
  { id: "SHORT_FILM", typeValues: ["SHORT_FILM"], title: "Short Films" },
  { id: "MUSIC_VIDEO", typeValues: ["MUSIC_VIDEO"], title: "Music Videos" },
  { id: "REALITY", typeValues: ["REALITY"], title: "Reality" },
  { id: "WEB_SERIES", typeValues: ["WEB_SERIES"], title: "Web Series" },
  { id: "NEWS", typeValues: ["NEWS"], title: "News" },
  { id: "EDUCATIONAL", typeValues: ["EDUCATIONAL"], title: "Educational" },
];

export const ALL_HOME_ROWS = [...PRIMARY_HOME_ROWS, ...SECONDARY_HOME_ROWS];

export const ALL_TRACKED_TYPE_VALUES = new Set<string>([
  ...ALL_HOME_ROWS.flatMap((r) => r.typeValues),
  ...ALL_CATALOGUE_TYPE_VALUES,
]);

export function pluralTitle(typeValue: string): string {
  if (CONTENT_TYPE_PLURAL[typeValue]) return CONTENT_TYPE_PLURAL[typeValue];
  const raw = CONTENT_TYPE_LABELS[typeValue];
  if (raw) return raw;
  return typeValue
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isLongForm(type?: string | null): boolean {
  if (!type) return false;
  return LONG_FORM_TYPES.has(type.toUpperCase());
}

export function displayType(type?: string | null): string {
  return (type ?? "TITLE")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface HomeCatalogRow {
  id: string;
  typeValue: string;
  title: string;
  items: ContentItem[];
}
