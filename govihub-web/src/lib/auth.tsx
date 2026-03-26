"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { api, setAccessToken, ApiException } from "./api";

// ── Types ───────────────────────────────────────────────────────────────────
export type UserRole = "farmer" | "buyer" | "supplier" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string | null;
  phone?: string | null;
  district?: string | null;
  isProfileComplete: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** true while the initial token hydration is in progress */
  isLoading: boolean;
  /** true once the token (if any) has been set in the API client — safe to make API calls */
  isReady: boolean;
  login: (code: string, redirectUri: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  updateUser: (updates: Partial<AuthUser>) => void;
}

// ── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// ── Backend shapes ───────────────────────────────────────────────────────────
interface TokenResponse {
  access_token: string;
  token_type: string;
}

interface MeResponse {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string | null;
  phone?: string | null;
  district?: string | null;
  is_profile_complete: boolean;
}

function mapUser(me: MeResponse): AuthUser {
  return {
    id: me.id,
    email: me.email,
    name: me.name,
    role: me.role,
    avatar: me.avatar,
    phone: me.phone,
    district: me.district,
    isProfileComplete: me.is_profile_complete,
  };
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const initialized = useRef(false);

  // Try to restore session on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Check for beta/dev login token in sessionStorage first
    const storedToken =
      typeof window !== "undefined"
        ? sessionStorage.getItem("govihub_token") ||
          sessionStorage.getItem("govihub_dev_token")
        : null;

    if (storedToken) {
      // Hydrate the in-memory token SYNCHRONOUSLY before any child renders
      setAccessToken(storedToken, true);
      // Mark ready immediately — token is in the API client now
      setIsReady(true);
      // Fetch user profile (non-blocking — pages can already call API)
      api
        .get<MeResponse>("/users/me")
        .then((me) => setUser(mapUser(me)))
        .catch(() => {
          // Token expired or invalid — clear it
          setAccessToken(null);
          setIsReady(false);
          sessionStorage.removeItem("govihub_token");
          sessionStorage.removeItem("govihub_dev_token");
        })
        .finally(() => setIsLoading(false));
    } else {
      // Fall back to cookie-based refresh (Google OAuth flow)
      refreshSession().finally(() => {
        setIsReady(true);
        setIsLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    // If we have a beta/dev token in sessionStorage, use it directly — don't call /auth/refresh
    const storedToken =
      typeof window !== "undefined"
        ? sessionStorage.getItem("govihub_token") ||
          sessionStorage.getItem("govihub_dev_token")
        : null;

    if (storedToken) {
      try {
        setAccessToken(storedToken, true);
        const me = await api.get<MeResponse>("/users/me");
        setUser(mapUser(me));
        return true;
      } catch {
        setAccessToken(null);
        setUser(null);
        return false;
      }
    }

    // Cookie-based refresh (Google OAuth flow)
    try {
      const tokenData = await api.post<TokenResponse>("/auth/refresh");
      setAccessToken(tokenData.access_token);
      const me = await api.get<MeResponse>("/users/me");
      setUser(mapUser(me));
      return true;
    } catch (err) {
      if (err instanceof ApiException && err.status === 401) {
        setAccessToken(null);
        setUser(null);
      }
      return false;
    }
  }, []);

  const login = useCallback(
    async (code: string, redirectUri: string): Promise<void> => {
      const tokenData = await api.post<TokenResponse>("/auth/google/callback", {
        code,
        redirect_uri: redirectUri,
      });
      setAccessToken(tokenData.access_token);
      const me = await api.get<MeResponse>("/users/me");
      setUser(mapUser(me));
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post("/auth/logout");
    } catch {
      // best-effort
    } finally {
      setAccessToken(null);
      setUser(null);
      // Clear all session data
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("govihub_token");
        sessionStorage.removeItem("govihub_dev_token");
        sessionStorage.removeItem("govihub_dev_user");
        // Clear auth cookie so middleware redirects
        document.cookie = "govihub_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
    }
  }, []);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    isReady,
    login,
    logout,
    refreshSession,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
