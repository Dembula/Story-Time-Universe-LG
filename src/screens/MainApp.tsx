import { useCallback, useEffect, useMemo, useState } from "react";
import { focusManager } from "@/tv/focusManager";
import { useAppState } from "@/state/AppState";
import {
  NavigationContext,
  type NavigationValue,
  type PersonRoute,
  type PlaybackRequest,
  type Tab,
} from "@/state/Navigation";
import type { ContentItem } from "@/api/types";
import { Sidebar } from "@/components/Sidebar";
import { Home } from "./Home";
import { Search } from "./Search";
import { MyList } from "./MyList";
import { Account } from "./Account";
import { Detail } from "./Detail";
import { Person } from "./Person";
import { Player } from "./Player";
import { exitApp } from "@/tv/platform";

type Overlay =
  | { kind: "detail"; contentId: string; seed?: ContentItem }
  | { kind: "person"; route: PersonRoute }
  | { kind: "player"; request: PlaybackRequest };

export function MainApp() {
  const { switchProfile } = useAppState();
  const [tab, setTab] = useState<Tab>("home");
  const [stack, setStack] = useState<Overlay[]>([]);

  const openDetail = useCallback((item: ContentItem) => {
    setStack((s) => [...s, { kind: "detail", contentId: item.id, seed: item }]);
  }, []);

  const openPerson = useCallback((route: PersonRoute) => {
    setStack((s) => [...s, { kind: "person", route }]);
  }, []);

  const openPlayer = useCallback((request: PlaybackRequest) => {
    setStack((s) => [...s, { kind: "player", request }]);
  }, []);

  const back = useCallback(() => {
    setStack((s) => {
      if (s.length > 0) return s.slice(0, -1);
      // At the root of the main app, BACK returns to profiles.
      switchProfile();
      return s;
    });
  }, [switchProfile]);

  const nav: NavigationValue = useMemo(
    () => ({ tab, setTab, openDetail, openPerson, openPlayer, back, switchProfile }),
    [tab, openDetail, openPerson, openPlayer, back, switchProfile],
  );

  // On every navigation transition, hand focus to the new top screen's default.
  useEffect(() => {
    focusManager.reset();
  }, [tab, stack.length]);

  const top = stack[stack.length - 1];
  const playerActive = top?.kind === "player";

  return (
    <NavigationContext.Provider value={nav}>
      <div className="app-shell">
        {!playerActive && <Sidebar />}

        <div style={{ display: stack.length ? "none" : "contents" }}>
          {tab === "home" && <Home />}
          {tab === "search" && <Search />}
          {tab === "mylist" && <MyList />}
          {tab === "account" && <Account onExit={exitApp} />}
        </div>

        {top?.kind === "detail" && (
          <Detail key={top.contentId} contentId={top.contentId} seed={top.seed} />
        )}
        {top?.kind === "person" && <Person route={top.route} />}
        {top?.kind === "player" && <Player request={top.request} onClose={back} />}
      </div>
    </NavigationContext.Provider>
  );
}
