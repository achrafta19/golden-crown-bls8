"use client";

import { useMemo } from "react";
import { useLocale } from "./LocaleProvider";
import { FORM_STEPS, categoriesFor, type FormField } from "@/lib/bls-form";

export type FormValues = Record<string, string>;
export type FormErrors = Record<string, string>;

export function fieldLabel(f: FormField, locale: "ar" | "fr" | "en") {
  if (locale === "fr") return f.labelFr;
  if (locale === "en") return f.labelEn;
  return f.labelAr;
}

export function fieldHint(f: FormField, locale: "ar" | "fr" | "en") {
  if (locale === "fr") return f.hintFr;
  if (locale === "en") return f.hintEn;
  return f.hintAr;
}

export function fieldOptions(f: FormField, locale: "ar" | "fr" | "en") {
  if (locale === "fr") return f.optionsFr ?? f.options ?? [];
  if (locale === "en") return f.options ?? f.optionsFr ?? [];
  return f.optionsAr ?? f.options ?? [];
}

type Props = {
  values: FormValues;
  errors: FormErrors;
  onChange: (name: string, value: string) => void;
  step: number;
};

export function FormStepFields({ values, errors, onChange, step }: Props) {
  const { locale } = useLocale();
  const def = FORM_STEPS[step];
  if (!def) return null;

  const categories = useMemo(() => {
    const centre = values.centre || "ALGIERS";
    return categoriesFor(centre).map((c) => ({
      value: c.code,
      label: locale === "fr" ? c.fr : locale === "en" ? c.en : c.ar,
    }));
  }, [values.centre, locale]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {def.fields.map((f) => {
        const label = fieldLabel(f, locale);
        const hint = fieldHint(f, locale);
        const err = errors[f.name];
        const span = f.span === 2 ? "sm:col-span-2" : "";

        // Category is dynamic per centre
        if (f.name === "category") {
          return (
            <div key={f.name} className={span}>
              <FieldShell
                label={label}
                required={f.required}
                hint={hint}
                error={err}
                locale={locale}
              >
                <select
                  className="field"
                  value={values.category ?? ""}
                  aria-invalid={Boolean(err)}
                  onChange={(e) => onChange("category", e.target.value)}
                >
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </FieldShell>
            </div>
          );
        }

        if (f.kind === "radio") {
          const opts = fieldOptions(f, locale);
          return (
            <div key={f.name} className={span}>
              <FieldShell
                label={label}
                required={f.required}
                hint={hint}
                error={err}
                locale={locale}
              >
                <div className="flex flex-wrap gap-2">
                  {opts.map((o, i) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => onChange(f.name, o)}
                      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                        values[f.name] === o
                          ? "border-gold-400 bg-gradient-to-br from-gold-300 to-gold-600 text-ink"
                          : "border-slate-600 bg-slate-900/50 text-slate-300 hover:border-gold-500/60"
                      }`}
                      aria-pressed={values[f.name] === o}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </FieldShell>
            </div>
          );
        }

        if (f.kind === "select") {
          const opts = fieldOptions(f, locale);
          return (
            <div key={f.name} className={span}>
              <FieldShell
                label={label}
                required={f.required}
                hint={hint}
                error={err}
                locale={locale}
              >
                <select
                  className="field"
                  value={values[f.name] ?? ""}
                  aria-invalid={Boolean(err)}
                  onChange={(e) => onChange(f.name, e.target.value)}
                >
                  <option value="">—</option>
                  {opts.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </FieldShell>
            </div>
          );
        }

        if (f.kind === "textarea") {
          return (
            <div key={f.name} className={span}>
              <FieldShell
                label={label}
                required={f.required}
                hint={hint}
                error={err}
                locale={locale}
              >
                <textarea
                  className="field min-h-24 resize-y"
                  value={values[f.name] ?? ""}
                  aria-invalid={Boolean(err)}
                  placeholder={f.placeholder}
                  onChange={(e) => onChange(f.name, e.target.value)}
                />
              </FieldShell>
            </div>
          );
        }

        return (
          <div key={f.name} className={span}>
            <FieldShell
              label={label}
              required={f.required}
              hint={hint}
              error={err}
              locale={locale}
            >
              <input
                className="field"
                type={f.kind === "date" ? "date" : "text"}
                value={values[f.name] ?? ""}
                aria-invalid={Boolean(err)}
                placeholder={f.placeholder}
                autoComplete="off"
                onChange={(e) => onChange(f.name, e.target.value)}
              />
            </FieldShell>
          </div>
        );
      })}
    </div>
  );
}

function FieldShell({
  label,
  required,
  hint,
  error,
  locale,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  locale: "ar" | "fr" | "en";
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
        {label}
        {required && <span className="text-rose-400">*</span>}
      </span>
      {children}
      {hint && !error && (
        <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">
          {hint}
        </span>
      )}
      {error && (
        <span className="mt-1 block text-[10px] font-semibold text-rose-400">
          {error === "required"
            ? locale === "fr"
              ? "Champ obligatoire"
              : locale === "en"
                ? "Required field"
                : "حقل مطلوب"
            : locale === "fr"
              ? "Valeur invalide"
              : locale === "en"
                ? "Invalid value"
                : "قيمة غير صحيحة"}
        </span>
      )}
    </label>
  );
}

export function StepTitle({ step }: { step: number }) {
  const { locale } = useLocale();
  const def = FORM_STEPS[step];
  if (!def) return null;
  const title =
    locale === "fr" ? def.titleFr : locale === "en" ? def.titleEn : def.titleAr;
  return (
    <div className="mb-5 flex items-center gap-2.5">
      <span className="text-2xl">{def.icon}</span>
      <h2 className="text-lg font-bold text-gold-100">{title}</h2>
    </div>
  );
}