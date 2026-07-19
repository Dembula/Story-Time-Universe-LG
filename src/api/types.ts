/**
 * API response types — mirror the production backend contracts consumed by the
 * iOS/Android viewer clients (see `Story-Time-Production/src/app/api/...`).
 */

export interface SessionUser {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
}

export interface AuthSession {
  user?: SessionUser | null;
  expires?: string | null;
}

export interface ViewerProfile {
  id: string;
  name: string;
  age: number;
  dateOfBirth?: string | null;
  updatedAt?: string | null;
  pinEnabled?: boolean | null;
}

export interface ProfilesResponse {
  profiles: ViewerProfile[];
}

export interface ActiveProfileResponse {
  profile?: ViewerProfile | null;
  ok?: boolean;
  error?: string;
  requiresPin?: boolean;
  paymentRequired?: boolean;
}

export interface ContentItem {
  id: string;
  title: string;
  description?: string | null;
  type?: string | null;
  category?: string | null;
  year?: number | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  trailerUrl?: string | null;
  videoUrl?: string | null;
  duration?: number | null;
  featured?: boolean | null;
  tags?: string | null;
  minAge?: number | null;
}

export interface ContinueWatchingItem extends ContentItem {
  positionSeconds?: number | null;
  durationSeconds?: number | null;
  progressPercent?: number | null;
}

export interface CreatorInfo {
  id?: string | null;
  name?: string | null;
  image?: string | null;
}

export interface RatingStats {
  average?: number | null;
  count?: number | null;
}

export interface Episode {
  id: string;
  title?: string | null;
  description?: string | null;
  episodeNumber?: number | null;
  duration?: number | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
}

export interface Season {
  id?: string | null;
  seasonNumber?: number | null;
  title?: string | null;
  episodes?: Episode[] | null;
}

export interface BtsVideo {
  id: string;
  title?: string | null;
  videoUrl?: string | null;
  thumbnail?: string | null;
}

export interface CrewCredit {
  id: string;
  name: string;
  role?: string | null;
  bio?: string | null;
  creditPersonId?: string | null;
}

export interface ContentDetail extends ContentItem {
  language?: string | null;
  country?: string | null;
  ageRating?: string | null;
  creator?: CreatorInfo | null;
  ratingStats?: RatingStats | null;
  seasons?: Season[] | null;
  btsVideos?: BtsVideo[] | null;
}

export interface PlaybackSource {
  src?: string | null;
  type?: string | null;
}

export interface SubtitleTrack {
  id: string;
  language?: string | null;
  label?: string | null;
  vttUrl?: string | null;
  isDefault?: boolean | null;
}

export interface PlaybackBundle {
  id?: string | null;
  title?: string | null;
  playback?: PlaybackSource | null;
  posterUrl?: string | null;
  duration?: number | null;
  subtitles?: SubtitleTrack[] | null;
}

export interface WatchlistRow {
  id?: string | null;
  contentId?: string | null;
  content?: ContentItem | null;
}

export interface SearchResult {
  id: string;
  title: string;
  type?: string | null;
  category?: string | null;
  year?: number | null;
  posterUrl?: string | null;
  creatorName?: string | null;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface ViewerSubscription {
  id?: string | null;
  plan?: string | null;
  status?: string | null;
  viewerModel?: string | null;
  profileLimit?: number | null;
  deviceCount?: number | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean | null;
}

export interface SubscriptionResponse {
  subscription?: ViewerSubscription | null;
}

export interface WatchProgress {
  positionSeconds?: number | null;
  durationSeconds?: number | null;
  updatedAt?: string | null;
}

export interface ApiErrorBody {
  error?: string;
  requiresPin?: boolean;
  paymentRequired?: boolean;
}

export interface EpisodePlaybackInfo {
  episodeId: string;
  title: string;
  episodeLabel: string;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
}

/** Person / credits (matches web PersonPreview). */
export interface PersonPreview {
  personId: string;
  displayName: string;
  imageUrl?: string | null;
  roles?: string[] | null;
  bio?: string | null;
  blurb?: string | null;
  productionCount?: number | null;
  followerCount?: number | null;
  followingCount?: number | null;
  verified?: boolean | null;
  topGenres?: string[] | null;
  credits?: PersonCredit[] | null;
}

export interface PersonCredit {
  contentId: string;
  title: string;
  type?: string | null;
  role: string;
  posterUrl?: string | null;
  year?: number | null;
}
