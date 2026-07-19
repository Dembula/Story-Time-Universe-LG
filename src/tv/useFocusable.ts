import { useCallback, useEffect, useRef, useState } from "react";
import { focusManager, type FocusableOptions } from "./focusManager";

export interface UseFocusableParams extends Omit<FocusableOptions, "onFocus" | "onBlur"> {
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
}

export interface UseFocusableResult<T extends HTMLElement> {
  ref: React.RefObject<T>;
  focused: boolean;
  focusSelf: () => void;
}

/**
 * Registers a DOM node with the spatial focus engine and reports whether it is
 * currently focused so components can style themselves. Callbacks are kept in a
 * ref so consumers can pass fresh closures without re-registering every render.
 */
export function useFocusable<T extends HTMLElement = HTMLDivElement>(
  params: UseFocusableParams = {},
): UseFocusableResult<T> {
  const ref = useRef<T>(null);
  const [focused, setFocused] = useState(false);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    const el = ref.current;
    if (!el || params.disabled) return;

    const unregister = focusManager.register(el, {
      focusKey: paramsRef.current.focusKey,
      autoFocus: paramsRef.current.autoFocus,
      trapDirections: paramsRef.current.trapDirections,
      onEnter: () => paramsRef.current.onEnter?.(),
      onFocus: () => {
        setFocused(true);
        paramsRef.current.onFocus?.();
      },
      onBlur: () => {
        setFocused(false);
        paramsRef.current.onBlur?.();
      },
    });

    // Pointer support: hovering with the Magic Remote / mouse moves the focus
    // ring to this element so pointer and D-pad stay perfectly in sync.
    const onPointerEnter = () => focusManager.focusFromPointer(el);
    el.addEventListener("pointerenter", onPointerEnter);

    return () => {
      el.removeEventListener("pointerenter", onPointerEnter);
      unregister();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.disabled, params.focusKey]);

  const focusSelf = useCallback(() => {
    if (ref.current) focusManager.focus(ref.current);
  }, []);

  return { ref, focused, focusSelf };
}
