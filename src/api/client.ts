import { apiUrl } from "@/config";
import type { ApiErrorBody } from "./types";

export type ApiErrorKind =
  | "invalidURL"
  | "unauthorized"
  | "paymentRequired"
  | "server"
  | "decoding"
  | "network"
  | "mfaRequired";

export class ApiError extends Error {
  kind: ApiErrorKind;
  status: number;
  mfaRequired: boolean;

  constructor(kind: ApiErrorKind, message: string, status = 0, opts?: { mfaRequired?: boolean }) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.mfaRequired = !!opts?.mfaRequired || kind === "mfaRequired";
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

/** Persist across localStorage / sessionStorage — webOS sometimes blocks one of them. */
function readStorage(key: string): string | null {
  try {
    const fromLocal = window.localStorage?.getItem(key);
    if (fromLocal) return fromLocal;
  } catch {
    /* ignore */
  }
  try {
    return window.sessionStorage?.getItem(key) || null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  const stores: Storage[] = [];
  try {
    if (window.localStorage) stores.push(window.localStorage);
  } catch {
    /* ignore */
  }
  try {
    if (window.sessionStorage) stores.push(window.sessionStorage);
  } catch {
    /* ignore */
  }
  for (let i = 0; i < stores.length; i++) {
    try {
      if (value) stores[i].setItem(key, value);
      else stores[i].removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/**
 * HTTP client for the packaged webOS app.
 *
 * Packaged LG apps cannot keep NextAuth SameSite=Lax / __Host- cookies on
 * cross-origin fetch. Auth is a JWT from POST /api/tv/session, sent as
 * Authorization: Bearer on every call. Production middleware maps that Bearer
 * (+ X-ST-Viewer-Profile) onto session/profile cookies for existing APIs.
 */
class ApiClient {
  private accessToken: string | null = readStorage(TOKEN_KEY);
  private viewerProfileId: string | null = readStorage(PROFILE_KEY);

  getAccessToken(): string | null {
    return this.accessToken || readStorage(TOKEN_KEY);
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token && String(token).trim() ? String(token).trim() : null;
    writeStorage(TOKEN_KEY, this.accessToken);
  }

  clearAccessToken(): void {
    this.setAccessToken(null);
    this.setViewerProfileId(null);
  }

  getViewerProfileId(): string | null {
    return this.viewerProfileId || readStorage(PROFILE_KEY);
  }

  setViewerProfileId(id: string | null): void {
    this.viewerProfileId = id && String(id).trim() ? String(id).trim() : null;
    writeStorage(PROFILE_KEY, this.viewerProfileId);
  }

  hasBearerSession(): boolean {
    return !!this.getAccessToken();
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
    const token = this.getAccessToken();
    const profileId = this.getViewerProfileId();

    const headers: Record<string, string> = {
      "X-ST-Platform": "webos",
      "X-ST-Device": "lg-tv",
    };
    if (acceptsJSON) headers["Accept"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;
    // Production CORS + middleware read X-ST-Viewer-Profile and inject
    // st_viewer_profile cookies for getServerSession routes.
    if (profileId) {
      headers["X-ST-Viewer-Profile"] = profileId;
      headers["X-Viewer-Profile-Id"] = profileId;
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
        // Bearer sessions must omit cookies (CORS Allow-Origin: * cannot pair
        // with credentials:include). Cookie path is DEV-only.
        credentials: token ? "omit" : import.meta.env.DEV ? "include" : "omit",
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
    const body = (data ?? {}) as ApiErrorBody & { mfaRequired?: boolean };
    const message = body?.error;
    if (body?.mfaRequired || message === "Authenticator code required.") {
      return new ApiError(
        "mfaRequired",
        message || "Authenticator code required.",
        status || 401,
        { mfaRequired: true },
      );
    }
    if (message) {
      if (status === 402 || body.paymentRequired) return new ApiError("paymentRequired", message, status);
      if (status === 401) return new ApiError("unauthorized", message, status);
      return new ApiError("server", message, status);
    }
    if (status === 401) return new ApiError("unauthorized", "Please sign in again.", status);
    if (status === 402) return new ApiError("paymentRequired", "Complete your subscription on the web.", status);
    return new ApiError("server", `Request failed (${status}).`, status);
  }
}

export const apiClient = new ApiClient();
