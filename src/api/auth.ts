import { AppConfig } from "@/config";
import { apiClient, ApiError } from "./client";
import type { AuthSession, SessionUser } from "./types";

interface CSRFResponse {
  csrfToken: string;
}

interface TvSessionPayload {
  token?: string;
  accessToken?: string;
  session?: AuthSession | SessionUser | null;
  user?: SessionUser | null;
  error?: string;
  mfaRequired?: boolean;
  expiresIn?: number;
}

function extractToken(data: TvSessionPayload | null | undefined): string | null {
  if (!data) return null;
  const raw = data.token || data.accessToken;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 10 ? trimmed : null;
}

function sessionFromPayload(raw: unknown): AuthSession | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as TvSessionPayload;

  // Preferred: { session: { user } }
  if (data.session && typeof data.session === "object") {
    const nested = data.session as AuthSession & SessionUser;
    if (nested.user && (nested.user.email || nested.user.id)) {
      return { user: nested.user, expires: (nested as AuthSession).expires };
    }
    if (nested.email || nested.id) {
      return { user: nested as SessionUser };
    }
  }

  // Flat: { user }
  if (data.user && (data.user.email || data.user.id)) {
    return { user: data.user };
  }

  return null;
}

/**
 * Auth for packaged webOS TVs.
 *
 * Cookie NextAuth CANNOT create a usable session from a packaged webOS origin
 * (SameSite=Lax / __Host- cookies are dropped). That produced QA failure
 * TVAPPQA-61908: "Sign-in succeeded but no session was created".
 *
 * Production path (always on TV / release builds):
 *   POST /api/tv/session → JWT → Authorization: Bearer on every API call
 *   Middleware injects Bearer + X-ST-Viewer-Profile onto cookies server-side.
 *
 * Cookie NextAuth is DEV-only (Vite HTTPS proxy), never used on the packaged IPK.
 */
export const AuthAPI = {
  /** Packaged TV / production builds must never rely on browser cookies. */
  usesCookieFallback(): boolean {
    return !!import.meta.env.DEV;
  },

  async fetchSession(): Promise<AuthSession | null> {
    const token = apiClient.getAccessToken();
    if (token) {
      try {
        const res = await apiClient.request("api/tv/session");
        if (res.status === 401 || res.status === 403) {
          apiClient.clearAccessToken();
          return null;
        }
        if (res.status === 200) {
          const session = sessionFromPayload(res.data);
          if (session?.user) return session;
          // Token present but server returned empty user — drop it.
          apiClient.clearAccessToken();
          return null;
        }
        if (res.status === 404 || res.status === 405) {
          return this.usesCookieFallback() ? this.fetchCookieSession() : null;
        }
        return null;
      } catch {
        return this.usesCookieFallback() ? this.fetchCookieSession() : null;
      }
    }
    return this.usesCookieFallback() ? this.fetchCookieSession() : null;
  },

  async fetchCookieSession(): Promise<AuthSession | null> {
    const res = await apiClient.request("api/auth/session", {
      query: { _ts: String(Date.now()) },
    });
    if (res.status !== 200) {
      if (res.status === 401) return null;
      throw apiClient.parseError(res.data, res.status);
    }
    if (!res.text || res.text === "null") return null;
    return sessionFromPayload(res.data);
  },

  async signInTv(
    email: string,
    password: string,
    mfaCode?: string,
  ): Promise<AuthSession> {
    const body: Record<string, string> = {
      email: email.trim().toLowerCase(),
      password,
    };
    if (mfaCode && mfaCode.trim()) body.mfaCode = mfaCode.trim();

    const res = await apiClient.request("api/tv/session", {
      method: "POST",
      jsonBody: body,
    });

    if (res.status === 200) {
      const data = (res.data ?? {}) as TvSessionPayload;
      const token = extractToken(data);
      let session = sessionFromPayload(data.session ?? data);

      if (!token) {
        throw new ApiError(
          "server",
          "Sign-in succeeded but the TV did not return a session token. Please try again.",
          200,
        );
      }

      // Store token first so the verification GET carries Authorization.
      apiClient.setAccessToken(token);

      if (!session?.user) {
        // Some responses only return token — confirm via GET.
        session = await this.fetchSession();
      }

      if (!session?.user) {
        apiClient.clearAccessToken();
        throw new ApiError(
          "server",
          "Sign-in succeeded but no session was created. Please try again.",
          200,
        );
      }

      // Round-trip confirm: GET /api/tv/session with the Bearer must see the user.
      try {
        const verify = await apiClient.request("api/tv/session");
        if (verify.status === 200) {
          const verified = sessionFromPayload(verify.data);
          if (verified?.user) return verified;
        }
      } catch {
        /* keep the POST session if verify is flaky */
      }

      return session;
    }

    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 400) {
      throw apiClient.parseError(res.data, res.status);
    }

    throw new ApiError(
      "server",
      (res.data as TvSessionPayload)?.error ||
        `TV sign-in failed (${res.status || "network"}). Please try again.`,
      res.status,
    );
  },

  async signInCookies(email: string, password: string): Promise<AuthSession> {
    const csrfRes = await apiClient.request("api/auth/csrf");
    if (csrfRes.status !== 200) throw apiClient.parseError(csrfRes.data, csrfRes.status);
    const csrf = csrfRes.data as CSRFResponse;
    if (!csrf?.csrfToken) {
      throw new ApiError("server", "Could not start sign-in. Please try again.");
    }

    const res = await apiClient.request("api/auth/callback/credentials-viewer", {
      method: "POST",
      formBody: {
        csrfToken: csrf.csrfToken,
        email: email.trim().toLowerCase(),
        password,
        callbackUrl: `${AppConfig.webBaseURL}/profiles`,
        json: "true",
      },
    });

    const data = (res.data ?? {}) as { error?: string; url?: string };
    if (data.error) {
      throw new ApiError(
        "server",
        data.error === "CredentialsSignin" ? "Invalid email or password." : data.error,
        res.status,
      );
    }

    const url = String(data.url || "");
    if (/[?&]csrf=true\b/.test(url) || /[?&]error=/.test(url)) {
      throw new ApiError("server", "Sign-in could not create a session. Please try again.");
    }

    if (!res.ok && res.status !== 302) {
      throw apiClient.parseError(res.data, res.status);
    }

    let session = await this.fetchCookieSession();
    if (!session?.user) {
      await new Promise((r) => setTimeout(r, 400));
      session = await this.fetchCookieSession();
    }
    if (!session?.user) {
      throw new ApiError("server", "Sign-in succeeded but no session was created.");
    }
    return session;
  },

  async signIn(email: string, password: string, mfaCode?: string): Promise<AuthSession> {
    // On the packaged IPK / release build: TV Bearer ONLY. Cookie fallback is
    // what made QA keep failing with "no session was created".
    if (!this.usesCookieFallback()) {
      return this.signInTv(email, password, mfaCode);
    }

    try {
      return await this.signInTv(email, password, mfaCode);
    } catch (err) {
      if (err instanceof ApiError) {
        // Don't hide real auth failures (bad password / MFA / rate limit).
        if (
          err.status === 400 ||
          err.status === 401 ||
          err.status === 403 ||
          err.status === 429 ||
          err.mfaRequired
        ) {
          throw err;
        }
        // Only fall back when the TV endpoint is missing in local/dev.
        if (err.status !== 404 && err.status !== 405) throw err;
      }
      return this.signInCookies(email, password);
    }
  },

  async signOut(): Promise<void> {
    const hadToken = apiClient.hasBearerSession();
    apiClient.clearAccessToken();
    if (hadToken) {
      try {
        await apiClient.request("api/tv/session", { method: "DELETE" });
      } catch {
        /* ignore */
      }
    }
    if (this.usesCookieFallback()) {
      try {
        const csrfRes = await apiClient.request("api/auth/csrf");
        const csrf = csrfRes.data as CSRFResponse | null;
        if (csrf?.csrfToken) {
          await apiClient.request("api/auth/signout", {
            method: "POST",
            formBody: {
              csrfToken: csrf.csrfToken,
              callbackUrl: AppConfig.webBaseURL,
              json: "true",
            },
          });
        }
      } catch {
        /* ignore */
      }
    }
  },
};
