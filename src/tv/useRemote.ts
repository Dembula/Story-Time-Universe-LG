import { useEffect, useRef } from "react";
import { focusManager } from "./focusManager";
import { directionForKey, isBackKey, TVKey } from "./keys";

export interface RemoteHandlers {
  /** Return true to consume the key and stop the default spatial handling. */
  onKey?: (keyCode: number, event: KeyboardEvent) => boolean | void;
  onBack?: () => void;
  onPlayPause?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onFastForward?: () => void;
  onRewind?: () => void;
  /** Disable the built-in spatial navigation (used by the fullscreen player). */
  disableSpatial?: boolean;
}

// Only the top-most mounted screen processes remote keys, so overlays (detail,
// player) don't double-handle BACK with the screens still mounted underneath.
const stack: { current: RemoteHandlers }[] = [];

function dispatch(event: KeyboardEvent): void {
  const entry = stack[stack.length - 1];
  if (!entry) return;
  const handlers = entry.current;
  const code = event.keyCode || event.which;

  if (handlers.onKey && handlers.onKey(code, event)) {
    event.preventDefault();
    return;
  }

  if (isBackKey(code)) {
    event.preventDefault();
    handlers.onBack?.();
    return;
  }

  switch (code) {
    case TVKey.PLAY_PAUSE:
      handlers.onPlayPause?.();
      event.preventDefault();
      return;
    case TVKey.PLAY:
      (handlers.onPlay ?? handlers.onPlayPause)?.();
      event.preventDefault();
      return;
    case TVKey.PAUSE:
      (handlers.onPause ?? handlers.onPlayPause)?.();
      event.preventDefault();
      return;
    case TVKey.STOP:
      handlers.onStop?.();
      event.preventDefault();
      return;
    case TVKey.FAST_FORWARD:
      handlers.onFastForward?.();
      event.preventDefault();
      return;
    case TVKey.REWIND:
      handlers.onRewind?.();
      event.preventDefault();
      return;
  }

  if (handlers.disableSpatial) return;

  const direction = directionForKey(code);
  if (direction) {
    event.preventDefault();
    focusManager.move(direction);
    return;
  }

  if (code === TVKey.ENTER) {
    event.preventDefault();
    focusManager.enter();
  }
}

let listenerAttached = false;

export function useRemote(handlers: RemoteHandlers): void {
  const ref = useRef<RemoteHandlers>(handlers);
  ref.current = handlers;

  useEffect(() => {
    stack.push(ref);
    if (!listenerAttached) {
      window.addEventListener("keydown", dispatch);
      listenerAttached = true;
    }
    return () => {
      const idx = stack.lastIndexOf(ref);
      if (idx >= 0) stack.splice(idx, 1);
    };
  }, []);
}
