"use client"
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { signup, login, checkAuth } from "@/api/auth"
import { useRouter } from "next/navigation";

import { STORAGE_KEYS, removeKey } from "@/lib/storage";

export interface AuthUser {
  name: string;
  email: string;
}

export interface AuthResult {
  success: boolean;
  message?: string;
  error?: string;
}

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  /**
   * Order matters and used to be wrong here.
   *
   * The context type declared `(email, password, name)` while both the
   * implementation and its only caller used `(name, email, password)`. Because
   * all three are strings, TypeScript could not see the mismatch — the
   * signature simply documented the opposite of what the function did.
   */
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  signOut: () => void;
} | null;

const AuthContext = createContext<AuthContextValue>(null);

/** Split a display name into the first/last pair the API expects. */
export function splitName(name: string): { fname: string; lname: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    fname: parts[0] ?? "",
    // A single-word name previously left `lname` as `undefined`, which was
    // serialised into the request body as a missing field.
    lname: parts.slice(1).join(" ") || parts[0] || "",
  };
}

function readToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEYS.token) ?? "";
  } catch {
    return "";
  }
}

function message(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    /**
     * Restore the session — but only if there is one to restore.
     *
     * `checkAuth()` used to fire on every mount regardless, so a first-time
     * visitor's very first action was an unauthenticated request that was
     * always going to 401. Now a missing token short-circuits it, which also
     * means the sign-in page stops waiting on a network round trip before it
     * will render.
     */
    if (!readToken()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async function () {
      try {
        const response = await checkAuth();
        if (cancelled) return;
        setUser({
          name: `${response.fname} ${response.lname}`.trim(),
          email: response.email,
        });
      } catch {
        if (cancelled) return;
        // The stored token is no longer good for anything; drop it rather than
        // retrying it on every subsequent request.
        removeKey(STORAGE_KEYS.token);
        setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      setIsLoading(true);

      try {
        const response = await login({ email, password });

        if (!response.token || response.token.trim().length === 0) {
          throw new Error("The server did not return a session token.");
        }

        window.localStorage.setItem(STORAGE_KEYS.token, response.token);

        setUser({
          name: `${response.user?.fname ?? ""} ${response.user?.lname ?? ""}`.trim(),
          email: response.user?.email ?? email,
        });

        return { success: true, message: response.message };
      } catch (error) {
        return { success: false, error: message(error, "Sign-in failed") };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string): Promise<AuthResult> => {
      setIsLoading(true);

      try {
        const { fname, lname } = splitName(name);
        const response = await signup({ fname, lname, email, password });

        /*
         * Deliberately does NOT sign the new account in.
         *
         * It used to call `setUser({ name, email })` on success even though
         * signup returns no token — so the app believed someone was signed in
         * while every authenticated request they made would 401. The caller
         * sends them to the sign-in page, which is now the truth.
         */
        return { success: true, message: response.message };
      } catch (error) {
        return { success: false, error: message(error, "Sign-up failed") };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const signOut = useCallback(() => {
    setUser(null);
    removeKey(STORAGE_KEYS.token);
    // Signing out left the user sitting inside the workbench with no session,
    // where the layout's redirect effect would eventually bounce them. Going
    // there directly is both faster and less confusing.
    router.replace("/signin");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
