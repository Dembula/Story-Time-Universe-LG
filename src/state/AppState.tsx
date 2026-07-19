import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AuthAPI } from "@/api/auth";
import { ViewerAPI } from "@/api/viewerApi";
import type { AuthSession, ViewerProfile, ViewerSubscription } from "@/api/types";
import { onRelaunch } from "@/tv/platform";

export type AppRoute = "loading" | "signIn" | "profiles" | "main";

interface AppStateValue {
  route: AppRoute;
  session: AuthSession | null;
  activeProfile: ViewerProfile | null;
  subscription: ViewerSubscription | null;
  bootstrapError: string | null;
  isBusy: boolean;
  needsPaymentAttention: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectProfile: (profile: ViewerProfile) => void;
  switchProfile: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const MIN_SPLASH_MS = 2600;

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<AppRoute>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [activeProfile, setActiveProfile] = useState<ViewerProfile | null>(null);
  const [subscription, setSubscription] = useState<ViewerSubscription | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const bootstrapped = useRef(false);

  const bootstrap = useCallback(async () => {
    setRoute("loading");
    setBootstrapError(null);
    setActiveProfile(null);

    const started = Date.now();
    const waitSplash = async () => {
      const elapsed = Date.now() - started;
      if (elapsed < MIN_SPLASH_MS) {
        await new Promise((r) => setTimeout(r, MIN_SPLASH_MS - elapsed));
      }
    };

    try {
      const s = await AuthAPI.fetchSession();
      setSession(s);
      if (s?.user) {
        setSubscription(await ViewerAPI.fetchSubscription().catch(() => null));
      }
      await waitSplash();
      // Always land on profiles after auth — never auto-enter a profile.
      setRoute(s?.user ? "profiles" : "signIn");
    } catch (err) {
      setSession(null);
      setBootstrapError(err instanceof Error ? err.message : "Could not start the app.");
      await waitSplash();
      setRoute("signIn");
    }
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void bootstrap();
  }, [bootstrap]);

  // Keep live refs so the relaunch handler never reads stale state.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const routeRef = useRef(route);
  routeRef.current = route;

  // Every time a signed-in viewer re-opens the app, take them back to the
  // "Choose your profile" page — mirroring the iOS/Android apps.
  useEffect(() => {
    return onRelaunch(() => {
      if (routeRef.current === "loading" || routeRef.current === "signIn") return;
      if (sessionRef.current?.user) {
        setActiveProfile(null);
        setRoute("profiles");
      }
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsBusy(true);
    try {
      const s = await AuthAPI.signIn(email, password);
      setSession(s);
      setActiveProfile(null);
      setSubscription(await ViewerAPI.fetchSubscription().catch(() => null));
      setRoute("profiles");
    } finally {
      setIsBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsBusy(true);
    try {
      await AuthAPI.signOut();
      setSession(null);
      setActiveProfile(null);
      setSubscription(null);
      setRoute("signIn");
    } finally {
      setIsBusy(false);
    }
  }, []);

  const selectProfile = useCallback((profile: ViewerProfile) => {
    setActiveProfile(profile);
    setRoute("main");
  }, []);

  const switchProfile = useCallback(() => {
    setActiveProfile(null);
    setRoute("profiles");
  }, []);

  const needsPaymentAttention = useMemo(() => {
    const status = subscription?.status?.toUpperCase();
    if (!status) return false;
    return ["PAST_DUE", "CANCELED", "CANCELLED", "EXPIRED"].includes(status);
  }, [subscription]);

  const value: AppStateValue = {
    route,
    session,
    activeProfile,
    subscription,
    bootstrapError,
    isBusy,
    needsPaymentAttention,
    signIn,
    signOut,
    selectProfile,
    switchProfile,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
