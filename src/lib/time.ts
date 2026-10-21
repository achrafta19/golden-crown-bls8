/**
 * Algeria time utilities.
 * All slot windows, cooldowns and countdowns are expressed in Africa/Algiers
 * (UTC+01:00, no DST) — matching the official BLS release times.
 */

export const ALGERIA_TZ = "Africa/Algiers";

export const TZ_LABEL = "Algeria Time (UTC+1)";

/** Minutes offset of Africa/Algiers versus UTC (constant, +60). */
export const ALGERIA_OFFSET_MIN = 60;

export type DayKey = string; // YYYY-MM-DD

/** Current instant expressed as a Date shifted so UTC getters read Algiers time. */
export function algeriaNow(base: Date = new Date()): Date {
  return new Date(base.getTime() + ALGERIA_OFFSET_MIN * 60_000);
}

/** Format a Date as `YYYY-MM-DD HH:mm:ss` in Algiers local time. */
export function fmtAlgiers(date: Date, withTime = true): string {
  const d = algeriaNow(date);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const day = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  if (!withTime) return day;
  return `${day} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

export function algiersDayKey(date: Date = new Date()): DayKey {
  return fmtAlgiers(date, false);
}

export function algiersTime(date: Date = new Date()): string {
  const d = algeriaNow(date);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** 0 = Sunday … 6 = Saturday (Algiers local) */
export function algiersDayOfWeek(date: Date = new Date()): number {
  return algeriaNow(date).getUTCDay();
}

/** Milliseconds remaining until the next given Algiers HH:MM on a weekday. */
export function msUntilNext(
  weekday: number,
  hhmm: string,
  from: Date = new Date(),
): number {
  const [hh, mm] = hhmm.split(":").map((n) => Number.parseInt(n, 10));
  const probe = algeriaNow(from);
  const currentMinutes = probe.getUTCHours() * 60 + probe.getUTCMinutes();
  const targetMinutes = hh * 60 + mm;
  const today = probe.getUTCDay();

  let dayOffset = (weekday - today + 7) % 7;
  let deltaMinutes = targetMinutes - currentMinutes;
  if (dayOffset === 0 && deltaMinutes <= 0) {
    dayOffset = 7;
  }
  const totalMinutes = dayOffset * 24 * 60 + (targetMinutes - currentMinutes);
  return totalMinutes * 60_000;
}

export function nextOccurrence(
  weekday: number,
  hhmm: string,
  from: Date = new Date(),
): Date {
  return new Date(from.getTime() + msUntilNext(weekday, hhmm, from));
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const target = d.getUTCMonth() + months;
  d.setUTCMonth(target);
  return d;
}

/** One calendar month in Algiers terms (used for the re-booking cooldown). */
export function monthKey(date: Date = new Date()): string {
  return fmtAlgiers(date, false).slice(0, 7);
}

export function addDaysAlgiers(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/* ------------------------------------------------------------------ */
/* Official BLS Algeria release slots                                   */
/* ------------------------------------------------------------------ */

export type SlotKind = "FRIDAY_1600" | "TUESDAY_1700";

export const SLOT_DEFS: Record<
  SlotKind,
  { weekday: number; time: string; label: string; labelFr: string; labelEn: string }
> = {
  FRIDAY_1600: {
    weekday: 5, // Friday
    time: "16:00",
    label: "الجمعة 16:00",
    labelFr: "Vendredi 16:00",
    labelEn: "Friday 16:00",
  },
  TUESDAY_1700: {
    weekday: 2, // Tuesday
    time: "17:00",
    label: "الثلاثاء 17:00",
    labelFr: "Mardi 17:00",
    labelEn: "Tuesday 17:00",
  },
};

export const SLOT_KINDS: SlotKind[] = ["FRIDAY_1600", "TUESDAY_1700"];

export function slotLabel(kind: string, locale: "ar" | "fr" | "en" = "ar"): string {
  const def = SLOT_DEFS[kind as SlotKind];
  if (!def) return kind;
  if (locale === "fr") return def.labelFr;
  if (locale === "en") return def.labelEn;
  return def.label;
}