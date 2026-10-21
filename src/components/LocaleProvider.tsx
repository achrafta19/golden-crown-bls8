"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { LOCALES, LOCALE_META, t, type Locale, type MessageKey } from "@/lib/i18n";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  tr: (key: MessageKey) => string;
  dir: "rtl" | "ltr";
};

const LocaleCtx = createContext<Ctx | null>(null);

export function useLocale() {
  const ctx = useContext(LocaleCtx);
  if (!ctx) throw new Error("useLocale must be used inside LocaleProvider");
  return ctx;
}

const STORAGE_KEY = "gcr.locale";

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && LOCALES.includes(stored)) setLocaleState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    const html = document.documentElement;
    html.lang = l;
    html.dir = LOCALE_META[l].dir;
  }, []);

  const tr = useCallback((key: MessageKey) => t(key, locale), [locale]);

  return (
    <LocaleCtx.Provider
      value={{ locale, setLocale, tr, dir: LOCALE_META[locale].dir }}
    >
      {children}
    </LocaleCtx.Provider>
  );
}

/** Compact language switcher. */
export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="flex items-center gap-1 rounded-full border border-gold-500/30 bg-ink/60 p-1">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            locale === l
              ? "bg-gradient-to-br from-gold-300 to-gold-600 text-ink shadow"
              : "text-slate-300 hover:text-gold-200"
          }`}
        >
          <span aria-hidden>{LOCALE_META[l].flag}</span>{" "}
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}