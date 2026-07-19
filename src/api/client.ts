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

/**
 * Thin fetch wrapper mirroring the iOS `APIClient`. All requests include
 * credentials so the NextAuth session + viewer-profile cookies set by the web
 * backend are attached on the TV, exactly like the mobile clients.
 */
class ApiClient {
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
      "User-Agent": "StoryTimeUniverseWebOS/1.0",
    };
    if (acceptsJSON) headers["Accept"] = "application/json";

    let body: BodyInit | undefined;
    if (jsonBody !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(jsonBody);
    } else if (formBody) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = Object.entries(formBody)
        .map(
          ([k, v]) =>
            `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
        )
        .join("&");
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body,
        credentials: "include",
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
