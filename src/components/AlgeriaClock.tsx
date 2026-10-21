"use client";

import { useEffect, useState } from "react";
import { useLocale } from "./LocaleProvider";
import { TZ_LABEL } from "@/lib/time";

/**
 * Live Algeria-time clock + countdown to the next official BLS release.
 * Africa/Algiers is UTC+1 with no DST, so a fixed offset is exact.
 */
export function AlgeriaClock({ compact = false }: { compact?: boolean }) {
  const { locale } = useLocale();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return <span className="text-slate-500">--:--:--</span>;
  }

  const algiers = new Date(now.getTime() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hh = pad(algiers.getUTCHours());
  const mm = pad(algiers.getUTCMinutes());
  const ss = pad(algiers.getUTCSeconds());

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayName =
    locale === "ar"
      ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][algiers.getUTCDay()]
      : locale === "fr"
        ? ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."][algiers.getUTCDay()]
        : days[algiers.getUTCDay()];

  const dateStr = `${pad(algiers.getUTCDate())}/${pad(algiers.getUTCMonth() + 1)}/${algiers.getUTCFullYear()}`;

  if (compact) {
    return (
      <span className="font-mono tabular-nums text-gold-200">
        {hh}:{mm}:{ss}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="font-mono text-2xl font-bold tabular-nums text-gold-200 sm:text-3xl">
        {hh}:{mm}:{ss}
      </span>
      <span className="text-[11px] text-slate-400">
        {dayName} • {dateStr} • {TZ_LABEL}
      </span>
    </div>
  );
}

/** Countdown timer to a target instant, rendered as DD:HH:MM:SS. */
export function Countdown({ targetMs }: { targetMs: number }) {
  const [left, setLeft] = useState(targetMs);

  useEffect(() => {
    setLeft(targetMs);
    const id = setInterval(() => setLeft(targetMs - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const clamped = Math.max(0, left);
  const d = Math.floor(clamped / 86_400_000);
  const h = Math.floor((clamped % 86_400_000) / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <span className="font-mono tabular-nums">
      {pad(d)}:{pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}