"use client";

// Lightweight client-side i18n. The whole app is client-rendered (analysis
// runs in the browser), so locale is React state persisted to localStorage —
// no route segments or middleware needed at this stage.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { DICTIONARIES, LOCALES, type Dict, type Locale } from "./dictionaries";

export { LOCALES, type Locale, type Dict };

const STORAGE_KEY = "logos.locale";

type I18n = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dict: Dict;
  /** Interpolate {placeholders} in a dictionary string. */
  format: (template: string, vars: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18n | null>(null);

function isLocale(v: string | null): v is Locale {
  return LOCALES.some((l) => l.code === v);
}

export function format(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (m, key) =>
    key in vars ? String(vars[key]) : m
  );
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    // Restoring the persisted locale must happen after mount: reading
    // localStorage in the initializer would make server and client HTML
    // disagree and break hydration.
    const stored = localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isLocale(stored)) setLocaleState(stored);
  }, []);

  useEffect(() => {
    const meta = LOCALES.find((l) => l.code === locale);
    if (meta) document.documentElement.lang = meta.htmlLang;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return (
    <I18nContext.Provider
      value={{ locale, setLocale, dict: DICTIONARIES[locale], format }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <LocaleProvider>");
  return ctx;
}
