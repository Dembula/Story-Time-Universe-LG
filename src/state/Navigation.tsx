import { createContext, useContext } from "react";
import type { ContentItem, EpisodePlaybackInfo } from "@/api/types";

export interface PersonRoute {
  personId?: string | null;
  crewMemberId?: string | null;
  fallbackName: string;
  fallbackRole?: string | null;
}

export interface PlaybackRequest {
  contentId: string;
  title: string;
  episodeId?: string | null;
  isTrailer?: boolean;
  episodes?: EpisodePlaybackInfo[];
}

export type Tab = "home" | "search" | "mylist" | "account";

export interface NavigationValue {
  tab: Tab;
  setTab: (tab: Tab) => void;
  openDetail: (item: ContentItem) => void;
  openPerson: (route: PersonRoute) => void;
  openPlayer: (request: PlaybackRequest) => void;
  back: () => void;
  switchProfile: () => void;
}

export const NavigationContext = createContext<NavigationValue | null>(null);

export function useNavigation(): NavigationValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useNavigation must be used within NavigationContext");
  return ctx;
}
