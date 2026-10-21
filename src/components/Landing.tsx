"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LocaleProvider, LocaleSwitcher, useLocale } from "./LocaleProvider";
import { AlgeriaClock, Countdown } from "./AlgeriaClock";

/* ------------------------------------------------------------------ */
/* Backdrop                                                             */
/* ------------------------------------------------------------------ */

function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 700px at 15% -5%, rgba(201,162,39,0.16), transparent 60%), radial-gradient(1000px 600px at 95% 10%, rgba(80,110,220,0.14), transparent 55%), linear-gradient(180deg,#070b18 0%,#0b1020 55%,#070b18 100%)",
        }}
      />
      <div className="aurora" style={{ width: 520, height: 520, top: "-8%", left: "-6%", background: "rgba(201,162,39,0.20)" }} />
      <div className="aurora" style={{ width: 460, height: 460, bottom: "-12%", right: "-4%", background: "rgba(64,96,210,0.20)", animationDelay: "-6s" }} />
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Brand                                                                */
/* ------------------------------------------------------------------ */

function CrownMark({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f7e7a1" />
          <stop offset="45%" stopColor="#e8c86a" />
          <stop offset="100%" stopColor="#c9a227" />
        </linearGradient>
      </defs>
      <path
        fill="url(#cg)"
        d="M8 46 L14 20 L25 32 L32 12 L39 32 L50 20 L56 46 Z"
      />
      <rect x="8" y="48" width="48" height="6" rx="3" fill="url(#cg)" />
      <circle cx="32" cy="9" r="3.2" fill="#f7e7a1" />
      <circle cx="13" cy="17" r="2.4" fill="#e8c86a" />
      <circle cx="51" cy="17" r="2.4" fill="#e8c86a" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Landing                                                              */
/* ------------------------------------------------------------------ */

type Release = { kind: string; algiersTime: string; countdownMs: number };

function LandingInner() {
  const { tr, locale } = useLocale();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const loadPublic = useCallback(async () => {
    try {
      const r = await fetch("/api/public/stats", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      if (j.releases) setReleases(j.releases);

    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    loadPublic();
    const id = setInterval(loadPublic, 30_000);
    return () => clearInterval(id);
  }, [loadPublic]);

  async function enterClient(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.replace(/\D/g, "").slice(0, 5);
    if (clean.length !== 5) {
      setErr(tr("invalid_code"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/client/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: clean }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setErr(tr("invalid_code"));
        return;
      }
      router.push("/client");
    } catch {
      setErr(tr("error"));
    } finally {
      setBusy(false);
    }
  }

  const slots = [
    {
      id: "FRIDAY_1600",
      ar: "الجمعة",
      fr: "Vendredi",
      en: "Friday",
      time: "16:00",
      icon: "🕌",
    },
    {
      id: "TUESDAY_1700",
      ar: "الثلاثاء",
      fr: "Mardi",
      en: "Tuesday",
      time: "17:00",
      icon: "📅",
    },
  ];

  const label = (s: (typeof slots)[number]) =>
    locale === "fr" ? s.fr : locale === "en" ? s.en : s.ar;

  return (
    <main className="relative min-h-screen">
      <Backdrop />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {/* top bar */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CrownMark />
            <div className="leading-tight">
              <div className="gold-text text-lg font-black tracking-tight sm:text-xl">
                {tr("brand_name")}
              </div>
              <div className="text-[11px] text-slate-400">{tr("brand_tagline")}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <Link href="/operator" className="btn-ghost text-sm">
              {tr("operator")}
            </Link>
          </div>
        </header>

        {/* hero */}
        <section className="mt-10 text-center sm:mt-14">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-ink/60 px-4 py-1.5 text-xs text-gold-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            {tr("secure_conn")}
          </div>

          <h1 className="mx-auto mt-6 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            <span className="gold-text">{tr("hero_title")}</span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            {tr("hero_sub")}
          </p>

          {/* entry card */}
          <div className="card mx-auto mt-9 w-full max-w-4xl p-5 sm:p-7">
            <div className="grid gap-7 md:grid-cols-2">
              {/* client */}
              <div className="text-start">
                <div className="mb-1 flex items-center gap-2 text-sm font-bold text-gold-200">
                  <span className="text-lg">🎫</span>
                  {tr("access_portal")}
                </div>
                <p className="mb-4 text-xs text-slate-400">{tr("enter_code")}</p>

                <form onSubmit={enterClient} className="space-y-3">
                  <input
                    className="field code-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={tr("code_placeholder")}
                    value={code}
                    maxLength={5}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 5));
                      setErr(null);
                    }}
                    aria-label={tr("enter_code")}
                  />
                  <button
                    type="submit"
                    disabled={busy || code.length !== 5}
                    className="btn-gold w-full"
                  >
                    {busy ? tr("loading") : tr("enter_code")}
                  </button>
                  {err && (
                    <p role="alert" className="text-center text-xs font-semibold text-rose-400">
                      {err}
                    </p>
                  )}
                </form>

                <div className="mt-4 flex items-start gap-2 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 text-[11px] leading-relaxed text-slate-400">
                  <span className="text-base leading-none">🔒</span>
                  <span>{tr("privacy_note")}</span>
                </div>
              </div>

              {/* slots */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-bold text-gold-200">
                    {tr("slots_title")}
                  </span>
                  <AlgeriaClock compact />
                </div>

                <div className="space-y-3">
                  {slots.map((s) => {
                    const rel = releases.find((r) => r.kind === s.id);
                    return (
                      <div
                        key={s.id}
                        className="rounded-xl border border-gold-500/25 bg-gradient-to-br from-ink-2/90 to-ink/90 p-3.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">{s.icon}</span>
                            <div className="leading-tight">
                              <div className="text-sm font-bold">
                                {label(s)} • {s.time}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {locale === "fr"
                                  ? "Heure d'Algérie"
                                  : locale === "en"
                                    ? "Algeria time"
                                    : "توقيت الجزائر"}
                              </div>
                            </div>
                          </div>
                          {rel ? (
                            <div className="text-end leading-tight">
                              <div className="text-[10px] text-slate-400">
                                {locale === "ar" ? "بعد" : locale === "fr" ? "dans" : "in"}
                              </div>
                              <div className="text-xs font-bold text-emerald-300">
                                <Countdown targetMs={Date.now() + rel.countdownMs} />
                              </div>
                            </div>
                          ) : (
                            <div className="shimmer h-8 w-24 rounded-lg" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* stats */}
            <div className="mt-7 grid grid-cols-3 gap-3 border-t border-slate-700/50 pt-5">
              {[
                { v: "—", l: tr("stats_clients"), i: "👥" },
                { v: "—", l: tr("stats_booked"), i: "✅" },
                { v: "—", l: tr("stats_success"), i: "⚡" },
              ].map((s) => (
                <div key={s.l} className="text-center">
                  <div className="text-2xl font-black text-gold-200">{s.v}</div>
                  <div className="mt-0.5 text-[10px] text-slate-400 sm:text-[11px]">
                    {s.i} {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <footer className="mt-10 flex flex-col items-center gap-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <span>{tr("timezone")}:</span>
              <AlgeriaClock compact />
              <span className="text-slate-600">|</span>
              <span>UTC+01:00</span>
            </div>
            </footer>
        </section>
      </div>
    </main>
  );
}

export default function Landing() {
  return (
    <LocaleProvider>
      <LandingInner />
    </LocaleProvider>
  );
}