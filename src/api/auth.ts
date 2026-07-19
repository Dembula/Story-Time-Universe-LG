import { apiClient, ApiError } from "./client";
import type { AuthSession } from "./types";

interface CSRFResponse {
  csrfToken: string;
}

/**
 * Auth flow mirrors the iOS `AuthService`: fetch CSRF, POST the credentials to
 * the NextAuth `credentials-viewer` provider, then confirm the session.
 */
export const AuthAPI = {
  async fetchSession(): Promise<AuthSession | null> {
    const res = await apiClient.request("api/auth/session");
    if (res.status !== 200) {
      if (res.status === 401) return null;
      throw apiClient.parseError(res.data, res.status);
    }
    if (!res.text || res.text === "null") return null;
    const session = res.data as AuthSession;
    if (!session?.user?.email && !session?.user?.id) return null;
    return session;
  },

  async signIn(email: string, password: string): Promise<AuthSession> {
    const csrfRes = await apiClient.request("api/auth/csrf");
    if (csrfRes.status !== 200) throw apiClient.parseError(csrfRes.data, csrfRes.status);
    const csrf = csrfRes.data as CSRFResponse;

    const res = await apiClient.request("api/auth/callback/credentials-viewer", {
      method: "POST",
      formBody: {
        csrfToken: csrf.csrfToken,
        email: email.trim().toLowerCase(),
        password,
        callbackUrl: "https://story-time.online/profiles",
        json: "true",
      },
    });

    if (!res.ok && res.status !== 302) {
      const err = (res.data as { error?: string })?.error;
      if (err) {
        throw new ApiError(
          "server",
          err === "CredentialsSignin" ? "Invalid email or password." : err,
          res.status,
        );
      }
      throw apiClient.parseError(res.data, res.status);
    }

    const err = (res.data as { error?: string })?.error;
    if (err) {
      throw new ApiError(
        "server",
        err === "CredentialsSignin" ? "Invalid email or password." : err,
        res.status,
      );
    }

    const session = await this.fetchSession();
    if (!session?.user) {
      throw new ApiError("server", "Sign-in succeeded but no session was created.");
    }
    return session;
  },

  async signOut(): Promise<void> {
    const csrfRes = await apiClient.request("api/auth/csrf");
    const csrf = csrfRes.data as CSRFResponse | null;
    if (csrf?.csrfToken) {
      await apiClient.request("api/auth/signout", {
        method: "POST",
        formBody: {
          csrfToken: csrf.csrfToken,
          callbackUrl: "https://story-time.online",
          json: "true",
        },
      });
    }
  },
};
