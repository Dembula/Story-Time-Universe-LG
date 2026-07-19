/**
 * webOS platform integration.
 *
 * Handles the TV-specific concerns the user asked for:
 *  - supporting BOTH input styles (plain D-pad remotes AND pointer-equipped
 *    Magic Remotes / mice) so the app is modern and works on every LG TV,
 *  - deep-linking payments/account out to the TV browser,
 *  - exiting cleanly on the root BACK press.
 */

import { focusManager } from "./focusManager";

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

let inputInited = false;

/**
 * Wire up dual-input support so the app feels native with either a plain D-pad
 * remote or a pointer-equipped Magic Remote / mouse.
 *
 * We track the current input mode and expose it two ways:
 *  - `body.dpad-mode` (CSS hides the arrow cursor while navigating by D-pad),
 *  - `focusManager.setPointerActive(...)` (so hover only moves focus while the
 *    pointer is genuinely in use, never during D-pad scrolling).
 *
 * webOS raises `cursorStateChange` whenever its pointer appears/disappears; we
 * also treat real mouse/pointer movement as "pointer" and any navigation key as
 * "D-pad", which keeps desktop dev and older sets behaving correctly too.
 */
export function setupRemoteInput(): void {
  if (inputInited) return;
  inputInited = true;

  const setMode = (pointer: boolean) => {
    if (focusManager.isPointerActive() === pointer) return;
    focusManager.setPointerActive(pointer);
    document.body.classList.toggle("dpad-mode", !pointer);
    document.body.classList.toggle("pointer-mode", pointer);
  };

  // Start in D-pad mode; the first pointer movement flips it.
  setMode(false);

  document.addEventListener(
    "cursorStateChange",
    (event) => {
      const visible = (event as CustomEvent<{ visibility?: boolean }>).detail?.visibility;
      setMode(!!visible);
    },
    true,
  );

  const toPointer = () => setMode(true);
  window.addEventListener("mousemove", toPointer, true);
  window.addEventListener("pointermove", toPointer, true);
  window.addEventListener("mousedown", toPointer, true);

  // Any directional / OK / colour key press means the viewer is on the D-pad.
  window.addEventListener(
    "keydown",
    () => setMode(false),
    true,
  );
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
