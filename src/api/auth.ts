import { AppConfig } from "@/config";
import { apiClient, ApiError } from "./client";
import type { AuthSession, SessionUser } from "./types";

interface CSRFResponse {
  csrfToken: string;
}

interface TvSessionPayload {
  token?: string;
  session?: AuthSession | SessionUser | null;
  user?: SessionUser | null;
  error?: string;
}

function sessionFromPayload(raw: unknown): AuthSession | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as TvSessionPayload;
  const user = (data.session && "user" in data.session ? data.session.user : null)
    ?? (data.session as SessionUser | undefined)
    ?? data.user
    ?? null;
  if (!user || (!user.email && !user.id)) return null;
  if (data.session && "user" in data.session && data.session.user) {
    return data.session as AuthSession;
  }
  return { user };
}

/**
 * Auth for packaged webOS TVs.
 *
 * Cookie NextAuth fails on LG (and Samsung) packaged origins — Chromium will
 * not store SameSite=Lax / __Host- cookies from cross-origin fetch, which is
 * exactly QA TVAPPQA-61908 ("Sign-in succeeded but no session was created").
 *
 * Primary: POST /api/tv/session → JWT stored in localStorage.
 * Fallback: cookie NextAuth (desktop / Vite HTTPS proxy preview only).
 */
export const AuthAPI = {
  async fetchSession(): Promise<AuthSession | null> {
    const token = apiClient.getAccessToken();
    if (token) {
      try {
        const res = await apiClient.request("api/tv/session");
        if (res.status === 401 || res.status === 403) {
          apiClient.clearAccessToken();
          return null;
        }
        if (res.status === 404 || res.status === 405) {
          return this.fetchCookieSession();
        }
        if (res.status !== 200) {
          if (res.status === 0) return this.fetchCookieSession();
          throw apiClient.parseError(res.data, res.status);
        }
        return sessionFromPayload(res.data);
      } catch {
        return this.fetchCookieSession();
      }
    }
    return this.fetchCookieSession();
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

  async signInTv(email: string, password: string): Promise<AuthSession | null> {
    const res = await apiClient.request("api/tv/session", {
      method: "POST",
      jsonBody: {
        email: email.trim().toLowerCase(),
        password,
      },
    });

    if (res.status === 200) {
      const data = res.data as TvSessionPayload;
      const token = data?.token;
      const session = sessionFromPayload(data?.session ?? data);
      if (!token || !session?.user) {
        throw new ApiError("server", "Sign-in succeeded but no session was created.");
      }
      apiClient.setAccessToken(token);
      return session;
    }

    if (res.status === 401 || res.status === 429) {
      throw apiClient.parseError(res.data, res.status);
    }
    if (res.status === 403 && (res.data as TvSessionPayload)?.error) {
      throw apiClient.parseError(res.data, res.status);
    }
    // 404/405 → TV endpoint missing; fall back to cookies.
    return null;
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
      throw new ApiError("server", "Sign-in could not create a session on this TV. Please try again.");
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

  async signIn(email: string, password: string): Promise<AuthSession> {
    try {
      const tvSession = await this.signInTv(email, password);
      if (tvSession?.user) return tvSession;
    } catch (err) {
      // Hard auth failures (bad password / rate limit) must surface.
      if (err instanceof ApiError && err.status !== 404 && err.status !== 405 && err.status !== 0) {
        throw err;
      }
    }
    return this.signInCookies(email, password);
  },

  async signOut(): Promise<void> {
    apiClient.clearAccessToken();
    try {
      await apiClient.request("api/tv/session", { method: "DELETE" });
    } catch {
      /* ignore */
    }
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
  },
};
