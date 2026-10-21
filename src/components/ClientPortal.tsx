"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LocaleProvider, LocaleSwitcher, useLocale } from "./LocaleProvider";
import { AlgeriaClock } from "./AlgeriaClock";
import { FORM_STEPS } from "@/lib/bls-form";
import {
  FormStepFields,
  StepTitle,
  type FormErrors,
  type FormValues,
} from "./FormStepFields";

type Quota = {
  used: number;
  remaining: number;
  blocked: boolean;
  blockedUntil: string | null;
  nextAvailableAt: string | null;
};

type Run = {
  runId: number;
  reference: string;
  status: string;
  slotKind: string;
  attempts: number;
  maxAttempts: number;
  scheduledFor: string;
  appointmentDate: string | null;
  appointmentTime: string | null;
  confirmationNumber: string | null;
  error: string | null;
  name: string;
  centre: string;
  category: string;
  visaType: string | null;
};

function Inner() {
  const { tr, locale } = useLocale();
  const router = useRouter();

  const [checked, setChecked] = useState(false);
  const [me, setMe] = useState<{ fullName: string; code: string } | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);

  const [step, setStep] = useState(0);
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [slotKind, setSlotKind] = useState<"FRIDAY_1600" | "TUESDAY_1700">("FRIDAY_1600");
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [pairCode, setPairCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/booking/submit", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/");
      return;
    }
    const j = await res.json();
    if (j.ok) {
      setQuota(j.quota);
      setRuns(j.requests ?? []);
    }
  }, [router]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/client/me", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/");
        return;
      }
      const j = await res.json();
      if (j.ok) {
        setMe({ fullName: j.client.fullName, code: j.client.code });
        await load();
        try {
          const br = await fetch("/api/bridge", { cache: "no-store" });
          const bj = await br.json();
          if (bj.ok) setPairCode(bj.pairCode);
        } catch {
          /* ignore */
        }
      }
      setChecked(true);
    })();
  }, [router, load]);

  // poll for live run status
  useEffect(() => {
    if (!checked || !me) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [checked, me, load]);

  function setField(name: string, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => {
      if (!e[name]) return e;
      const n = { ...e };
      delete n[name];
      return n;
    });
  }

  /** Client-side required-field gate before advancing a step. */
  function validateStep(i: number): boolean {
    const def = FORM_STEPS[i];
    if (!def) return true;
    const next: FormErrors = {};
    for (const f of def.fields) {
      if (f.required && !values[f.name]) next[f.name] = "required";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/booking/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotKind, form: values }),
      });
      const j = await res.json();

      if (!res.ok || !j.ok) {
        if (j.fields) setErrors(j.fields);
        if (j.error === "COOLDOWN_ACTIVE") {
          setBanner({
            kind: "err",
            msg:
              locale === "fr"
                ? `Quota épuisé. Ré disponible le ${new Date(j.blockedUntil).toLocaleDateString("fr-FR")}`
                : locale === "en"
                  ? `Quota exhausted. Available again on ${new Date(j.blockedUntil).toLocaleDateString("en-GB")}`
                  : `استُنفدت الحصة. الحجز متاح من ${new Date(j.blockedUntil).toLocaleDateString("ar-DZ")}`,
          });
        } else if (j.error === "VALIDATION_FAILED") {
          setBanner({
            kind: "err",
            msg: locale === "fr" ? "Formulaire incomplet" : locale === "en" ? "Incomplete form" : "الاستمارة غير مكتملة",
          });
        } else if (j.error === "QUOTA_EXHAUSTED") {
          setBanner({ kind: "err", msg: tr("cooldown_msg") });
        } else {
          setBanner({ kind: "err", msg: j.error ?? tr("error") });
        }
        return;
      }

      setBanner({
        kind: "ok",
        msg:
          locale === "fr"
            ? `Demande armée — référence ${j.reference}`
            : locale === "en"
              ? `Request armed — reference ${j.reference}`
              : `تم تجهيز الطلب — رقم ${j.reference}`,
      });
      setValues({});
      setStep(0);
      await load();
    } catch {
      setBanner({ kind: "err", msg: tr("error") });
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  const slots = useMemo(
    () => [
      {
        id: "FRIDAY_1600" as const,
        ar: "الجمعة 16:00",
        fr: "Vendredi 16:00",
        en: "Friday 16:00",
        icon: "🕌",
      },
      {
        id: "TUESDAY_1700" as const,
        ar: "الثلاثاء 17:00",
        fr: "Mardi 17:00",
        en: "Tuesday 17:00",
        icon: "📅",
      },
    ],
    [],
  );

  const statusMeta: Record<string, { cls: string; ar: string; fr: string; en: string }> = {
    QUEUED: { cls: "bg-slate-600/30 text-slate-300 border-slate-500/40", ar: "في الانتظار", fr: "En attente", en: "Queued" },
    ARMED: { cls: "bg-sky-600/25 text-sky-300 border-sky-500/40", ar: "جاهز للإطلاق", fr: "Prêt", en: "Armed" },
    WAITING_CAPTCHA: { cls: "bg-amber-600/25 text-amber-300 border-amber-500/40", ar: "بانتظار الكابتشا", fr: "Captcha en attente", en: "Awaiting captcha" },
    PROCESSING: { cls: "bg-violet-600/25 text-violet-300 border-violet-500/40", ar: "جارٍ الحجز", fr: "En cours", en: "Processing" },
    BOOKED: { cls: "bg-emerald-600/25 text-emerald-300 border-emerald-500/40", ar: "تم الحجز ✓", fr: "Réservé ✓", en: "Booked ✓" },
    FAILED: { cls: "bg-rose-600/25 text-rose-300 border-rose-500/40", ar: "فشل", fr: "Échec", en: "Failed" },
    CANCELLED: { cls: "bg-slate-600/30 text-slate-400 border-slate-500/40", ar: "ملغى", fr: "Annulé", en: "Cancelled" },
  };

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="shimmer h-10 w-40 rounded-xl" />
      </div>
    );
  }

  const blocked = quota?.blocked ?? false;
  const L = (a: string, f: string, e: string) => (locale === "fr" ? f : locale === "en" ? e : a);

  return (
    <main className="min-h-screen">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(900px 500px at 50% -10%, rgba(201,162,39,0.12), transparent 60%), linear-gradient(180deg,#070b18,#0b1020)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        {/* header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="gold-text text-xl font-black">
              {L("بوابة العميل", "Espace client", "Client portal")}
            </h1>
            <p className="text-xs text-slate-400">
              {L("مرحبًا", "Bienvenue", "Welcome")} <span className="text-gold-200">{me?.fullName}</span>
              {" · "}
              <span className="font-mono">{me?.code}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <AlgeriaClock compact />
            <LocaleSwitcher />
            <button onClick={logout} className="btn-ghost text-xs">
              {tr("logout")}
            </button>
          </div>
        </header>

        {/* quota */}
        <div className="card mt-5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-300">{tr("my_quota")}</div>
              <div className="mt-1 flex items-center gap-1.5">
                {Array.from({ length: 2 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-3 w-10 rounded-full ${
                      i < (quota?.remaining ?? 0)
                        ? "bg-gradient-to-r from-gold-300 to-gold-600 shadow"
                        : "bg-slate-700"
                    }`}
                  />
                ))}
                <span className="ms-2 text-xs text-slate-400">
                  {quota?.remaining ?? 0} {tr("quota_left")}
                </span>
              </div>
            </div>
            <div className="text-end">
              <div className="text-xs text-slate-400">{tr("timezone")}</div>
              <AlgeriaClock compact />
            </div>
          </div>

          {blocked && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
              {tr("cooldown_msg")}
              {quota?.blockedUntil && (
                <span className="ms-1 opacity-80">
                  (
                  {new Date(quota.blockedUntil).toLocaleString(
                    locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-FR" : "en-GB",
                    { timeZone: "Africa/Algiers" },
                  )}
                  )
                </span>
              )}
            </div>
          )}
        </div>

        {banner && (
          <div
            className={`mt-4 rounded-xl border p-3 text-sm font-semibold ${
              banner.kind === "ok"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/40 bg-rose-500/10 text-rose-300"
            }`}
          >
            {banner.msg}
          </div>
        )}

        {/* new request */}
        <section className="card mt-5 p-5">
          <h2 className="text-base font-bold text-gold-100">{tr("new_request")}</h2>

          {/* slot choice */}
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold text-slate-300">{tr("choose_slot")}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {slots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSlotKind(s.id)}
                  disabled={blocked}
                  className={`rounded-xl border p-3.5 text-start transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    slotKind === s.id
                      ? "border-gold-400 bg-gradient-to-br from-gold-400/20 to-gold-700/10 shadow-lg"
                      : "border-slate-600/70 bg-slate-900/40 hover:border-gold-500/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{s.icon}</span>
                    <div className="leading-tight">
                      <div className="text-sm font-bold">
                        {locale === "fr" ? s.fr : locale === "en" ? s.en : s.ar}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {L("توقيت الجزائر", "Heure d'Algérie", "Algeria time")}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* stepper */}
          <div className="mt-6 flex flex-wrap gap-1.5">
            {FORM_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                  step === i
                    ? "bg-gradient-to-br from-gold-300 to-gold-600 text-ink"
                    : i < step
                      ? "bg-gold-500/20 text-gold-200"
                      : "bg-slate-800 text-slate-400"
                }`}
                aria-current={step === i}
              >
                <span>{s.icon}</span>
                <span className="hidden sm:inline">
                  {locale === "fr" ? s.titleFr : locale === "en" ? s.titleEn : s.titleAr}
                </span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <StepTitle step={step} />
            <FormStepFields
              values={values}
              errors={errors}
              onChange={setField}
              step={step}
            />
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="btn-ghost text-sm"
            >
              {tr("back")}
            </button>

            {step < FORM_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => validateStep(step) && setStep((s) => s + 1)}
                className="btn-gold"
              >
                {tr("next")}
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  for (let i = 0; i < FORM_STEPS.length; i += 1) {
                    if (!validateStep(i)) {
                      setStep(i);
                      return;
                    }
                  }
                  await submit();
                }}
                disabled={submitting || blocked}
                className="btn-gold"
              >
                {submitting ? tr("loading") : tr("submit_request")}
              </button>
            )}
          </div>
        </section>

        {/* browser bridge pairing */}
        {pairCode && (
          <section className="card mt-5 p-5">
            <h2 className="mb-3 text-base font-bold text-gold-100">
              🔌{" "}
              {locale === "fr"
                ? "Connexion de votre navigateur"
                : locale === "en"
                  ? "Connect your browser"
                  : "ربط متصفحك"}
            </h2>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
              {locale === "fr"
                ? "Pour réserver automatiquement sur BLS, installez l'extension Chrome et collez ce code. Le navigateur où vous êtes connecté à BLS effectuera la réservation."
                : locale === "en"
                  ? "To book automatically on BLS, install the Chrome extension and paste this code. The browser where you are logged into BLS will perform the booking."
                  : "للحجز آليًا على BLS، ثبّت امتداد Chrome والصق هذا الكود. المتصفح الذي سجّلت فيه دخولك إلى BLS سيقوم بالحجز."}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-lg bg-ink px-4 py-2 font-mono text-xl font-black tracking-[0.3em] text-gold-200">
                {pairCode}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(pairCode);
                }}
                className="btn-ghost text-[10px]"
              >
                📋 {locale === "ar" ? "نسخ" : locale === "fr" ? "Copier" : "Copy"}
              </button>
            </div>
          </section>
        )}

        {/* my requests */}
        <section className="card mt-5 p-5">
          <h2 className="mb-4 text-base font-bold text-gold-100">{tr("my_requests")}</h2>

          {runs.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">{tr("loading")}</p>
          ) : (
            <div className="space-y-3">
              {runs.map((r) => {
                const m = statusMeta[r.status] ?? statusMeta.QUEUED!;
                return (
                  <div
                    key={r.runId}
                    className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{r.name}</div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                          <span className="font-mono">{r.reference}</span>
                          <span>{r.centre}</span>
                          <span>{r.category}</span>
                          {r.visaType && <span>{r.visaType}</span>}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${m.cls}`}
                      >
                        {L(m.ar, m.fr, m.en)}
                      </span>
                    </div>

                    <div className="mt-2.5 grid gap-1 border-t border-slate-700/40 pt-2.5 text-[10px] text-slate-400 sm:grid-cols-3">
                      <div>
                        <span className="text-slate-500">{tr("reference")}: </span>
                        <span className="font-mono">{r.reference}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">{tr("attempts")}: </span>
                        <span className="font-mono">
                          {r.attempts}/{r.maxAttempts}
                        </span>
                      </div>
                      {r.appointmentDate ? (
                        <div className="text-emerald-300">
                          {tr("appointment_at")}: {r.appointmentDate}{" "}
                          {r.appointmentTime ?? ""}
                        </div>
                      ) : (
                        <div>
                          <span className="text-slate-500">{tr("status")}: </span>
                          <span>
                            {new Date(r.scheduledFor).toLocaleString(
                              locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-FR" : "en-GB",
                              { timeZone: "Africa/Algiers" },
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {r.error && (
                      <p className="mt-2 text-[10px] text-rose-300/80">{r.error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function ClientPortal() {
  return (
    <LocaleProvider>
      <Inner />
    </LocaleProvider>
  );
}