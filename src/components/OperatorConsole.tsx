"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LocaleProvider, LocaleSwitcher, useLocale } from "./LocaleProvider";
import { AlgeriaClock, Countdown } from "./AlgeriaClock";
import { FORM_STEPS, categoriesFor } from "@/lib/bls-form";
import type { FormErrors, FormValues } from "./FormStepFields";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type Release = { kind: string; algiersTime: string; countdownMs: number };
type WindowRow = {
  id: number;
  slotKind: string;
  openTime: string;
  dayOfWeek: number;
  enabled: boolean;
  nextRunAt: string | null;
};
type Captcha = {
  id: number;
  runId: number | null;
  status: string;
  imageUrl: string | null;
  createdAt: string;
  expiresAt: string;
};
type Run = {
  runId: number;
  reference: string;
  status: string;
  slotKind: string;
  attempts: number;
  maxAttempts: number;
  priority: number;
  scheduledFor: string;
  appointmentDate: string | null;
  appointmentTime: string | null;
  confirmationNumber: string | null;
  error: string | null;
  timeline: Array<Record<string, unknown>>;
  name: string;
  centre: string;
  category: string;
};
type ClientRow = {
  id: number;
  code: string;
  fullName: string;
  phone: string;
  email: string | null;
  quota: number;
  isActive: boolean;
  createdAt: string;
};
type AuditRow = {
  id: number;
  actor: string;
  actorKind: string;
  action: string;
  target: string | null;
  createdAt: string;
};
type Data = {
  operator: string;
  algeriaTime: string;
  releases: Release[];
  stats: {
    clients: number;
    booked: number;
    total: number;
    success: number;
    statusCounts: Record<string, number>;
  };
  windows: WindowRow[];
  captchas: Captcha[];
  audit: AuditRow[];
  clients: ClientRow[];
  runs: Run[];
};
type Quota = {
  used: number;
  remaining: number;
  blocked: boolean;
  blockedUntil: string | null;
};

type BlsSettings = {
  baseUrl: string;
  appointmentPath: string;
  bookingType: string;
  centre: string;
  category: string;
  proxyUrl: string | null;
  proxySet: boolean;
  userAgentPoolSize: number;
  acceptLanguage: string;
  requestTimeoutMs: number;
  highVelocity: boolean;
  preWarmSeconds: number;
  maxParallelRuns: number;
  attemptBudget: number;
  humanCaptcha: boolean;
  verificationCodeSet: boolean;
  connected: boolean;
  lastTestAt: string | null;
  lastTestStatus: string | null;
  sampleUserAgents: string[];
};

type Tab = "booking" | "queue" | "captcha" | "clients" | "bridge" | "settings" | "audit";

type BridgeChannel = {
  pairCode: string;
  browserLabel: string | null;
  sessionReady: boolean;
  lastSeenAt: string | null;
  bookingUrl: string | null;
  kind: string;
};

/* ------------------------------------------------------------------ */
/* Console                                                              */
/* ------------------------------------------------------------------ */

function Inner() {
  const { tr, locale } = useLocale();
  const router = useRouter();

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("queue");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // booking form (operator can also submit on behalf of a client)
  const [bookingClientId, setBookingClientId] = useState<number | null>(null);
  const [slotKind, setSlotKind] = useState<"FRIDAY_1600" | "TUESDAY_1700">("FRIDAY_1600");
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [formBusy, setFormBusy] = useState(false);

  // captcha
  const [captchaInput, setCaptchaInput] = useState<Record<number, string>>({});

  // clients
  const [genCount, setGenCount] = useState(5);
  const [genName, setGenName] = useState("");
  const [genPhone, setGenPhone] = useState("");

  // settings
  const [bls, setBls] = useState<BlsSettings | null>(null);
  const [blsForm, setBlsForm] = useState<Record<string, unknown>>({});
  const [blsBusy, setBlsBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // bridge (browser extension)
  const [pairCode, setPairCode] = useState("");
  const [channels, setChannels] = useState<BridgeChannel[]>([]);

  // deployment health
  const [health, setHealth] = useState<{
    ok: boolean;
    environment: string;
    smtpConfigured: boolean;
    dedicatedEncryptionKey: boolean;
    warnings: string[];
  } | null>(null);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const j = await res.json();
      setHealth({
        ok: j.ok,
        environment: j.runtime?.environment ?? "unknown",
        smtpConfigured: Boolean(j.runtime?.smtpConfigured),
        dedicatedEncryptionKey: Boolean(j.runtime?.dedicatedEncryptionKey),
        warnings: j.warnings ?? [],
      });
    } catch {
      setHealth(null);
    }
  }, []);

  const L = useCallback(
    (a: string, f: string, e: string) => (locale === "fr" ? f : locale === "en" ? e : a),
    [locale],
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
    if (res.status === 401) {
      setAuthed(false);
      router.replace("/operator");
      return;
    }
    const j = await res.json();
    if (j.ok) {
      setData(j);
      setAuthed(true);
    }
  }, [router]);

  const loadBls = useCallback(async () => {
    const res = await fetch("/api/admin/bls-connection", { cache: "no-store" });
    if (!res.ok) return;
    const j = await res.json();
    if (j.ok && j.settings) {
      setBls(j.settings);
      setBlsForm({
        baseUrl: j.settings.baseUrl,
        appointmentPath: j.settings.appointmentPath,
        bookingType: j.settings.bookingType,
        centre: j.settings.centre,
        category: j.settings.category,
        proxyUrl: j.settings.proxyUrl ?? "",
        userAgentPoolSize: j.settings.userAgentPoolSize,
        acceptLanguage: j.settings.acceptLanguage,
        requestTimeoutMs: j.settings.requestTimeoutMs,
        highVelocity: j.settings.highVelocity,
        preWarmSeconds: j.settings.preWarmSeconds,
        maxParallelRuns: j.settings.maxParallelRuns,
        attemptBudget: j.settings.attemptBudget,
        humanCaptcha: j.settings.humanCaptcha,
        verificationCode: "",
      });
    }
  }, []);

  const loadBridge = useCallback(async () => {
    const res = await fetch("/api/bridge?as=operator", { cache: "no-store" });
    if (!res.ok) return;
    const j = await res.json();
    if (j.ok) {
      setPairCode(j.pairCode);
      setChannels(j.channels || []);
    }
  }, []);

  useEffect(() => {
    load();
    loadBls();
    loadBridge();
    loadHealth();
    const id = setInterval(load, 4000);
    const id2 = setInterval(loadBridge, 5000);
    return () => {
      clearInterval(id);
      clearInterval(id2);
    };
  }, [load, loadBls, loadBridge, loadHealth]);

  async function bridgePing(pc: string) {
    await fetch("/api/bridge?as=operator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairCode: pc, kind: "PING" }),
    });
    setToast({
      kind: "ok",
      text: L("أُرسلت إشارة", "Signal envoyé", "Ping sent"),
    });
  }

  // auto-pump the engine
  useEffect(() => {
    if (!authed) return;
    const id = setInterval(() => {
      fetch("/api/admin/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate" }),
      }).catch(() => {});
    }, 10_000);
    return () => clearInterval(id);
  }, [authed]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);

  async function post(url: string, body: unknown) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      await load();
      return { res, j };
    } finally {
      setBusy(false);
    }
  }

  /* ---------------- captcha ---------------- */
  async function solveCaptcha(id: number) {
    const solution = (captchaInput[id] ?? "").trim();
    if (!solution) return;
    const { j } = await post("/api/admin/captcha", { id, solution });
    setToast({
      kind: j.ok ? "ok" : "err",
      text: j.ok
        ? L("تم الحل — استؤنف الحجز", "Résolu — réservation relancée", "Solved — booking resumed")
        : j.message,
    });
    setCaptchaInput((v) => ({ ...v, [id]: "" }));
  }

  /* ---------------- runs ---------------- */
  async function runAction(action: string, runId: number, extra: Record<string, unknown> = {}) {
    const { j } = await post("/api/admin/runs", { action, runId, ...extra });
    setToast({
      kind: j.ok === false ? "err" : "ok",
      text: j.ok === false ? j.error ?? tr("error") : tr("saved"),
    });
  }

  /* ---------------- clients ---------------- */
  async function generateCodes() {
    const { j } = await post("/api/admin/clients", {
      count: genCount,
      fullName: genName,
      phone: genPhone,
    });
    if (j.ok) {
      setToast({
        kind: "ok",
        text: L(
          `تم توليد ${j.created.length} كود`,
          `${j.created.length} code(s) généré(s)`,
          `${j.created.length} code(s) generated`,
        ),
      });
      setGenName("");
      setGenPhone("");
    }
  }

  async function clientAction(id: number, action: string) {
    await fetch("/api/admin/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    await load();
  }

  /* ---------------- booking form ---------------- */
  function setField(name: string, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => {
      if (!e[name]) return e;
      const n = { ...e };
      delete n[name];
      return n;
    });
  }

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

  async function submitBooking() {
    if (!bookingClientId) {
      setToast({
        kind: "err",
        text: L("اختر العميل أولًا", "Sélectionnez d'abord un client", "Select a client first"),
      });
      return;
    }
    setFormBusy(true);
    setToast(null);
    try {
      const res = await fetch("/api/admin/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: bookingClientId, slotKind, form: values }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        if (j.fields) setErrors(j.fields);
        setToast({
          kind: "err",
          text: j.error === "VALIDATION_FAILED"
            ? L("الاستمارة غير مكتملة", "Formulaire incomplet", "Incomplete form")
            : j.error === "COOLDOWN_ACTIVE"
              ? L(
                  "الحساب في فترة التهدئة",
                  "Compte en période de cooldown",
                  "Account in cooldown period",
                )
              : j.error ?? tr("error"),
        });
        return;
      }
      setToast({
        kind: "ok",
        text: L(`تم التجهيز — ${j.reference}`, `Armé — ${j.reference}`, `Armed — ${j.reference}`),
      });
      setValues({});
      setStep(0);
      await load();
    } catch {
      setToast({ kind: "err", text: tr("error") });
    } finally {
      setFormBusy(false);
    }
  }

  /* ---------------- settings ---------------- */
  async function saveBls() {
    setBlsBusy(true);
    try {
      const payload = {
        ...blsForm,
        proxyUrl: blsForm.proxyUrl === "" ? null : blsForm.proxyUrl,
        verificationCode: blsForm.verificationCode === "" ? null : blsForm.verificationCode,
      };
      const res = await fetch("/api/admin/bls-connection", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (j.ok) {
        setBls(j.settings);
        setBlsForm((f) => ({ ...f, verificationCode: "" }));
        setToast({ kind: "ok", text: tr("saved") });
      } else {
        setToast({ kind: "err", text: j.error ?? tr("error") });
      }
    } catch {
      setToast({ kind: "err", text: tr("error") });
    } finally {
      setBlsBusy(false);
    }
  }

  async function testBls() {
    setBlsBusy(true);
    try {
      const res = await fetch("/api/admin/bls-connection", { method: "POST" });
      const j = await res.json();
      if (j.ok) {
        setBls(j.settings);
        setToast({
          kind: j.connected ? "ok" : "err",
          text: j.connected
            ? L(
                `تم الاتصال — ${j.status} · ${j.latencyMs}ms`,
                `Connecté — ${j.status} · ${j.latencyMs}ms`,
                `Connected — ${j.status} · ${j.latencyMs}ms`,
              )
            : L(
                `فشل الاتصال: ${j.error ?? "timeout"}`,
                `Échec : ${j.error ?? "timeout"}`,
                `Failed: ${j.error ?? "timeout"}`,
              ),
        });
      }
    } catch {
      setToast({ kind: "err", text: tr("error") });
    } finally {
      setBlsBusy(false);
    }
  }

  async function changePassword() {
    if (newPassword !== confirmPassword) {
      setToast({
        kind: "err",
        text: L("كلمتا السر غير متطابقتين", "Les mots de passe diffèrent", "Passwords do not match"),
      });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/operator/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setToast({
          kind: "err",
          text:
            j.error === "PASSWORD_TOO_SHORT"
              ? L("كلمة السر قصيرة (8 أحرف)", "Trop court (8 caractères)", "Too short (8 chars)")
              : j.error === "PASSWORD_TOO_WEAK"
                ? L("يجب أن تحتوي على أحرف وأرقام", "Lettres et chiffres requis", "Needs letters and numbers")
                : L("كلمة السر الحالية غير صحيحة", "Mot de passe actuel incorrect", "Current password is incorrect"),
        });
        return;
      }
      setToast({ kind: "ok", text: tr("saved") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/operator");
  }

  /* ---------------- render helpers ---------------- */
  const statusMeta: Record<string, { cls: string; label: string }> = {
    QUEUED: { cls: "bg-slate-600/30 text-slate-300 border-slate-500/40", label: L("في الانتظار", "En attente", "Queued") },
    ARMED: { cls: "bg-sky-600/25 text-sky-300 border-sky-500/40", label: L("جاهز", "Prêt", "Armed") },
    WAITING_CAPTCHA: { cls: "bg-amber-600/25 text-amber-300 border-amber-500/40", label: L("كابتشا", "Captcha", "Captcha") },
    PROCESSING: { cls: "bg-violet-600/25 text-violet-300 border-violet-500/40", label: L("جارٍ", "En cours", "Running") },
    BOOKED: { cls: "bg-emerald-600/25 text-emerald-300 border-emerald-500/40", label: L("تم ✓", "Réservé ✓", "Booked ✓") },
    FAILED: { cls: "bg-rose-600/25 text-rose-300 border-rose-500/40", label: L("فشل", "Échec", "Failed") },
    CANCELLED: { cls: "bg-slate-600/30 text-slate-400 border-slate-500/40", label: L("ملغى", "Annulé", "Cancelled") },
  };

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="shimmer h-10 w-40 rounded-xl" />
      </div>
    );
  }
  if (!authed || !data) return null;

  const pendingCaptchas = data.captchas.length;
  const activeRuns = data.runs.filter((r) =>
    ["QUEUED", "ARMED", "PROCESSING", "WAITING_CAPTCHA"].includes(r.status),
  ).length;

  const tabs: Array<{ id: Tab; label: string; badge?: number; icon: string }> = [
    { id: "booking", label: L("حجز جديد", "Nouvelle réservation", "New booking"), icon: "📝" },
    { id: "queue", label: L("الطابور", "File d'attente", "Queue"), badge: activeRuns, icon: "⚡" },
    { id: "captcha", label: L("الكابتشا", "Captcha", "Captcha"), badge: pendingCaptchas, icon: "🔐" },
    { id: "clients", label: L("العملاء", "Clients", "Clients"), badge: data.clients.length, icon: "👥" },
    {
      id: "bridge",
      label: L("الجسر", "Bridge", "Bridge"),
      badge: channels.filter((c) => c.sessionReady).length,
      icon: "🔌",
    },
    { id: "settings", label: tr("settings"), icon: "⚙️" },
    { id: "audit", label: L("السجل", "Journal", "Audit"), icon: "📜" },
  ];

  const slots = [
    { id: "FRIDAY_1600" as const, ar: "الجمعة 16:00", fr: "Vendredi 16:00", en: "Friday 16:00", icon: "🕌" },
    { id: "TUESDAY_1700" as const, ar: "الثلاثاء 17:00", fr: "Mardi 17:00", en: "Tuesday 17:00", icon: "📅" },
  ];

  return (
    <main className="min-h-screen">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(900px 500px at 20% -10%, rgba(201,162,39,0.11), transparent 60%), linear-gradient(180deg,#070b18,#0b1020)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
        {/* header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden>
              <defs>
                <linearGradient id="cg2" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f7e7a1" />
                  <stop offset="100%" stopColor="#c9a227" />
                </linearGradient>
              </defs>
              <path fill="url(#cg2)" d="M8 46 L14 20 L25 32 L32 12 L39 32 L50 20 L56 46 Z" />
              <rect x="8" y="48" width="48" height="6" rx="3" fill="url(#cg2)" />
            </svg>
            <div className="leading-tight">
              <h1 className="gold-text text-lg font-black sm:text-xl">{tr("brand_name")}</h1>
              <p className="text-[11px] text-slate-400">
                {L("صلاحية كاملة", "Accès complet", "Full access")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AlgeriaClock compact />
            <LocaleSwitcher />
            <button onClick={logout} className="btn-ghost text-xs">
              {tr("logout")}
            </button>
          </div>
        </header>

        {toast && (
          <div
            className={`mt-4 rounded-lg border p-3 text-xs font-semibold ${
              toast.kind === "ok"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/40 bg-rose-500/10 text-rose-300"
            }`}
          >
            {toast.text}
          </div>
        )}

        {/* stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { v: data.stats.clients, l: L("عميل", "Clients", "Clients"), i: "👥", c: "text-sky-300" },
            { v: data.stats.booked, l: L("محجوز", "Réservés", "Booked"), i: "✅", c: "text-emerald-300" },
            { v: `${data.stats.success}%`, l: L("نسبة النجاح", "Taux de réussite", "Success"), i: "⚡", c: "text-gold-200" },
            { v: pendingCaptchas, l: L("كابتشا", "Captcha", "Captcha"), i: "🔐", c: pendingCaptchas > 0 ? "text-amber-300" : "text-slate-400" },
          ].map((s) => (
            <div key={s.l} className="card p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-lg">{s.i}</span>
                <span className={`text-2xl font-black ${s.c}`}>{s.v}</span>
              </div>
              <div className="mt-1 text-[10px] text-slate-400">{s.l}</div>
            </div>
          ))}
        </div>

        {/* release windows */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.windows.map((w) => {
            const rel = data.releases.find((r) => r.kind === w.slotKind);
            const slotLabel =
              w.slotKind === "FRIDAY_1600" ? L("الجمعة", "Vendredi", "Friday") : L("الثلاثاء", "Mardi", "Tuesday");
            return (
              <div key={w.id} className={`card p-4 ${w.enabled ? "" : "opacity-55"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="leading-tight">
                    <div className="text-sm font-bold">
                      {slotLabel} • {w.openTime}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {L("توقيت الجزائر", "Heure d'Algérie", "Algeria time")}
                    </div>
                  </div>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${w.enabled ? "bg-emerald-400 pulse-ring" : "bg-slate-600"}`}
                  />
                </div>
                {rel && (
                  <div className="mt-2.5 flex items-center justify-between border-t border-slate-700/50 pt-2.5">
                    <span className="text-[10px] text-slate-400">
                      {L("الإصدار القادم", "Prochaine ouverture", "Next release")}
                    </span>
                    <span className="font-mono text-sm font-bold text-emerald-300">
                      <Countdown targetMs={Date.now() + rel.countdownMs} />
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* tabs */}
        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                tab === t.id
                  ? "bg-gradient-to-br from-gold-300 to-gold-600 text-ink shadow"
                  : "border border-slate-700 bg-slate-900/60 text-slate-300 hover:border-gold-500/50"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[9px] ${
                    tab === t.id ? "bg-ink/25 text-ink" : "bg-gold-600/30 text-gold-200"
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* =============== NEW BOOKING =============== */}
        {tab === "booking" && (
          <section className="card mt-4 p-5">
            <h2 className="mb-4 text-base font-bold text-gold-100">
              {L("حجز نيابة عن عميل", "Réservation pour un client", "Book on behalf of a client")}
            </h2>

            <div className="grid gap-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-300">
                  {L("العميل", "Client", "Client")}
                </span>
                <select
                  className="field"
                  value={bookingClientId ?? ""}
                  onChange={(e) => setBookingClientId(Number(e.target.value) || null)}
                >
                  <option value="">— {L("اختر العميل", "Choisir", "Select")} —</option>
                  {data.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.fullName} ({L("الحصة", "quota", "quota")} {c.quota})
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="mb-1.5 block text-xs font-semibold text-slate-300">
                  {L("موعد الإصدار", "Créneau", "Release slot")}
                </span>
                <div className="grid gap-3 sm:grid-cols-2">
                  {slots.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSlotKind(s.id)}
                      className={`rounded-xl border p-3.5 text-start transition ${
                        slotKind === s.id
                          ? "border-gold-400 bg-gradient-to-br from-gold-400/20 to-gold-700/10 shadow"
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

              <div>
                <div className="mb-2 flex flex-wrap gap-1.5">
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
                    >
                      <span>{s.icon}</span>
                      <span className="hidden sm:inline">
                        {locale === "fr" ? s.titleFr : locale === "en" ? s.titleEn : s.titleAr}
                      </span>
                      <span className="sm:hidden">{i + 1}</span>
                    </button>
                  ))}
                </div>

                <div className="mb-4 flex items-center gap-2.5">
                  <span className="text-2xl">{FORM_STEPS[step]?.icon}</span>
                  <h3 className="text-base font-bold text-gold-100">
                    {locale === "fr"
                      ? FORM_STEPS[step]?.titleFr
                      : locale === "en"
                        ? FORM_STEPS[step]?.titleEn
                        : FORM_STEPS[step]?.titleAr}
                  </h3>
                </div>

                <OperatorFormFields
                  values={values}
                  errors={errors}
                  onChange={setField}
                  step={step}
                />

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
                        await submitBooking();
                      }}
                      disabled={formBusy}
                      className="btn-gold"
                    >
                      {formBusy ? tr("loading") : tr("submit_request")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* =============== QUEUE =============== */}
        {tab === "queue" && (
          <section className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gold-100">{L("الطابور", "File d'attente", "Queue")}</h2>
              <button onClick={() => post("/api/admin/runs", { action: "activate" })} disabled={busy} className="btn-ghost text-[10px]">
                {L("تفعيل المحرك", "Activer le moteur", "Activate engine")}
              </button>
            </div>

            {data.runs.length === 0 && <p className="card p-6 text-center text-xs text-slate-500">—</p>}

            {data.runs.map((r) => {
              const m = statusMeta[r.status] ?? statusMeta.QUEUED!;
              const pct = Math.min(100, Math.round((r.attempts / r.maxAttempts) * 100));
              return (
                <div key={r.runId} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-bold">{r.name}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${m.cls}`}>
                          {m.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                        <span className="font-mono">{r.reference}</span>
                        <span>{r.centre}</span>
                        <span>{r.category}</span>
                        <span>{r.slotKind === "FRIDAY_1600" ? "Fri 16:00" : "Tue 17:00"}</span>
                        <span>
                          {L("أولوية", "prio", "prio")} {r.priority}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Btn onClick={() => runAction("attempt", r.runId)} disabled={busy}>
                        {L("محاولة", "Essai", "Attempt")}
                      </Btn>
                      <Btn onClick={() => runAction("boost", r.runId)} disabled={busy}>
                        ⚡ {L("تعزيز", "Boost", "Boost")}
                      </Btn>
                      {r.status !== "BOOKED" && (
                        <Btn onClick={() => runAction("fail", r.runId)} disabled={busy}>
                          {L("إلغاء", "Annuler", "Cancel")}
                        </Btn>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[9px] text-slate-400">
                      <span>{tr("attempts")}</span>
                      <span className="font-mono">
                        {r.attempts}/{r.maxAttempts}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {r.appointmentDate && (
                    <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-300">
                      ✅ {r.appointmentDate} {r.appointmentTime} •{" "}
                      <span className="font-mono">{r.confirmationNumber}</span>
                    </div>
                  )}

                  {r.error && <p className="mt-2 text-[10px] text-rose-300/80">{r.error}</p>}

                  {Array.isArray(r.timeline) && r.timeline.length > 0 && (
                    <details className="mt-2.5">
                      <summary className="cursor-pointer text-[10px] text-slate-400 hover:text-gold-200">
                        {L("عرض السجل", "Voir le journal", "View log")} ({r.timeline.length})
                      </summary>
                      <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-lg bg-slate-950/60 p-2">
                        {r.timeline.slice(-40).map((e, i) => (
                          <div key={i} className="flex gap-2 text-[9px]">
                            <span className="shrink-0 font-mono text-slate-500">
                              {String(e.at ?? "").slice(11, 19)}
                            </span>
                            <span className="text-gold-300/80">{String(e.kind)}</span>
                            <span className="text-slate-300">{String(e.message)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {r.status !== "BOOKED" && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[10px] text-slate-400 hover:text-gold-200">
                        {L("تأكيد يدوي", "Confirmation manuelle", "Manual confirm")}
                      </summary>
                      <ConfirmForm runId={r.runId} onDone={load} />
                    </details>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* =============== CAPTCHA =============== */}
        {tab === "captcha" && (
          <section className="mt-4 space-y-3">
            <p className="card p-3 text-[11px] leading-relaxed text-slate-300">
              {L(
                "هذه هي الخطوة الوحيدة التي يحلّها الإنسان. أدخل رمز الكابتشا فور ظهوره ليُستأنف الحجز آليًا.",
                "Seule étape résolue par un humain. Saisissez le code pour relancer la réservation.",
                "The only human-solved step. Enter the code to resume booking automatically.",
              )}
            </p>

            {data.captchas.length === 0 && (
              <p className="card p-6 text-center text-xs text-slate-500">
                ✅ {L("لا توجد كابتشا معلّقة", "Aucun captcha en attente", "No pending captchas")}
              </p>
            )}

            {data.captchas.map((c) => (
              <div key={c.id} className="card flex flex-wrap items-center gap-4 p-4">
                <div className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="captcha" className="h-full w-full object-contain" />
                  ) : (
                    <span className="px-2 text-center text-[9px] text-slate-500">
                      {L(
                        "حمّل صورة الكابتشا من جلسة BLS النشطة",
                        "Chargez l'image du captcha depuis la session BLS active",
                        "Load the captcha image from the active BLS session",
                      )}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">
                    #{c.id}
                    {c.runId ? ` · ${L("طلب", "run", "run")} #${c.runId}` : ""}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    ⏱{" "}
                    {new Date(c.expiresAt).toLocaleTimeString(
                      locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-FR" : "en-GB",
                      { timeZone: "Africa/Algiers" },
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    className="field w-32 text-center font-mono"
                    placeholder="••••"
                    maxLength={8}
                    value={captchaInput[c.id] ?? ""}
                    onChange={(e) => setCaptchaInput((v) => ({ ...v, [c.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && solveCaptcha(c.id)}
                  />
                  <button
                    onClick={() => solveCaptcha(c.id)}
                    disabled={busy || !(captchaInput[c.id] ?? "").trim()}
                    className="btn-gold text-xs"
                  >
                    {tr("solve")}
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* =============== CLIENTS =============== */}
        {tab === "clients" && (
          <section className="mt-4 space-y-4">
            <div className="card p-4">
              <h3 className="mb-3 text-sm font-bold text-gold-100">{tr("generate_codes")}</h3>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="block">
                  <span className="mb-1 block text-[10px] text-slate-400">{tr("number_of_codes")}</span>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    max={50}
                    value={genCount}
                    onChange={(e) => setGenCount(Number(e.target.value))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] text-slate-400">{L("الاسم", "Nom", "Name")}</span>
                  <input className="field" value={genName} onChange={(e) => setGenName(e.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] text-slate-400">{L("الهاتف", "Téléphone", "Phone")}</span>
                  <input
                    className="field"
                    value={genPhone}
                    onChange={(e) => setGenPhone(e.target.value)}
                    placeholder="+213..."
                  />
                </label>
                <div className="flex items-end">
                  <button onClick={generateCodes} disabled={busy} className="btn-gold w-full text-xs">
                    {tr("generate")}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.clients.map((c) => (
                <div key={c.id} className="card p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-lg font-black text-gold-200">{c.code}</div>
                      <div className="truncate text-xs font-semibold">{c.fullName}</div>
                      <div className="truncate text-[10px] text-slate-400">{c.phone}</div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        c.isActive ? "bg-emerald-600/25 text-emerald-300" : "bg-rose-600/25 text-rose-300"
                      }`}
                    >
                      {c.isActive ? tr("active") : tr("inactive")}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-slate-700/50 pt-2.5">
                    <span className="text-[10px] text-slate-400">
                      {L("الحصة", "Quota", "Quota")}: <b className="text-gold-200">{c.quota}</b>
                    </span>
                    <div className="flex gap-1">
                      <MiniBtn onClick={() => clientAction(c.id, "toggle")}>
                        {c.isActive ? L("تعطيل", "Désactiver", "Disable") : tr("enable")}
                      </MiniBtn>
                      <MiniBtn onClick={() => clientAction(c.id, "reset_quota")}>{tr("reset")}</MiniBtn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* =============== BRIDGE =============== */}
        {tab === "bridge" && (
          <section className="mt-4 space-y-4">
            <div className="card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-base font-bold text-gold-100">
                  🔌 {L("جسر المتصفح — الامتداد", "Passerelle navigateur — extension", "Browser bridge — extension")}
                </h3>
                <button onClick={loadBridge} className="btn-ghost text-[10px]">
                  {L("تحديث", "Actualiser", "Refresh")}
                </button>
              </div>

              <div className="rounded-xl border border-gold-500/30 bg-gradient-to-br from-gold-400/10 to-transparent p-4">
                <p className="mb-2 text-xs text-slate-300">
                  {L(
                    "كود الاقتران — أدخله في امتداد Chrome:",
                    "Code d'appariement — saisissez-le dans l'extension Chrome :",
                    "Pairing code — enter it in the Chrome extension:",
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-lg bg-ink px-4 py-2 font-mono text-2xl font-black tracking-[0.3em] text-gold-200">
                    {pairCode || "——————"}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(pairCode);
                      setToast({ kind: "ok", text: L("نُسخ", "Copié", "Copied") });
                    }}
                    className="btn-ghost text-[10px]"
                  >
                    📋 {L("نسخ", "Copier", "Copy")}
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 text-[11px] leading-relaxed text-slate-300">
                <div className="mb-2 font-bold text-gold-100">
                  {L("طريقة الربط (3 خطوات)", "Comment connecter (3 étapes)", "How to connect (3 steps)")}
                </div>
                <ol className="list-inside list-decimal space-y-1 text-slate-400">
                  <li>
                    {L(
                      "ثبّت امتداد Chrome من مجلد extension/ (chrome://extensions ← تفعيل وضع المطوّر ← تحميل غير محزومة)",
                      "Installez l'extension Chrome depuis le dossier extension/ (chrome://extensions ← Mode développeur ← Charger l'extension non empaquetée)",
                      "Load the Chrome extension from the extension/ folder (chrome://extensions ← Developer mode ← Load unpacked)",
                    )}
                  </li>
                  <li>
                    {L(
                      "سجّل الدخول مرة واحدة إلى حسابك في BLS من هذا المتصفح",
                      "Connectez-vous une seule fois à votre compte BLS dans ce navigateur",
                      "Log in to your BLS account once in this browser",
                    )}
                  </li>
                  <li>
                    {L(
                      "افتح الامتداد، الصق كود الاقتران، ثم اضغط «حفظ واتصال»",
                      "Ouvrez l'extension, collez le code, puis « Enregistrer et connecter »",
                      "Open the popup, paste the code, then Save & connect",
                    )}
                  </li>
                </ol>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="mb-3 text-sm font-bold text-gold-100">
                {L("المتصفحات المتصلة", "Navigateurs connectés", "Connected browsers")}
              </h3>

              {channels.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-500">
                  {L("لا توجد قنوات بعد", "Aucun canal", "No channels yet")}
                </p>
              ) : (
                <div className="space-y-2">
                  {channels.map((c) => {
                    const seen = c.lastSeenAt ? new Date(c.lastSeenAt).getTime() : 0;
                    const alive = Date.now() - seen < 30_000;
                    return (
                      <div
                        key={c.pairCode}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-gold-200">{c.pairCode}</span>
                            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[9px] font-bold text-slate-300">
                              {c.kind}
                            </span>
                            <span
                              className={`h-2 w-2 rounded-full ${
                                c.sessionReady && alive ? "bg-emerald-400 pulse-ring" : "bg-slate-600"
                              }`}
                            />
                          </div>
                          <div className="mt-1 truncate text-[10px] text-slate-400">
                            {c.browserLabel ?? L("متصفح غير معروف", "Unknown browser", "Unknown browser")}
                          </div>
                          <div className="text-[9px] text-slate-500">
                            {c.sessionReady
                              ? "✅ " + L("جلسة BLS جاهزة", "session BLS prête", "BLS session ready")
                              : L("في انتظار جلسة BLS", "en attente de session BLS", "waiting for BLS session")}
                            {c.lastSeenAt &&
                              ` · ${new Date(c.lastSeenAt).toLocaleTimeString(
                                locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-FR" : "en-GB",
                                { timeZone: "Africa/Algiers" },
                              )}`}
                          </div>
                        </div>
                        <button onClick={() => bridgePing(c.pairCode)} className="btn-ghost text-[10px]">
                          {L("إشارة", "Ping", "Ping")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* =============== SETTINGS =============== */}
        {tab === "settings" && (
          <section className="mt-4 space-y-4">
            {/* BLS connection */}
            <div className="card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-base font-bold text-gold-100">
                  🔗 {L("ربط سيرفر الحجز مع موقع BLS", "Connexion du serveur à BLS", "BLS server connection")}
                </h3>
                <div className="flex items-center gap-2">
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      bls?.connected
                        ? "bg-emerald-600/25 text-emerald-300"
                        : "bg-slate-600/30 text-slate-400"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        bls?.connected ? "bg-emerald-400 pulse-ring" : "bg-slate-500"
                      }`}
                    />
                    {bls?.connected ? L("متصل", "Connecté", "Connected") : L("غير متصل", "Déconnecté", "Disconnected")}
                  </span>
                  <button onClick={testBls} disabled={blsBusy} className="btn-ghost text-[10px]">
                    {blsBusy ? tr("loading") : L("اختبار الاتصال", "Tester", "Test")}
                  </button>
                  <button onClick={saveBls} disabled={blsBusy} className="btn-gold text-[10px]">
                    {tr("save")}
                  </button>
                </div>
              </div>

              {bls?.lastTestStatus && (
                <p className="mb-4 rounded-lg bg-slate-950/50 p-2.5 text-[10px] text-slate-400">
                  {L("آخر اختبار", "Dernier test", "Last test")}: {bls.lastTestStatus}
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <BlsField label={L("رابط الموقع", "URL du site", "Site URL")}>
                  <input
                    className="field"
                    value={String(blsForm.baseUrl ?? "")}
                    onChange={(e) => setBlsForm((f) => ({ ...f, baseUrl: e.target.value }))}
                    placeholder="https://algeria.blsspainvisa.com"
                  />
                </BlsField>

                <BlsField label={L("مسار صفحة الحجز", "Chemin de réservation", "Booking path")}>
                  <input
                    className="field"
                    value={String(blsForm.appointmentPath ?? "")}
                    onChange={(e) => setBlsForm((f) => ({ ...f, appointmentPath: e.target.value }))}
                    placeholder="/appointment.php"
                  />
                </BlsField>

                <BlsField label={L("نوع الحجز", "Type de réservation", "Booking type")}>
                  <select
                    className="field"
                    value={String(blsForm.bookingType ?? "")}
                    onChange={(e) => setBlsForm((f) => ({ ...f, bookingType: e.target.value }))}
                  >
                    <option value="Individual">Individual</option>
                    <option value="Family">Family</option>
                  </select>
                </BlsField>

                <BlsField label={L("المركز", "Centre", "Centre")}>
                  <select
                    className="field"
                    value={String(blsForm.centre ?? "")}
                    onChange={(e) => setBlsForm((f) => ({ ...f, centre: e.target.value }))}
                  >
                    <option value="ALGIERS">ALGIERS</option>
                    <option value="ORAN">ORAN</option>
                  </select>
                </BlsField>

                <BlsField label={L("الفئة الافتراضية", "Catégorie par défaut", "Default category")}>
                  <select
                    className="field"
                    value={String(blsForm.category ?? "")}
                    onChange={(e) => setBlsForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    {categoriesFor(String(blsForm.centre ?? "ALGIERS")).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </BlsField>

                <BlsField
                  label={L("كود التحقق (Verification Code)", "Code de vérification", "Verification code")}
                  hint={L("اختياري", "Optionnel", "Optional")}
                >
                  <input
                    className="field"
                    type="password"
                    placeholder={bls?.verificationCodeSet ? "••••••" : ""}
                    value={String(blsForm.verificationCode ?? "")}
                    onChange={(e) => setBlsForm((f) => ({ ...f, verificationCode: e.target.value }))}
                  />
                </BlsField>

                <BlsField
                  label={L("بروكسي (Proxy)", "Proxy", "Proxy")}
                  hint={L("اختياري", "Optionnel", "Optional")}
                >
                  <input
                    className="field"
                    value={String(blsForm.proxyUrl ?? "")}
                    placeholder={bls?.proxySet ? "••••••" : "http://user:pass@host:port"}
                    onChange={(e) => setBlsForm((f) => ({ ...f, proxyUrl: e.target.value }))}
                  />
                </BlsField>

                <BlsField label={L("لغة الطلب", "Langue de requête", "Request language")}>
                  <input
                    className="field"
                    value={String(blsForm.acceptLanguage ?? "")}
                    onChange={(e) => setBlsForm((f) => ({ ...f, acceptLanguage: e.target.value }))}
                  />
                </BlsField>

                <BlsField label={L("حجم مجموعة User-Agent", "Taille du pool User-Agent", "User-Agent pool size")}>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    max={20}
                    value={Number(blsForm.userAgentPoolSize ?? 5)}
                    onChange={(e) => setBlsForm((f) => ({ ...f, userAgentPoolSize: Number(e.target.value) }))}
                  />
                </BlsField>

                <BlsField label={L("مهلة الطلب (ms)", "Délai d'attente (ms)", "Request timeout (ms)")}>
                  <input
                    className="field"
                    type="number"
                    min={3000}
                    max={60000}
                    step={1000}
                    value={Number(blsForm.requestTimeoutMs ?? 15000)}
                    onChange={(e) => setBlsForm((f) => ({ ...f, requestTimeoutMs: Number(e.target.value) }))}
                  />
                </BlsField>

                <BlsField label={L("تسخين قبل الإصدار (ثانية)", "Préchauffage (s)", "Pre-warm (s)")}>
                  <input
                    className="field"
                    type="number"
                    min={5}
                    max={600}
                    value={Number(blsForm.preWarmSeconds ?? 45)}
                    onChange={(e) => setBlsForm((f) => ({ ...f, preWarmSeconds: Number(e.target.value) }))}
                  />
                </BlsField>

                <BlsField label={L("طلبات متوازية", "Requêtes parallèles", "Parallel runs")}>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    max={64}
                    value={Number(blsForm.maxParallelRuns ?? 12)}
                    onChange={(e) => setBlsForm((f) => ({ ...f, maxParallelRuns: Number(e.target.value) }))}
                  />
                </BlsField>

                <BlsField label={L("ميزانية المحاولات", "Budget d'essais", "Attempt budget")}>
                  <input
                    className="field"
                    type="number"
                    min={10}
                    max={5000}
                    step={10}
                    value={Number(blsForm.attemptBudget ?? 400)}
                    onChange={(e) => setBlsForm((f) => ({ ...f, attemptBudget: Number(e.target.value) }))}
                  />
                </BlsField>
              </div>

              <div className="mt-4 flex flex-wrap gap-4">
                <BlsToggle
                  label={L("الوضع السريع (High Velocity)", "Mode haute vitesse", "High-velocity mode")}
                  checked={Boolean(blsForm.highVelocity)}
                  onChange={(v) => setBlsForm((f) => ({ ...f, highVelocity: v }))}
                />
                <BlsToggle
                  label={L("الكابتشا يحلّها إنسان", "Captcha résolu par un humain", "Human-solved CAPTCHA")}
                  checked={Boolean(blsForm.humanCaptcha)}
                  onChange={(v) => setBlsForm((f) => ({ ...f, humanCaptcha: v }))}
                />
              </div>
            </div>

            {/* password change */}
            <div className="card p-5">
              <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-gold-100">
                🔑 {tr("change_password")}
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <BlsField label={tr("current_password")}>
                  <input
                    className="field"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </BlsField>
                <BlsField label={tr("new_password")}>
                  <input
                    className="field"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </BlsField>
                <BlsField label={tr("confirm_password")}>
                  <input
                    className="field"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </BlsField>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={changePassword}
                  disabled={busy || !currentPassword || !newPassword}
                  className="btn-gold text-xs"
                >
                  {tr("save")}
                </button>
                <span className="text-[10px] text-slate-500">
                  {L("8 أحرف على الأقل، حروف + أرقام", "8 caractères min., lettres + chiffres", "Min 8 chars, letters + digits")}
                </span>
              </div>
            </div>

            {/* release windows */}
            <div className="card p-5">
              <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-gold-100">
                🕐 {tr("slots_title")}
              </h3>
              <div className="space-y-2">
                {data.windows.map((w) => (
                  <div key={w.id} className="flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                    <div className="leading-tight">
                      <div className="text-sm font-bold">
                        {w.slotKind === "FRIDAY_1600" ? L("الجمعة", "Vendredi", "Friday") : L("الثلاثاء", "Mardi", "Tuesday")} • {w.openTime}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {L("توقيت الجزائر", "Heure d'Algérie", "Algeria time")}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await post("/api/admin/runs", {
                          action: "toggle_window",
                          slotKind: w.slotKind,
                          enabled: !w.enabled,
                        });
                      }}
                      disabled={busy}
                      className={w.enabled ? "btn-gold text-xs" : "btn-ghost text-xs"}
                    >
                      {w.enabled ? tr("disable") : tr("enable")}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* deployment status */}
            {health && (
              <div className="card p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-base font-bold text-gold-100">
                    🩺 {L("حالة النشر", "État du déploiement", "Deployment status")}
                  </h3>
                  <button onClick={loadHealth} className="btn-ghost text-[10px]">
                    {L("تحديث", "Actualiser", "Refresh")}
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                    <div className="text-[10px] text-slate-400">
                      {L("قاعدة البيانات", "Base de données", "Database")}
                    </div>
                    <div
                      className={`mt-1 text-sm font-bold ${health.ok ? "text-emerald-300" : "text-rose-300"}`}
                    >
                      {health.ok ? "● " + L("متصل", "En ligne", "Up") : "● " + L("منقطع", "Hors ligne", "Down")}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                    <div className="text-[10px] text-slate-400">SMTP</div>
                    <div
                      className={`mt-1 text-sm font-bold ${health.smtpConfigured ? "text-emerald-300" : "text-amber-300"}`}
                    >
                      {health.smtpConfigured ? "● " + L("مُعد", "Configuré", "Configured") : "○ " + L("غير مُعد", "Non configuré", "Not configured")}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                    <div className="text-[10px] text-slate-400">
                      {L("مفتاح التشفير", "Clé de chiffrement", "Encryption key")}
                    </div>
                    <div
                      className={`mt-1 text-sm font-bold ${health.dedicatedEncryptionKey ? "text-emerald-300" : "text-amber-300"}`}
                    >
                      {health.dedicatedEncryptionKey
                        ? "● " + L("مُخصّص", "Dédiée", "Dedicated")
                        : "○ " + L("مشتق", "Dérivée", "Derived")}
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-[10px] text-slate-500">
                  {L("البيئة", "Environnement", "Environment")}:{" "}
                  <span className="font-mono">{health.environment}</span>
                </p>

                {health.warnings.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {health.warnings.map((w, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-200"
                      >
                        ⚠️ {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* security info */}
            <div className="card p-5 text-[11px] leading-relaxed text-slate-300">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gold-100">
                🛡️ {L("الأمان والخصوصية", "Sécurité et confidentialité", "Security & privacy")}
              </div>
              <ul className="list-inside list-disc space-y-1 text-slate-400">
                <li>
                  {L(
                    "تشفير AES-256-GCM للبيانات الشخصية",
                    "Chiffrement AES-256-GCM des données personnelles",
                    "AES-256-GCM encryption of personal data",
                  )}
                </li>
                <li>
                  {L(
                    "كلمات السر مُلبّدة PBKDF2-HMAC-SHA512",
                    "Mots de passe PBKDF2-HMAC-SHA512",
                    "Passwords hashed PBKDF2-HMAC-SHA512",
                  )}
                </li>
                <li>
                  {L(
                    "قفل الحساب بعد 5 محاولات فاشلة + حد لكل IP",
                    "Verrouillage après 5 échecs + limite par IP",
                    "Lock after 5 failures + per-IP limit",
                  )}
                </li>
                <li>
                  {L(
                    "كوكيز httpOnly + SameSite=Strict + سجل تدقيق",
                    "Cookies httpOnly + SameSite=Strict + audit",
                    "httpOnly cookies + SameSite=Strict + audit trail",
                  )}
                </li>
              </ul>
            </div>
          </section>
        )}

        {/* =============== AUDIT =============== */}
        {tab === "audit" && (
          <section className="mt-4">
            <div className="card divide-y divide-slate-800">
              {data.audit.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-bold text-gold-200">{a.actor}</span>
                    <span className="mx-1.5 text-[10px] text-slate-600">{a.actorKind}</span>
                    <span className="text-xs text-slate-300">{a.action}</span>
                  </div>
                  <span className="shrink-0 text-[9px] text-slate-500">
                    {new Date(a.createdAt).toLocaleString(
                      locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-FR" : "en-GB",
                      { timeZone: "Africa/Algiers" },
                    )}
                  </span>
                </div>
              ))}
              {data.audit.length === 0 && <p className="p-6 text-center text-xs text-slate-500">—</p>}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Btn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-gold-500/35 px-2.5 py-1 text-[10px] font-bold text-gold-200 transition hover:bg-gold-500/15 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function MiniBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-slate-600 px-2 py-0.5 text-[9px] font-semibold text-slate-300 transition hover:border-gold-500/50 hover:text-gold-200"
    >
      {children}
    </button>
  );
}

function BlsField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-slate-300">
        {label}
        {hint && <span className="text-slate-500">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

function BlsToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5"
    >
      <span
        className={`relative h-5 w-9 rounded-full transition ${
          checked ? "bg-gradient-to-r from-gold-400 to-gold-600" : "bg-slate-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
            checked ? "start-4.5" : "start-0.5"
          }`}
        />
      </span>
      <span className="text-xs font-semibold text-slate-300">{label}</span>
    </button>
  );
}

function ConfirmForm({ runId, onDone }: { runId: number; onDone: () => void }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [conf, setConf] = useState("");
  const [msg, setMsg] = useState("");

  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-4">
      <input className="field text-xs" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <input className="field text-xs" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      <input
        className="field text-xs"
        placeholder="Confirmation #"
        value={conf}
        onChange={(e) => setConf(e.target.value)}
      />
      <button
        className="btn-gold text-[10px]"
        onClick={async () => {
          const res = await fetch("/api/admin/runs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "confirm", runId, date, time, confirmation: conf }),
          });
          const j = await res.json();
          setMsg(j.ok ? "✓" : j.error ?? "error");
          if (j.ok) onDone();
        }}
      >
        Confirm
      </button>
      {msg && <span className="text-[10px] text-slate-400 sm:col-span-4">{msg}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Operator-side form renderer (reuses the client field definitions)    */
/* ------------------------------------------------------------------ */

function OperatorFormFields({
  values,
  errors,
  onChange,
  step,
}: {
  values: FormValues;
  errors: FormErrors;
  onChange: (n: string, v: string) => void;
  step: number;
}) {
  const { locale } = useLocale();
  const def = FORM_STEPS[step];
  if (!def) return null;

  const cats = categoriesFor(values.centre || "ALGIERS").map((c) => ({
    value: c.code,
    label: locale === "fr" ? c.fr : locale === "en" ? c.en : c.ar,
  }));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {def.fields.map((f) => {
        const label = locale === "fr" ? f.labelFr : locale === "en" ? f.labelEn : f.labelAr;
        const hint = locale === "fr" ? f.hintFr : locale === "en" ? f.hintEn : f.hintAr;
        const opts =
          locale === "fr"
            ? f.optionsFr ?? f.options ?? []
            : locale === "en"
              ? f.options ?? f.optionsFr ?? []
              : f.optionsAr ?? f.options ?? [];
        const err = errors[f.name];
        const span = f.span === 2 ? "sm:col-span-2" : "";

        if (f.name === "category") {
          return (
            <div key={f.name} className={span}>
              <BlsField label={`${label}${f.required ? " *" : ""}`}>
                <select
                  className="field"
                  value={values.category ?? ""}
                  onChange={(e) => onChange("category", e.target.value)}
                >
                  <option value="">—</option>
                  {cats.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </BlsField>
            </div>
          );
        }

        if (f.kind === "radio") {
          return (
            <div key={f.name} className={span}>
              <BlsField label={`${label}${f.required ? " *" : ""}`}>
                <div className="flex flex-wrap gap-2">
                  {opts.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => onChange(f.name, o)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        values[f.name] === o
                          ? "border-gold-400 bg-gradient-to-br from-gold-300 to-gold-600 text-ink"
                          : "border-slate-600 bg-slate-900/50 text-slate-300 hover:border-gold-500/60"
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </BlsField>
            </div>
          );
        }

        if (f.kind === "select") {
          return (
            <div key={f.name} className={span}>
              <BlsField label={`${label}${f.required ? " *" : ""}`}>
                <select
                  className="field"
                  value={values[f.name] ?? ""}
                  onChange={(e) => onChange(f.name, e.target.value)}
                >
                  <option value="">—</option>
                  {opts.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </BlsField>
            </div>
          );
        }

        if (f.kind === "textarea") {
          return (
            <div key={f.name} className={span}>
              <BlsField label={`${label}${f.required ? " *" : ""}`}>
                <textarea
                  className="field min-h-20 resize-y"
                  value={values[f.name] ?? ""}
                  onChange={(e) => onChange(f.name, e.target.value)}
                />
              </BlsField>
            </div>
          );
        }

        return (
          <div key={f.name} className={span}>
            <BlsField label={`${label}${f.required ? " *" : ""}`} hint={err ? "!" : hint}>
              <input
                className="field"
                type={f.kind === "date" ? "date" : "text"}
                value={values[f.name] ?? ""}
                aria-invalid={Boolean(err)}
                onChange={(e) => onChange(f.name, e.target.value)}
              />
            </BlsField>
          </div>
        );
      })}
    </div>
  );
}

export default function OperatorConsole() {
  return (
    <LocaleProvider>
      <Inner />
    </LocaleProvider>
  );
}