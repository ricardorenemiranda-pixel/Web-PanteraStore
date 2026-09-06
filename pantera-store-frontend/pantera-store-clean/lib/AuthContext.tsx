"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { BACKEND_URL } from "./config";

export interface CurrentUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
  role: "customer" | "admin";
  tradeUrl?: string;
  /** Ausente si la cuenta todavía no vinculó Steam (registro local puro). */
  steamId?: string;
  email?: string;
}

export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  tradeUrl: string;
}

class AuthApiError extends Error {
  constructor(message: string) {
    super(message);
  }
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
}

async function parseAuthError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  const message = body?.message;
  if (Array.isArray(message)) return message[0];
  return message ?? `HTTP ${res.status}`;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Se monta UNA sola vez en app/layout.tsx (no en cada página), así la
 * sesión se consulta una sola vez por carga del sitio en vez de en cada
 * navegación — antes cada página tenía su propio <Header/> que volvía a
 * pedir /auth/me desde cero, y por unos milisegundos se veía "Iniciar
 * sesión con Steam" antes de que cargara el usuario real.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/auth/me`, { credentials: "include" });
      setUser(res.ok ? ((await res.json()) as CurrentUser) : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${BACKEND_URL}/auth/logout`, { method: "POST", credentials: "include" }).catch(
      () => {}
    );
    setUser(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      throw new AuthApiError(await parseAuthError(res));
    }
    setUser((await res.json()) as CurrentUser);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await fetch(`${BACKEND_URL}/auth/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new AuthApiError(await parseAuthError(res));
    }
    setUser((await res.json()) as CurrentUser);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout, login, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}
