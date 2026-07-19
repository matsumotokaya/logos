"use client";

// Client-side auth over Supabase. Public browsing starts with an anonymous
// session, but uploading requires a registered identity. Email sign-up upgrades
// the current session in place; OAuth replaces it with the selected account.
// In localStorage mode auth is disabled.

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
export type AuthDialogMode = "create" | "signin";
export const OPEN_AUTH_DIALOG_EVENT = "logos:open-auth";

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
  oauthCallbackError: string | null;
  dismissOAuthCallbackError: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function requestAuthDialog(mode: AuthDialogMode = "create") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AuthDialogMode>(OPEN_AUTH_DIALOG_EVENT, { detail: mode })
  );
}

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

function oauthRedirectUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const url = new URL(window.location.href);
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  url.hash = "";
  return url.toString();
}

const OAUTH_ERROR_PARAMS = ["error", "error_code", "error_description"] as const;

function consumeOAuthCallbackError(): string | null {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const hasOAuthError = OAUTH_ERROR_PARAMS.some(
    (key) => url.searchParams.has(key) || hashParams.has(key)
  );
  if (!hasOAuthError) return null;

  const detail =
    url.searchParams.get("error_description") ??
    hashParams.get("error_description") ??
    url.searchParams.get("error_code") ??
    hashParams.get("error_code") ??
    url.searchParams.get("error") ??
    hashParams.get("error");

  for (const key of OAUTH_ERROR_PARAMS) {
    url.searchParams.delete(key);
    hashParams.delete(key);
  }
  hashParams.delete("sb");
  const remainingHash = hashParams.toString();
  url.hash = remainingHash ? `#${remainingHash}` : "";
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`
  );

  return detail || "OAuth callback failed";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(hasSupabase);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [oauthCallbackError, setOAuthCallbackError] = useState<string | null>(null);

  useEffect(() => {
    const callbackError = consumeOAuthCallbackError();
    const callbackErrorFrame = callbackError
      ? window.requestAnimationFrame(() => setOAuthCallbackError(callbackError))
      : null;
    if (!hasSupabase) {
      return () => {
        if (callbackErrorFrame !== null) window.cancelAnimationFrame(callbackErrorFrame);
      };
    }
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
      if (callbackErrorFrame !== null) window.cancelAnimationFrame(callbackErrorFrame);
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

  // Sign into an existing account, replacing the current anonymous session.
  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    []
  );

  const signInWithOAuth = useCallback(
    async (provider: OAuthProvider): Promise<AuthResult> => {
      // Guests cannot own server data, so replacing the anonymous session is
      // safer than linking it. It also lets an existing email sign back into
      // its original account instead of failing with `email_exists`.
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: oauthRedirectUrl() },
      });
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

  const dismissOAuthCallbackError = useCallback(() => {
    setOAuthCallbackError(null);
  }, []);

  const value: AuthState = {
    enabled: hasSupabase,
    loading,
    user,
    isSignedIn: Boolean(user && !user.isAnonymous),
    signUpWithEmail,
    signInWithEmail,
    signInWithOAuth,
    oauthCallbackError,
    dismissOAuthCallbackError,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
