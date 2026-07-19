/**
 * Central configuration for the Story Time Universe webOS TV app.
 *
 * Mirrors the iOS `AppConfig` — all viewing traffic points at the production
 * web app, and payments / account changes are deep-linked out to the browser
 * (the TV app never takes payments, matching the iOS/Android clients).
 */
export const AppConfig = {
  webBaseURL: "https://story-time.online",
  get apiBaseURL(): string {
    return this.webBaseURL;
  },

  // Web deep links (opened in the TV browser via webOS).
  renewSubscriptionURL: "https://story-time.online/browse/account/renew",
  accountURL: "https://story-time.online/browse/account",
  changePlanURL: "https://story-time.online/browse/account/change-plan",
  signUpURL: "https://story-time.online/auth/signup",

  // NextAuth viewer cookies (managed by the web backend on sign-in).
  viewerProfileCookieName: "st_viewer_profile",
  viewerProfileUnlockCookieName: "st_viewer_profile_unlock",
} as const;

export function apiUrl(path: string, query?: Record<string, string | number | boolean | undefined | null>): string {
  const cleaned = path.replace(/^\/+/, "");
  const url = new URL(`${AppConfig.apiBaseURL}/${cleaned}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}
