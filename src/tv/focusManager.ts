import type { Direction } from "./keys";

/**
 * Lightweight geometric spatial-navigation engine for D-pad remotes.
 *
 * Every focusable element registers its DOM node and a set of callbacks. On an
 * arrow press we pick the best candidate in that direction using bounding-box
 * geometry (center distance along the axis + a strong penalty for cross-axis
 * gap, so same-row / same-column items win). Focus changes smoothly scroll the
 * relevant row and page into view.
 */

export interface FocusableOptions {
  onEnter?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Optional stable key so screens can programmatically direct focus. */
  focusKey?: string;
  /** When true, this element grabs focus as soon as it registers (if nothing focused). */
  autoFocus?: boolean;
  /** Disables directional exit on this element's edges when true (e.g. sliders). */
  trapDirections?: Direction[];
}

interface Entry {
  el: HTMLElement;
  opts: FocusableOptions;
}

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
}

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return {
    left: r.left,
    right: r.right,
    top: r.top,
    bottom: r.bottom,
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
  };
}

function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

class FocusManager {
  private entries = new Map<HTMLElement, Entry>();
  private current: HTMLElement | null = null;
  private paused = false;

  register(el: HTMLElement, opts: FocusableOptions): () => void {
    const entry: Entry = { el, opts };
    this.entries.set(el, entry);
    if (opts.autoFocus && !this.current) {
      // Defer so layout is ready.
      requestAnimationFrame(() => {
        if (!this.current && this.entries.has(el)) this.focus(el);
      });
    }
    return () => this.unregister(el);
  }

  private unregister(el: HTMLElement): void {
    this.entries.delete(el);
    if (this.current === el) {
      this.current = null;
      // Try to hand focus to the nearest surviving element on the next frame.
      requestAnimationFrame(() => {
        if (!this.current) this.focusFirst();
      });
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  getCurrent(): HTMLElement | null {
    return this.current;
  }

  focus(el: HTMLElement | null): void {
    if (!el || el === this.current) return;
    const prev = this.current;
    if (prev) {
      prev.classList.remove("tv-focused");
      this.entries.get(prev)?.opts.onBlur?.();
    }
    this.current = el;
    el.classList.add("tv-focused");
    this.entries.get(el)?.opts.onFocus?.();
    this.ensureVisible(el);
  }

  /** Blur the current element and hand focus to the top-most screen's default. */
  reset(): void {
    if (this.current) {
      this.current.classList.remove("tv-focused");
      this.entries.get(this.current)?.opts.onBlur?.();
      this.current = null;
    }
    requestAnimationFrame(() => {
      if (!this.current) this.focusFirst();
    });
  }

  focusByKey(key: string): boolean {
    for (const entry of this.entries.values()) {
      if (entry.opts.focusKey === key && isVisible(entry.el)) {
        this.focus(entry.el);
        return true;
      }
    }
    return false;
  }

  focusFirst(): void {
    let best: HTMLElement | null = null;
    let bestTop = Infinity;
    for (const entry of this.entries.values()) {
      if (!isVisible(entry.el)) continue;
      if (entry.opts.autoFocus) {
        this.focus(entry.el);
        return;
      }
      const top = entry.el.getBoundingClientRect().top;
      if (top < bestTop) {
        bestTop = top;
        best = entry.el;
      }
    }
    if (best) this.focus(best);
  }

  enter(): void {
    if (!this.current) return;
    const entry = this.entries.get(this.current);
    if (entry?.opts.onEnter) entry.opts.onEnter();
    else this.current.click();
  }

  move(direction: Direction): boolean {
    if (this.paused) return false;
    if (!this.current || !isVisible(this.current)) {
      this.focusFirst();
      return true;
    }

    const trap = this.entries.get(this.current)?.opts.trapDirections;
    if (trap?.includes(direction)) return false;

    const cur = rectOf(this.current);
    let best: HTMLElement | null = null;
    let bestScore = Infinity;

    for (const entry of this.entries.values()) {
      if (entry.el === this.current || !isVisible(entry.el)) continue;
      const cand = rectOf(entry.el);
      const score = this.score(cur, cand, direction);
      if (score == null) continue;
      if (score < bestScore) {
        bestScore = score;
        best = entry.el;
      }
    }

    if (best) {
      this.focus(best);
      return true;
    }
    return false;
  }

  private score(cur: Rect, cand: Rect, dir: Direction): number | null {
    let primary: number;
    let crossGap: number;
    let centerMiss: number;

    if (dir === "left" || dir === "right") {
      primary = dir === "right" ? cand.cx - cur.cx : cur.cx - cand.cx;
      if (primary <= 1) return null;
      crossGap = Math.max(0, cur.top - cand.bottom, cand.top - cur.bottom);
      centerMiss = Math.abs(cand.cy - cur.cy);
    } else {
      primary = dir === "down" ? cand.cy - cur.cy : cur.cy - cand.cy;
      if (primary <= 1) return null;
      crossGap = Math.max(0, cur.left - cand.right, cand.left - cur.right);
      centerMiss = Math.abs(cand.cx - cur.cx);
    }

    // Same row/column (no cross gap) is strongly preferred; center alignment
    // acts as a soft tie-breaker.
    return primary + crossGap * 8 + centerMiss * 0.5;
  }

  /** Smoothly bring the focused element into a comfortable viewing band. */
  private ensureVisible(el: HTMLElement): void {
    // Horizontal: center inside the nearest row scroller.
    const row = el.closest<HTMLElement>('[data-scroll="row"]');
    if (row) {
      const elRect = el.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const target =
        row.scrollLeft + (elRect.left - rowRect.left) - rowRect.width / 2 + elRect.width / 2;
      row.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    }

    // Vertical: keep the focused element around 38% down the page scroller.
    const page = el.closest<HTMLElement>('[data-scroll="page"]');
    if (page) {
      const elRect = el.getBoundingClientRect();
      const pageRect = page.getBoundingClientRect();
      const desired = pageRect.height * 0.38;
      const delta = elRect.top - pageRect.top - desired;
      if (Math.abs(delta) > 4) {
        page.scrollTo({ top: Math.max(0, page.scrollTop + delta), behavior: "smooth" });
      }
    }
  }
}

export const focusManager = new FocusManager();
