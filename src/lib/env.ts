/**
 * Centralised runtime configuration.
 *
 * Every secret is read from the environment on the server only — nothing here
 * ever reaches the browser bundle. The operator console stores its own BLS
 * credentials in PostgreSQL instead of the filesystem.
 */

/** True when the required production secrets are present. */
export function assertProductionEnv(): void {
  const required = ["DATABASE_URL"] as const;
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Copy .env.example to .env and fill it in.`,
    );
  }
}

export type RuntimeInfo = {
  nodeEnv: string;
  isProduction: boolean;
  databaseConfigured: boolean;
  smtpConfigured: boolean;
  /** true when the AES key is derived from DATABASE_URL (dev fallback) */
  usingDerivedEncryptionKey: boolean;
};

export function runtimeInfo(): RuntimeInfo {
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    isProduction: process.env.NODE_ENV === "production",
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    smtpConfigured: Boolean(
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
    ),
    usingDerivedEncryptionKey: !process.env.DATA_ENCRYPTION_KEY,
  };
}

/**
 * Environment variables that must be present in production.
 *
 * Reported by /api/health as warnings only: a missing value degrades the
 * recovery flow but must never take the whole site offline, so this never
 * flips the health status to 503.
 */
export function missingRequiredEnv(): string[] {
  const required = [
    "OPERATOR_USERNAME",
    "OPERATOR_PASSWORD",
    "OPERATOR_EMAIL",
    "OPERATOR_PHONE",
  ];
  return required.filter((k) => !process.env[k]?.trim());
}

/**
 * Flags that must be set for a real public deployment.
 * Surfaced in the operator console so a half-configured host is obvious.
 */
export function deploymentWarnings(): string[] {
  const info = runtimeInfo();
  const warnings: string[] = [];

  if (!info.smtpConfigured) {
    warnings.push(
      "SMTP is not configured — password recovery and booking notifications are logged to the server console instead of being emailed.",
    );
  }
  if (info.usingDerivedEncryptionKey) {
    warnings.push(
      "DATA_ENCRYPTION_KEY is not set — applicant PII is encrypted with a key derived from DATABASE_URL. Set a dedicated key before going live.",
    );
  }
  if (process.env.OPERATOR_PASSWORD === "Achraf@001") {
    warnings.push(
      "The operator password is still the default. Change it from Settings inside the console.",
    );
  }
  return warnings;
}