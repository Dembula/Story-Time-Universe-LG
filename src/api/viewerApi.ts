import { apiClient, ApiError } from "./client";
import type {
  ActiveProfileResponse,
  ContentDetail,
  ContentItem,
  ContinueWatchingItem,
  CrewCredit,
  PersonPreview,
  PlaybackBundle,
  ProfilesResponse,
  SearchResponse,
  SearchResult,
  SubscriptionResponse,
  ViewerProfile,
  ViewerSubscription,
  WatchProgress,
  WatchlistRow,
} from "./types";
import type { RowDefinition } from "@/catalogue";

/**
 * Complete viewer API surface — a 1:1 port of the iOS `ViewerAPI` actor so the
 * TV app talks to the exact same production endpoints for browsing, playback,
 * trailers, credits, watch progress, My List and search.
 */
export const ViewerAPI = {
  // MARK: Profiles ----------------------------------------------------------

  async fetchProfiles(): Promise<ViewerProfile[]> {
    const res = await apiClient.request("api/viewer/profiles");
    if (res.status !== 200) throw apiClient.parseError(res.data, res.status);
    return (res.data as ProfilesResponse).profiles ?? [];
  },

  async activateProfile(id: string, pin?: string): Promise<ViewerProfile> {
    const body: Record<string, unknown> = { profileId: id };
    if (pin) body.pin = pin;
    const res = await apiClient.request("api/viewer/profiles/active", {
      method: "POST",
      jsonBody: body,
    });
    const data = res.data as ActiveProfileResponse;
    if (res.status === 402) throw apiClient.parseError(res.data, res.status);
    if (res.status === 401 || res.status === 403) {
      if (data?.requiresPin) throw new ApiError("server", data.error ?? "PIN required", res.status);
      throw apiClient.parseError(res.data, res.status);
    }
    if (!res.ok) throw apiClient.parseError(res.data, res.status);
    if (!data.profile) throw new ApiError("server", data.error ?? "Failed to select profile");
    return data.profile;
  },

  async createProfile(params: {
    name: string;
    birthYear: number;
    birthMonth: number;
    birthDay: number;
    pin?: string;
  }): Promise<ViewerProfile> {
    const body: Record<string, unknown> = {
      name: params.name,
      birthYear: params.birthYear,
      birthMonth: params.birthMonth,
      birthDay: params.birthDay,
    };
    if (params.pin && params.pin.length === 4) {
      body.pinEnabled = true;
      body.pin = params.pin;
    }
    const res = await apiClient.request("api/viewer/profiles", { method: "POST", jsonBody: body });
    if (!res.ok) throw apiClient.parseError(res.data, res.status);
    return (res.data as { profile: ViewerProfile }).profile;
  },

  // MARK: Catalogue ---------------------------------------------------------

  async fetchContent(params: {
    type?: string;
    featured?: boolean;
    category?: string;
    limit?: number;
  } = {}): Promise<ContentItem[]> {
    const res = await apiClient.request("api/content", {
      query: {
        limit: params.limit ?? 20,
        type: params.type,
        featured: params.featured ? "true" : undefined,
        category: params.category,
      },
    });
    if (res.status !== 200) throw apiClient.parseError(res.data, res.status);
    return Array.isArray(res.data) ? (res.data as ContentItem[]) : [];
  },

  /** One Home row that may span multiple `type` values (e.g. Comedy). */
  async fetchCatalogRow(def: RowDefinition, limit = 16): Promise<ContentItem[]> {
    if (def.typeValues.length === 1 && !def.categoryFilter) {
      return this.fetchContent({ type: def.typeValues[0], limit }).catch(() => []);
    }

    const combined: ContentItem[] = [];
    const seen = new Set<string>();
    for (const typeValue of def.typeValues) {
      const batch = await this.fetchContent({
        type: typeValue,
        category: def.categoryFilter,
        limit,
      }).catch(() => []);
      for (const item of batch) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        combined.push(item);
      }
      if (combined.length >= limit) break;
    }

    if (combined.length === 0 && def.categoryFilter) {
      const byCategory = await this.fetchContent({ category: def.categoryFilter, limit }).catch(() => []);
      for (const item of byCategory) {
        const type = (item.type ?? "").toUpperCase();
        if (def.typeValues.length === 0 || def.typeValues.includes(type)) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            combined.push(item);
          }
        }
      }
    }

    return combined.slice(0, limit);
  },

  async fetchContinueWatching(): Promise<ContinueWatchingItem[]> {
    const res = await apiClient.request("api/watch/continue-watching");
    if (res.status !== 200) return [];
    return Array.isArray(res.data) ? (res.data as ContinueWatchingItem[]) : [];
  },

  async fetchContentDetail(id: string): Promise<ContentDetail> {
    const res = await apiClient.request(`api/content/${id}`);
    if (res.status !== 200) throw apiClient.parseError(res.data, res.status);
    return res.data as ContentDetail;
  },

  async fetchCrew(contentId: string): Promise<CrewCredit[]> {
    const res = await apiClient.request("api/crew", { query: { contentId } });
    if (res.status !== 200) return [];
    return Array.isArray(res.data) ? (res.data as CrewCredit[]) : [];
  },

  async fetchPersonPreviewByPersonId(personId: string): Promise<PersonPreview> {
    const res = await apiClient.request(`api/people/${personId}/preview`);
    if (res.status !== 200) throw apiClient.parseError(res.data, res.status);
    return res.data as PersonPreview;
  },

  async fetchPersonPreviewByCrewId(crewMemberId: string): Promise<PersonPreview> {
    const res = await apiClient.request("api/people/preview", { query: { crewMemberId } });
    if (res.status !== 200) throw apiClient.parseError(res.data, res.status);
    return res.data as PersonPreview;
  },

  async fetchRelated(params: {
    excludingId: string;
    category?: string | null;
    type?: string | null;
    limit?: number;
  }): Promise<ContentItem[]> {
    const limit = params.limit ?? 12;
    let items: ContentItem[] = [];
    if (params.category) {
      items = await this.fetchContent({ category: params.category, limit: limit + 4 }).catch(() => []);
    }
    if (items.length < 4 && params.type) {
      const byType = await this.fetchContent({ type: params.type, limit: limit + 4 }).catch(() => []);
      items = items.concat(byType);
    }
    if (items.length === 0) {
      items = await this.fetchContent({ limit: limit + 4 }).catch(() => []);
    }
    const seen = new Set<string>();
    return items
      .filter((item) => {
        if (item.id === params.excludingId) return false;
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, limit);
  },

  // MARK: Playback ----------------------------------------------------------

  async fetchPlaybackBundle(params: {
    contentId: string;
    episodeId?: string | null;
    trailer?: boolean;
  }): Promise<PlaybackBundle> {
    const res = await apiClient.request(`api/content/${params.contentId}/playback-bundle`, {
      query: {
        episodeId: params.episodeId ?? undefined,
        trailer: params.trailer ? "1" : undefined,
      },
    });
    if (res.status !== 200) throw apiClient.parseError(res.data, res.status);
    return res.data as PlaybackBundle;
  },

  async fetchWatchProgress(contentId: string): Promise<{ position: number; duration: number | null }> {
    const res = await apiClient.request("api/watch/progress", { query: { contentId } });
    if (res.status !== 200) return { position: 0, duration: null };
    const progress = res.data as WatchProgress;
    return { position: progress.positionSeconds ?? 0, duration: progress.durationSeconds ?? null };
  },

  async saveWatchProgress(contentId: string, positionSeconds: number, durationSeconds?: number | null): Promise<void> {
    const body: Record<string, unknown> = { contentId, positionSeconds };
    if (durationSeconds != null) body.durationSeconds = durationSeconds;
    await apiClient.request("api/watch/progress", { method: "PUT", jsonBody: body }).catch(() => undefined);
  },

  async recordWatchSession(contentId: string, durationSeconds: number): Promise<void> {
    await apiClient
      .request("api/watch", { method: "POST", jsonBody: { contentId, durationSeconds } })
      .catch(() => undefined);
  },

  // MARK: Search / My List / Subscription ----------------------------------

  async search(query: string): Promise<SearchResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const res = await apiClient.request("api/browse/search", { query: { q, limit: 24 } });
    if (res.status !== 200) return [];
    return (res.data as SearchResponse).results ?? [];
  },

  async fetchWatchlist(): Promise<ContentItem[]> {
    const res = await apiClient.request("api/watchlist");
    if (res.status !== 200) throw apiClient.parseError(res.data, res.status);
    const rows = (Array.isArray(res.data) ? res.data : []) as WatchlistRow[];
    return rows.map((r) => r.content).filter((c): c is ContentItem => !!c);
  },

  async updateWatchlist(contentId: string, add: boolean): Promise<void> {
    const res = await apiClient.request("api/watchlist", {
      method: "POST",
      jsonBody: { contentId, action: add ? "add" : "remove" },
    });
    if (!res.ok) throw apiClient.parseError(res.data, res.status);
  },

  async fetchSubscription(): Promise<ViewerSubscription | null> {
    const res = await apiClient.request("api/viewer/subscription");
    if (res.status !== 200) return null;
    return (res.data as SubscriptionResponse).subscription ?? null;
  },
};
