"use client";

// Client-side auth over Supabase. Guests get an anonymous session (via
// ensureSession); "signing up" upgrades that session in place — email/password
// with updateUser, or an OAuth provider with linkIdentity — so the user_id
// (and therefore all uploaded logos and bookmarks) is preserved
// (docs/account-design.md §1). In localStorage mode auth is disabled.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ensureSession, hasSupabase, supabase } from "@/lib/supabase/client";

/** OAuth providers wired in the UI. Each activates once enabled in Supabase. */
export type OAuthProvider = "google" | "apple" | "figma";

export type AuthUser = {
  id: string;
  email: string | null;
  isAnonymous: boolean;
};

type AuthResult = {
  error: string | null;
  /** True when the account was created but still needs email confirmation. */
  pendingConfirmation?: boolean;
};

type AuthState = {
  /** Whether auth exists at all (false in localStorage mode → hide auth UI). */
  enabled: boolean;
  loading: boolean;
  user: AuthUser | null;
  /** Signed in with a real identity (not the anonymous guest session). */
  isSignedIn: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function toUser(u: {
  id: string;
  email?: string | null;
  is_anonymous?: boolean;
} | null): AuthUser | null {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? null,
    isAnonymous: u.is_anonymous ?? false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(hasSupabase);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!hasSupabase) return;
    let active = true;
    (async () => {
      await ensureSession();
      const { data } = await supabase.auth.getUser();
      if (active) {
        setUser(toUser(data.user));
        setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(toUser(session?.user ?? null));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Upgrade the anonymous session to an email/password account, keeping the
  // same user_id. (If email confirmation is enabled in Supabase, is_anonymous
  // stays true until the user confirms — see README.)
  const signUpWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { data, error } = await supabase.auth.updateUser({ email, password });
      if (error) return { error: error.message };
      // With email confirmation enabled the user stays anonymous until they
      // click the link; surface that instead of a silent no-op.
      return { error: null, pendingConfirmation: data.user?.is_anonymous ?? false };
    },
    []
  );

  // Sign into an existing account. This replaces the current anonymous session
  // (its data stays under that anonymous user; the real account has its own).
  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    []
  );

  const signInWithOAuth = useCallback(
    async (provider: OAuthProvider): Promise<AuthResult> => {
      const redirectTo =
        typeof window !== "undefined" ? window.location.href : undefined;
      // linkIdentity attaches the provider to the current (anonymous) user,
      // preserving the guest's uploads. Falls back to a plain OAuth sign-in
      // for a user who is already permanent.
      const { data } = await supabase.auth.getUser();
      const fn = data.user?.is_anonymous
        ? supabase.auth.linkIdentity({ provider, options: { redirectTo } })
        : supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
      const { error } = await fn;
      return { error: error?.message ?? null };
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Return to a fresh guest session so the app keeps working.
    await ensureSession();
    const { data } = await supabase.auth.getUser();
    setUser(toUser(data.user));
  }, []);

  const value: AuthState = {
    enabled: hasSupabase,
    loading,
    user,
    isSignedIn: Boolean(user && !user.isAnonymous),
    signUpWithEmail,
    signInWithEmail,
    signInWithOAuth,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
