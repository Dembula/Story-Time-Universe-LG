/**
 * webOS platform integration.
 *
 * Handles the TV-specific concerns the user asked for:
 *  - hiding the Magic Remote pointer/cursor so the UI is pure D-pad driven,
 *  - deep-linking payments/account out to the TV browser,
 *  - exiting cleanly on the root BACK press.
 */

interface WebOSSystem {
  platformBack?: () => void;
}

interface WebOSServiceBridge {
  new (): {
    call: (uri: string, params: string) => void;
    onservicecallback: (msg: string) => void;
  };
}

declare global {
  interface Window {
    webOS?: {
      platformBack?: () => void;
      service?: { request: (uri: string, options: Record<string, unknown>) => void };
      systemInfo?: () => unknown;
    };
    webOSSystem?: WebOSSystem;
    PalmSystem?: { platformBack?: () => void };
    WebOSServiceBridge?: WebOSServiceBridge;
  }
}

export const isWebOS = (): boolean =>
  typeof window !== "undefined" && (!!window.webOS || !!window.PalmSystem || /web0s|webos/i.test(navigator.userAgent));

let cursorHidden = false;

/**
 * Hide the Magic Remote pointer. webOS surfaces a "cursorStateChange" event and
 * respects `cursor: none`; we force it globally and re-hide whenever the pointer
 * tries to reappear, so remotes that carry a pointer behave like a plain D-pad.
 */
export function hideMagicRemotePointer(): void {
  if (cursorHidden) return;
  cursorHidden = true;

  const apply = () => {
    document.body.style.cursor = "none";
    document.documentElement.style.cursor = "none";
  };
  apply();

  document.addEventListener(
    "cursorStateChange",
    (event) => {
      const visible = (event as CustomEvent<{ visibility?: boolean }>).detail?.visibility;
      document.body.classList.toggle("cursor-visible", !!visible);
      if (!visible) apply();
    },
    true,
  );

  // Any real pointer movement immediately re-hides the cursor and drops the
  // hover state so nothing looks "pointer-selected".
  window.addEventListener("mousemove", apply, true);
}

/**
 * Register a handler for when the app is (re)opened from the webOS launcher
 * while still resident in memory. Used to always return signed-in viewers to
 * the "Choose your profile" page on every open. Returns an unsubscribe fn.
 */
export function onRelaunch(handler: () => void): () => void {
  const listener = () => handler();
  // Fired by webOS when the user opens the app again while it is still
  // resident in memory (e.g. from the launcher or recent apps).
  document.addEventListener("webOSRelaunch", listener);
  window.addEventListener("webOSRelaunch", listener);
  return () => {
    document.removeEventListener("webOSRelaunch", listener);
    window.removeEventListener("webOSRelaunch", listener);
  };
}

/** Register a handler for the hardware BACK button. Returns an unsubscribe fn. */
export function onPlatformBack(handler: () => void): () => void {
  const listener = (event: KeyboardEvent) => {
    if (event.keyCode === 461 || event.key === "GoBack" || event.key === "BrowserBack") {
      event.preventDefault();
      handler();
    }
  };
  window.addEventListener("keydown", listener, true);
  return () => window.removeEventListener("keydown", listener, true);
}

/** Close the app (returns to the webOS launcher / previous app). */
export function exitApp(): void {
  try {
    window.webOSSystem?.platformBack?.();
    window.PalmSystem?.platformBack?.();
    window.webOS?.platformBack?.();
  } catch {
    /* no-op */
  }
  // In the browser fallback, there is nothing to exit to.
}

/**
 * Open a URL in the TV's system browser. Used for payments / account changes,
 * which — matching iOS/Android — never happen inside the app.
 */
export function openInBrowser(url: string): void {
  if (window.webOS?.service?.request) {
    try {
      window.webOS.service.request("luna://com.webos.applicationManager", {
        method: "launch",
        parameters: {
          id: "com.webos.app.browser",
          params: { target: url },
        },
      });
      return;
    } catch {
      /* fall through */
    }
  }
  window.open(url, "_blank");
}
