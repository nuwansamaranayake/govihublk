// Typed API client for GoviHub backend
// - Access token stored in memory (not localStorage for XSS safety)
// - Auto-refresh on 401 using httpOnly refresh cookie
// - Credentials: 'include' for cookies

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002/api/v1";

// ── In-memory token store ──────────────────────────────────────────────────
let accessToken: string | null = null;

// Track whether the token came from beta/dev login (sessionStorage)
// vs. Google OAuth (cookie). Beta tokens must NOT be cleared by failed refresh.
let isBetaToken = false;

export function setAccessToken(token: string | null, beta = false): void {
  accessToken = token;
  isBetaToken = token ? beta : false;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ── Types ──────────────────────────────────────────────────────────────────
export interface ApiError {
  status: number;
  code?: string;
  message: string;
  details?: unknown;
}

export class ApiException extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiException";
    this.status = error.status;
    this.code = error.code;
    this.details = error.details;
  }
}

// ── Token refresh ──────────────────────────────────────────────────────────
let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  // Beta/dev tokens use sessionStorage, not cookies — skip cookie refresh entirely
  if (isBetaToken) {
    return accessToken;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      accessToken = null;
      return null;
    }
    const data = await res.json();
    const token: string = data.access_token;
    accessToken = token;
    return token;
  } catch {
    accessToken = null;
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

// ── Core request ───────────────────────────────────────────────────────────
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isRetry = false
): Promise<T> {
  const headers: Record<string, string> = {};

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers,
    body:
      body instanceof FormData
        ? body
        : body !== undefined
        ? JSON.stringify(body)
        : undefined,
  });

  // Auto-refresh on 401
  if (res.status === 401 && !isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(method, path, body, true);
    }
    throw new ApiException({ status: 401, message: "Unauthorized" });
  }

  if (!res.ok) {
    let errBody: Record<string, unknown> = {};
    try {
      errBody = await res.json();
    } catch {
      // non-JSON error body
    }
    // Handle nested error format: {"error": {"code": ..., "message": ...}}
    const nestedError = errBody.error as Record<string, unknown> | undefined;
    const code =
      (nestedError?.code as string) || (errBody.code as string) || undefined;

    // 428 PROFILE_INCOMPLETE — redirect the user to /complete-profile, then
    // reject so the caller sees a clean error (not a partial success).
    if (res.status === 428 && code === "PROFILE_INCOMPLETE" && typeof window !== "undefined") {
      const locale = window.location.pathname.split("/")[1] || "en";
      const current = window.location.pathname + window.location.search;
      if (!current.includes("/complete-profile")) {
        sessionStorage.setItem("resumeAfterProfile", current);
        window.location.href = `/${locale}/auth/complete-profile`;
      }
    }

    throw new ApiException({
      status: res.status,
      code,
      message:
        (nestedError?.message as string) ||
        (errBody.message as string) ||
        (Array.isArray(errBody.detail)
          ? errBody.detail.map((d: any) => d.msg).join("; ")
          : (errBody.detail as string)) ||
        res.statusText,
      details: errBody,
    });
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return res.json() as Promise<T>;
}

// ── Public API methods ─────────────────────────────────────────────────────
export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>("GET", path);
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("POST", path, body);
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("PUT", path, body);
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("PATCH", path, body);
  },

  delete<T>(path: string): Promise<T> {
    return request<T>("DELETE", path);
  },

  upload<T>(path: string, formData: FormData, method: "POST" | "PUT" = "POST"): Promise<T> {
    return request<T>(method, path, formData);
  },
};

export default api;
