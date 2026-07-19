import { type ReactNode } from "react";
import { useFocusable } from "@/tv/useFocusable";

interface FocusButtonProps {
  onEnter: () => void;
  children: ReactNode;
  className?: string;
  focusClass?: string;
  focusKey?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onFocus?: () => void;
}

/**
 * A D-pad focusable button. `focusClass` controls the focus animation style
 * (defaults to a subtle lift). ENTER (or remote OK) fires `onEnter`.
 */
export function FocusButton({
  onEnter,
  children,
  className = "",
  focusClass = "focus-lift",
  focusKey,
  autoFocus,
  disabled,
  ariaLabel,
  onFocus,
}: FocusButtonProps) {
  const { ref, focused } = useFocusable<HTMLButtonElement>({
    onEnter: disabled ? undefined : onEnter,
    focusKey,
    autoFocus,
    disabled,
    onFocus,
  });

  return (
    <button
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      onClick={() => !disabled && onEnter()}
      className={`tv-focusable ${focusClass} ${className} ${focused ? "tv-focused" : ""}`}
      style={disabled ? { opacity: 0.45 } : undefined}
    >
      {children}
    </button>
  );
}
