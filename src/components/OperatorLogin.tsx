"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocaleProvider, LocaleSwitcher, useLocale } from "./LocaleProvider";
import { AlgeriaClock } from "./AlgeriaClock";

type Mode = "login" | "recover" | "password";

function Inner() {
  const { tr, locale } = useLocale();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // Recovery keeps its own fields so the operator username is never shown there.
  const [recoverUsername, setRecoverUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const L = (a: string, f: string, e: string) => (locale === "fr" ? f : locale === "en" ? e : a);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/operator/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setMsg({
          kind: "err",
          text:
            j.error === "LOCKED"
              ? L("الحساب مقفل مؤقتًا بعد محاولات فاشلة متكررة", "Compte temporairement verrouillé", "Account temporarily locked")
              : L("بيانات الدخول غير صحيحة", "Identifiants incorrects", "Invalid credentials"),
        });
        return;
      }
      router.replace("/operator");
    } catch {
      setMsg({ kind: "err", text: tr("error") });
    } finally {
      setBusy(false);
    }
  }

  async function doRecover(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/operator/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: recoverUsername, email, phone }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setMsg({
          kind: "err",
          text: L(
            "فشل الاسترداد: تأكد من اسم المستخدم والبريد ورقم الهاتف",
            "Échec de la récupération : vérifiez l'identifiant, l'e-mail et le téléphone",
            "Recovery failed: check username, email and phone",
          ),
        });
        return;
      }
      setMsg({
        kind: "ok",
        text: j.delivered
          ? L(
              "تم إرسال كلمة السر الجديدة إلى بريدك الإلكتروني",
              "Nouveau mot de passe envoyé par e-mail",
              "New password sent to your email",
            )
          : L(
              `تعذّر إرسال البريد — كلمة السر الجديدة: ${j.newPassword}`,
              `E-mail non envoyé — nouveau mot de passe : ${j.newPassword}`,
              `Email not sent — new password: ${j.newPassword}`,
            ),
      });
      setRecoverUsername("");
      setMode("login");
    } catch {
      setMsg({ kind: "err", text: tr("error") });
    } finally {
      setBusy(false);
    }
  }

  async function doChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setMsg({ kind: "err", text: L("كلمتا السر غير متطابقتين", "Les mots de passe ne correspondent pas", "Passwords do not match") });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/operator/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setMsg({
          kind: "err",
          text:
            j.error === "PASSWORD_TOO_SHORT"
              ? L("كلمة السر قصيرة جدًا (8 أحرف على الأقل)", "Mot de passe trop court (8 caractères min.)", "Password too short (min 8 chars)")
              : j.error === "PASSWORD_TOO_WEAK"
                ? L("يجب أن تحتوي على أحرف وأرقام", "Doit contenir lettres et chiffres", "Must contain letters and numbers")
                : L("كلمة السر الحالية غير صحيحة", "Mot de passe actuel incorrect", "Current password is incorrect"),
        });
        return;
      }
      setMsg({ kind: "ok", text: tr("saved") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch {
      setMsg({ kind: "err", text: tr("error") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(800px 500px at 50% 0%, rgba(201,162,39,0.13), transparent 60%), linear-gradient(180deg,#070b18,#0b1020)",
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-md">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden>
              <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f7e7a1" />
                  <stop offset="100%" stopColor="#c9a227" />
                </linearGradient>
              </defs>
              <path fill="url(#lg)" d="M8 46 L14 20 L25 32 L32 12 L39 32 L50 20 L56 46 Z" />
              <rect x="8" y="48" width="48" height="6" rx="3" fill="url(#lg)" />
            </svg>
            <div className="leading-tight">
              <div className="gold-text text-base font-black">{tr("brand_name")}</div>
              <div className="text-[10px] text-slate-400">{tr("operator_portal")}</div>
            </div>
          </div>
          <LocaleSwitcher />
        </div>

        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-lg font-bold text-gold-100">
              {mode === "login"
                ? tr("login_title")
                : mode === "recover"
                  ? tr("recovery")
                  : tr("change_password")}
            </h1>
            <AlgeriaClock compact />
          </div>

          {msg && (
            <div
              className={`mb-4 rounded-lg border p-3 text-xs font-semibold ${
                msg.kind === "ok"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-300"
              }`}
            >
              {msg.text}
            </div>
          )}

          {mode === "login" && (
            <form onSubmit={doLogin} className="space-y-3">
              <Input
                label={tr("username")}
                value={username}
                onChange={setUsername}
                autoComplete="username"
              />
              <Input
                label={tr("password")}
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />
              <button type="submit" disabled={busy} className="btn-gold w-full">
                {busy ? tr("loading") : tr("login")}
              </button>
              <div className="flex justify-between pt-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setMode("recover")}
                  className="text-gold-300 hover:underline"
                >
                  {tr("recovery")}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("password")}
                  className="text-gold-300 hover:underline"
                >
                  {tr("change_password")}
                </button>
              </div>
            </form>
          )}

          {mode === "recover" && (
            <form onSubmit={doRecover} className="space-y-3">
              <p className="text-[11px] leading-relaxed text-slate-400">{tr("recovery_hint")}</p>
              <Input label={tr("username")} value={recoverUsername} onChange={setRecoverUsername} />
              <Input
                label={L("البريد الإلكتروني", "Adresse e-mail", "Email address")}
                type="email"
                value={email}
                onChange={setEmail}
              />
              <Input
                label={L("رقم الهاتف الجزائري", "Téléphone algérien", "Algerian phone")}
                value={phone}
                onChange={setPhone}
                placeholder="+213..."
              />
              <button type="submit" disabled={busy} className="btn-gold w-full">
                {busy ? tr("loading") : tr("recover")}
              </button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="btn-ghost w-full text-xs"
              >
                {tr("back")}
              </button>
            </form>
          )}

          {mode === "password" && (
            <form onSubmit={doChangePassword} className="space-y-3">
              <Input
                label={tr("current_password")}
                type="password"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
              />
              <Input
                label={tr("new_password")}
                type="password"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
              />
              <Input
                label={tr("confirm_password")}
                type="password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
              />
              <button type="submit" disabled={busy} className="btn-gold w-full">
                {busy ? tr("loading") : tr("save")}
              </button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="btn-ghost w-full text-xs"
              >
                {tr("back")}
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] text-slate-500">
          {L(
            "الدخول مخصص للمشغّل فقط. جميع المحاولات تُسجَّل في سجل التدقيق.",
            "Accès réservé à l'opérateur. Toutes les tentatives sont journalisées.",
            "Operator-only access. All attempts are audit-logged.",
          )}
        </p>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-300">{label}</span>
      <input
        className="field"
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </label>
  );
}

export default function OperatorLogin() {
  return (
    <LocaleProvider>
      <Inner />
    </LocaleProvider>
  );
}