"use client";

// Account control for the app headers: a "Sign in" affordance for guests that
// opens an auth dialog (Google → Apple → Figma → email), and for signed-in
// users an avatar menu (Assets / settings / labs / sign out). In localStorage
// mode (no auth) the Brand Manager and labs links render as plain links.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth, type OAuthProvider } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";

const PROVIDERS: { id: OAuthProvider; label: string; icon: React.ReactNode }[] = [
  {
    id: "google",
    label: "Google",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
        <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
      </svg>
    ),
  },
  {
    id: "apple",
    label: "Apple",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
        <path d="M16.36 12.9c.02 2.36 2.07 3.15 2.1 3.16-.02.06-.33 1.13-1.08 2.24-.65.96-1.32 1.91-2.38 1.93-1.04.02-1.38-.62-2.57-.62-1.2 0-1.57.6-2.55.64-1.02.04-1.8-1.04-2.46-2-1.34-1.94-2.37-5.49-.99-7.88.68-1.19 1.9-1.94 3.23-1.96 1-.02 1.95.68 2.57.68.61 0 1.77-.84 2.98-.72.51.02 1.93.2 2.85 1.55-.07.05-1.7 1-1.68 2.97ZM14.42 4.9c.55-.67.92-1.6.82-2.53-.79.03-1.75.53-2.32 1.19-.51.59-.96 1.53-.84 2.44.88.07 1.79-.45 2.34-1.1Z" />
      </svg>
    ),
  },
  {
    id: "figma",
    label: "Figma",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
        <path fill="#1ABCFE" d="M12 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z" />
        <path fill="#0ACF83" d="M6 18a3 3 0 0 1 3-3h3v3a3 3 0 1 1-6 0Z" />
        <path fill="#FF7262" d="M12 3v6h3a3 3 0 1 0 0-6h-3Z" />
        <path fill="#F24E1E" d="M6 6a3 3 0 0 0 3 3h3V3H9a3 3 0 0 0-3 3Z" />
        <path fill="#A259FF" d="M6 12a3 3 0 0 0 3 3h3V9H9a3 3 0 0 0-3 3Z" />
      </svg>
    ),
  },
];

export default function Account({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const { enabled, loading, isSignedIn, user, signInWithOAuth, signUpWithEmail, signInWithEmail, signOut } =
    useAuth();
  const { dict } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"create" | "signin">("create");
  // "form" collects credentials; "sent" is the post-signup confirm-email panel.
  const [phase, setPhase] = useState<"form" | "sent">("form");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Once the session becomes a real signed-in account (e.g. instant signup when
  // email confirmation is off, or a successful sign-in), close the dialog.
  useEffect(() => {
    if (isSignedIn) dialogRef.current?.close();
  }, [isSignedIn]);

  // Close the avatar menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // localStorage mode (no auth): an avatar-only menu. No email/logout, but the
  // internal Labs entrance, Assets, and Settings stay reachable here.
  if (!enabled) {
    return (
      <div ref={menuRef} className="relative">
        <AvatarButton
          initial="•"
          tone={tone}
          open={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        />
        {menuOpen && (
          <AccountMenu
            onNavigate={() => setMenuOpen(false)}
            labs={dict.header.labs}
            assets={dict.header.assets}
            settings={dict.header.settings}
          />
        )}
      </div>
    );
  }

  const open = (initial: "create" | "signin" = "create") => {
    setMode(initial);
    setPhase("form");
    setError(null);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  const switchMode = (next: "create" | "signin") => {
    setMode(next);
    setPhase("form");
    setError(null);
  };

  // Read from the form via FormData rather than controlled state: React's
  // synthetic onChange does not fire for inputs inside a showModal() <dialog>
  // (top layer), so controlled inputs desync. onSubmit/onClick still work.
  const submitEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setBusy(true);
    setError(null);
    const { error, pendingConfirmation } =
      mode === "create"
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);
    setBusy(false);
    if (error) {
      setError(error);
    } else if (pendingConfirmation) {
      // Email confirmation is on: show a terminal panel so the user can't
      // re-submit updateUser (which would error "password unchanged").
      setPhase("sent");
    }
    // Otherwise the session is now signed in; the effect above closes the dialog.
  };

  const oauth = async (provider: OAuthProvider) => {
    setError(null);
    const { error } = await signInWithOAuth(provider);
    if (error) setError(error);
    // Success redirects away; nothing else to do.
  };

  const linkCls = cn(
    "text-sm transition-colors",
    tone === "dark" ? "text-ink-muted hover:text-ink" : "text-white/70 hover:text-white"
  );

  return (
    <>
      {loading ? (
        <span aria-hidden="true" className={cn("inline-block h-4 w-16 animate-pulse rounded", tone === "dark" ? "bg-hairline" : "bg-white/20")} />
      ) : isSignedIn ? (
        <div ref={menuRef} className="relative">
          <AvatarButton
            initial={(user?.email?.[0] ?? "•").toUpperCase()}
            tone={tone}
            open={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          />
          {menuOpen && (
            <AccountMenu
              email={user?.email}
              labs={dict.header.labs}
              assets={dict.header.assets}
              settings={dict.header.settings}
              signOutLabel={dict.auth.signOut}
              onNavigate={() => setMenuOpen(false)}
              onSignOut={() => {
                setMenuOpen(false);
                void signOut();
              }}
            />
          )}
        </div>
      ) : (
        <button type="button" onClick={() => open("create")} className={linkCls}>
          {dict.auth.signIn}
        </button>
      )}

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          // Backdrop click (the dialog element itself) closes it.
          if (e.target === dialogRef.current) close();
        }}
        className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-hairline bg-paper p-0 text-ink backdrop:bg-ink/40"
      >
        <div className="flex flex-col gap-6 p-8">
          <div>
            <h2 className="font-display text-2xl font-medium text-balance">
              {phase === "sent"
                ? dict.auth.sentTitle
                : mode === "create"
                  ? dict.auth.title
                  : dict.auth.signInTitle}
            </h2>
            <p className="mt-2 text-pretty text-sm text-ink-muted">
              {phase === "sent"
                ? dict.auth.checkEmail
                : mode === "create"
                  ? dict.auth.subtitle
                  : dict.auth.signInSubtitle}
            </p>
          </div>

          {phase === "sent" ? (
            <button
              type="button"
              onClick={close}
              className="bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-accent"
            >
              {dict.auth.close}
            </button>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void oauth(p.id)}
                    className="flex items-center justify-center gap-3 rounded-lg border border-hairline px-4 py-2.5 text-sm font-medium transition-colors hover:border-ink"
                  >
                    {p.icon}
                    {dict.auth.continueWith.replace("{provider}", p.label)}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-hairline" />
                <span className="font-mono text-xs uppercase text-ink-faint">
                  {dict.auth.or}
                </span>
                <span className="h-px flex-1 bg-hairline" />
              </div>

              {/* key forces fresh inputs when switching modes (autocomplete). */}
              <form key={mode} onSubmit={submitEmail} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ink-muted">{dict.auth.email}</span>
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    className="rounded-lg border border-hairline bg-paper px-3 py-2 text-sm focus:border-ink focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ink-muted">{dict.auth.password}</span>
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={6}
                    autoComplete={mode === "create" ? "new-password" : "current-password"}
                    className="rounded-lg border border-hairline bg-paper px-3 py-2 text-sm focus:border-ink focus:outline-none"
                  />
                </label>
                {error && (
                  <p aria-live="polite" className="text-pretty text-sm text-red-600">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-1 bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {busy
                    ? dict.auth.working
                    : mode === "create"
                      ? dict.auth.createAccount
                      : dict.auth.signInEmail}
                </button>
              </form>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => switchMode(mode === "create" ? "signin" : "create")}
                  className="text-ink-muted underline underline-offset-2 hover:text-ink"
                >
                  {mode === "create" ? dict.auth.haveAccount : dict.auth.needAccount}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="text-ink-faint hover:text-ink"
                >
                  {dict.auth.close}
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}

// Avatar trigger: icon only (the identity affordance). No email beside it —
// the email lives inside the opened menu.
function AvatarButton({
  initial,
  tone,
  open,
  onClick,
}: {
  initial: string;
  tone: "dark" | "light";
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label="Account"
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-full bg-accent font-mono text-xs font-semibold text-white transition-transform hover:scale-105",
        open && "ring-2 ring-accent/40 ring-offset-2 ring-offset-paper",
        tone === "light" && "ring-offset-transparent",
      )}
    >
      {initial}
    </button>
  );
}

// The account menu: identity (email) + account actions. Labs is the internal
// entrance — it belongs here (staff-only), NOT in the public hamburger.
function AccountMenu({
  email,
  labs,
  assets,
  settings,
  signOutLabel,
  onNavigate,
  onSignOut,
}: {
  email?: string | null;
  labs: string;
  assets: string;
  settings: string;
  signOutLabel?: string;
  onNavigate: () => void;
  onSignOut?: () => void;
}) {
  return (
    <div
      role="menu"
      className="absolute top-full right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-hairline bg-paper py-1.5 shadow-lg"
    >
      {email && (
        <p className="truncate border-b border-hairline px-4 pt-1.5 pb-2.5 font-mono text-xs text-ink-muted">
          {email}
        </p>
      )}
      <Link
        role="menuitem"
        href="/assets"
        onClick={onNavigate}
        className="block px-4 py-2 text-sm text-ink transition-colors hover:bg-ink/5"
      >
        {assets}
      </Link>
      <Link
        role="menuitem"
        href="/settings"
        onClick={onNavigate}
        className="block px-4 py-2 text-sm text-ink transition-colors hover:bg-ink/5"
      >
        {settings}
      </Link>
      <Link
        role="menuitem"
        href="/labs"
        onClick={onNavigate}
        className="flex items-center gap-2 px-4 py-2 text-sm text-ink transition-colors hover:bg-ink/5"
      >
        {labs}
        <span className="rounded-full border border-hairline px-1.5 py-0.5 text-[9px] text-ink-faint">
          社内
        </span>
      </Link>
      {onSignOut && (
        <>
          <div aria-hidden="true" className="my-1.5 h-px bg-hairline" />
          <button
            type="button"
            role="menuitem"
            onClick={onSignOut}
            className="block w-full px-4 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            {signOutLabel}
          </button>
        </>
      )}
    </div>
  );
}
