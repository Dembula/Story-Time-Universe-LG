import { useEffect } from "react";
import { AppStateProvider, useAppState } from "@/state/AppState";
import { Splash } from "@/screens/Splash";
import { SignIn } from "@/screens/SignIn";
import { Profiles } from "@/screens/Profiles";
import { MainApp } from "@/screens/MainApp";
import { hideMagicRemotePointer } from "@/tv/platform";

function Router() {
  const { route } = useAppState();

  switch (route) {
    case "loading":
      return <Splash />;
    case "signIn":
      return <SignIn />;
    case "profiles":
      return <Profiles />;
    case "main":
      return <MainApp />;
  }
}

export default function App() {
  useEffect(() => {
    // Turn the Magic Remote pointer off for a pure D-pad experience.
    hideMagicRemotePointer();
  }, []);

  return (
    <AppStateProvider>
      <div className="app-fade">
        <Router />
      </div>
    </AppStateProvider>
  );
}
