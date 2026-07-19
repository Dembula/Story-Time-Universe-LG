/**
 * webOS / LG Magic Remote key codes. TVs emit standard DOM keyCodes for the
 * D-pad plus a set of media/colour keys unique to webOS.
 */
export const TVKey = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
  BACK: 461,
  // Media transport keys (Magic Remote + standard remotes).
  PLAY: 415,
  PAUSE: 19,
  PLAY_PAUSE: 463,
  STOP: 413,
  FAST_FORWARD: 417,
  REWIND: 412,
  // Colour keys.
  RED: 403,
  GREEN: 404,
  YELLOW: 405,
  BLUE: 406,
  // Channel keys sometimes used for paging.
  CHANNEL_UP: 427,
  CHANNEL_DOWN: 428,
} as const;

export type TVKeyCode = (typeof TVKey)[keyof typeof TVKey];

export type Direction = "left" | "right" | "up" | "down";

export function directionForKey(keyCode: number): Direction | null {
  switch (keyCode) {
    case TVKey.LEFT:
      return "left";
    case TVKey.RIGHT:
      return "right";
    case TVKey.UP:
      return "up";
    case TVKey.DOWN:
      return "down";
    default:
      return null;
  }
}

export function isBackKey(keyCode: number): boolean {
  // webOS BACK (461) plus browser Backspace (8) and Escape (27) for dev.
  return keyCode === TVKey.BACK || keyCode === 8 || keyCode === 27;
}
