/**
 * Tiny runtime polyfills for older webOS Chromium on the critical boot path.
 * Kept light (no @vitejs/plugin-legacy) so packaging doesn't OOM Node.
 */
import "whatwg-fetch";
import "regenerator-runtime/runtime";


/* Element.closest — Chrome 41+ */
if (typeof Element !== "undefined" && !Element.prototype.closest) {
  // eslint-disable-next-line no-extend-native
  Element.prototype.closest = function (sel: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let el: Element | null = this;
    while (el && el.nodeType === 1) {
      const any = el as Element & {
        matches?: (s: string) => boolean;
        msMatchesSelector?: (s: string) => boolean;
        webkitMatchesSelector?: (s: string) => boolean;
      };
      if (any.matches?.(sel) || any.msMatchesSelector?.(sel) || any.webkitMatchesSelector?.(sel)) {
        return el;
      }
      el = el.parentElement || (el.parentNode as Element | null);
    }
    return null;
  };
}

if (typeof Element !== "undefined" && !Element.prototype.matches) {
  const proto = Element.prototype as Element & {
    msMatchesSelector?: (s: string) => boolean;
    webkitMatchesSelector?: (s: string) => boolean;
  };
  proto.matches =
    proto.msMatchesSelector ||
    proto.webkitMatchesSelector ||
    function matches(this: Element, sel: string) {
      const doc = this.ownerDocument;
      const list = doc.querySelectorAll(sel);
      let i = 0;
      while (list[i] && list[i] !== this) i++;
      return Boolean(list[i]);
    };
}

/* Array.prototype.includes — Chrome 47+ */
if (!Array.prototype.includes) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.includes = function includes(search: unknown, from?: number) {
    return this.indexOf(search as never, from) !== -1;
  };
}

/* Object.assign — Chrome 45+ */
if (typeof Object.assign !== "function") {
  Object.assign = function assign(target: object, ...sources: object[]) {
    if (target == null) throw new TypeError("Cannot convert undefined or null to object");
    const to = Object(target);
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      if (src == null) continue;
      for (const key in src) {
        if (Object.prototype.hasOwnProperty.call(src, key)) {
          (to as Record<string, unknown>)[key] = (src as Record<string, unknown>)[key];
        }
      }
    }
    return to;
  };
}
