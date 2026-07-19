import { useState } from "react";
import { FocusButton } from "./FocusButton";
import { useRemote } from "@/tv/useRemote";

interface PinPadProps {
  title: string;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}

/**
 * On-screen 4-digit PIN pad — remote-friendly (no soft keyboard needed).
 * Auto-submits once four digits are entered.
 */
export function PinPad({ title, onSubmit, onCancel }: PinPadProps) {
  const [pin, setPin] = useState("");

  useRemote({ onBack: onCancel });

  const push = (digit: string) => {
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      const next = prev + digit;
      if (next.length === 4) setTimeout(() => onSubmit(next), 150);
      return next;
    });
  };

  const back = () => setPin((prev) => prev.slice(0, -1));

  return (
    <div className="modal-overlay">
      <div className="pinpad rise-in">
        <h2 className="pinpad-title">{title}</h2>
        <div className="pin-dots">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`pin-dot ${i < pin.length ? "filled" : ""}`} />
          ))}
        </div>
        <div className="pin-grid">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d, idx) => (
            <FocusButton
              key={d}
              onEnter={() => push(d)}
              className="pin-key"
              focusClass="focus-lift"
              autoFocus={idx === 0}
            >
              {d}
            </FocusButton>
          ))}
          <FocusButton onEnter={onCancel} className="pin-key pin-key-sub">
            Cancel
          </FocusButton>
          <FocusButton onEnter={() => push("0")} className="pin-key">
            0
          </FocusButton>
          <FocusButton onEnter={back} className="pin-key pin-key-sub">
            ⌫
          </FocusButton>
        </div>
      </div>
    </div>
  );
}
