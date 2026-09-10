import { apiUrl } from "@/config";
import type { ApiErrorBody } from "./types";

export type ApiErrorKind =
  | "invalidURL"
  | "unauthorized"
  | "paymentRequired"
  | "server"
  | "decoding"
  | "network";

export class ApiError extends Error {
  kind: ApiErrorKind;
  status: number;

  constructor(kind: ApiErrorKind, message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  jsonBody?: unknown;
  formBody?: Record<string, string>;
  acceptsJSON?: boolean;
  signal?: AbortSignal;
}

export interface RawResponse {
  ok: boolean;
  status: number;
  data: unknown;
  text: string;
}

const TOKEN_KEY = "stu_session_token";
const PROFILE_KEY = "stu_viewer_profile";

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* private mode / webOS quota */
  }
}

/**
 * HTTP client for the packaged webOS app.
 *
 * Packaged LG apps run from a non–story-time.online origin. Chromium will not
 * keep NextAuth SameSite=Lax / __Host- cookies on cross-origin fetch, so the
 * primary auth path is a JWT from POST /api/tv/session (same as Samsung).
 * Cookie credentials remain a desktop/dev fallback only.
 */
class ApiClient {
  private accessToken: string | null = readStorage(TOKEN_KEY);
  private viewerProfileId: string | null = readStorage(PROFILE_KEY);

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
    writeStorage(TOKEN_KEY, token);
  }

  clearAccessToken(): void {
    this.setAccessToken(null);
    this.setViewerProfileId(null);
  }

  getViewerProfileId(): string | null {
    return this.viewerProfileId;
  }

  setViewerProfileId(id: string | null): void {
    this.viewerProfileId = id;
    writeStorage(PROFILE_KEY, id);
  }

  async request(path: string, options: RequestOptions = {}): Promise<RawResponse> {
    const {
      method = "GET",
      query,
      jsonBody,
      formBody,
      acceptsJSON = true,
      signal,
    } = options;

    const url = apiUrl(path, query);
    const headers: Record<string, string> = {
      "X-ST-Platform": "webos",
      "X-ST-Device": "lg-tv",
    };
    if (acceptsJSON) headers["Accept"] = "application/json";
    if (this.accessToken) headers["Authorization"] = `Bearer ${this.accessToken}`;
    // Live TV CORS allowlist uses X-ST-Viewer-Profile; some backend helpers also
    // read X-Viewer-Profile-Id — send both so profile-scoped APIs work either way.
    if (this.viewerProfileId) {
      headers["X-ST-Viewer-Profile"] = this.viewerProfileId;
      headers["X-Viewer-Profile-Id"] = this.viewerProfileId;
    }

    let body: BodyInit | undefined;
    if (jsonBody !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(jsonBody);
    } else if (formBody) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      const parts: string[] = [];
      for (const key of Object.keys(formBody)) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(formBody[key])}`);
      }
      body = parts.join("&");
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body,
        // Bearer sessions must omit cookies so CORS does not demand credentials.
        credentials: this.accessToken ? "omit" : "include",
        mode: "cors",
        cache: "no-store",
        signal,
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") throw err;
      throw new ApiError("network", (err as Error)?.message ?? "Network error");
    }

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    return { ok: response.ok, status: response.status, data, text };
  }

  parseError(data: unknown, status: number): ApiError {
    const body = (data ?? {}) as ApiErrorBody;
    const message = body?.error;
    if (message) {
      if (status === 402 || body.paymentRequired) return new ApiError("paymentRequired", message, status);
      if (status === 401) return new ApiError("unauthorized", "Please sign in again.", status);
      return new ApiError("server", message, status);
    }
    if (status === 401) return new ApiError("unauthorized", "Please sign in again.", status);
    if (status === 402) return new ApiError("paymentRequired", "Complete your subscription on the web.", status);
    return new ApiError("server", `Request failed (${status}).`, status);
  }
}

export const apiClient = new ApiClient();
