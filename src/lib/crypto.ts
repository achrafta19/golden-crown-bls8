import { createHash, createHmac, pbkdf2Sync, randomBytes, randomInt, timingSafeEqual, createCipheriv, createDecipheriv } from "node:crypto";

/* ------------------------------------------------------------------ */
/* Password hashing — PBKDF2-HMAC-SHA512 (no external deps)            */
/* ------------------------------------------------------------------ */

export function makeSalt(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password.normalize("NFKC"), salt, 210_000, 64, "sha512")
    .toString("hex");
}

export function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): boolean {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/* ------------------------------------------------------------------ */
/* Opaque tokens / codes                                                */
/* ------------------------------------------------------------------ */

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Numeric 5-digit client access code (uniform, no leading-zero bias). */
export function randomFiveDigitCode(): string {
  const n = randomInt(0, 100_000);
  return n.toString().padStart(5, "0");
}

export function randomBLSReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[randomInt(0, alphabet.length)];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/* ------------------------------------------------------------------ */
/* Comparison-safe helpers                                              */
/* ------------------------------------------------------------------ */

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // still burn a comparison to keep timing flat
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/* ------------------------------------------------------------------ */
/* Payload encryption for sensitive applicant PII at rest              */
/* ------------------------------------------------------------------ */

/**
 * Key material for field-level encryption and blind indexes.
 * A dedicated DATA_ENCRYPTION_KEY is strongly preferred; the DATABASE_URL
 * fallback keeps local development working without extra setup.
 */
function encryptionKey(): Buffer {
  const secret =
    process.env.DATA_ENCRYPTION_KEY ||
    process.env.DATABASE_URL ||
    "blsvisa-development-only-key";
  return createHash("sha256").update(secret).digest();
}

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptField(payload: string): string {
  if (!payload.startsWith("v1:")) return payload;
  try {
    const [, ivB64, tagB64, dataB64] = payload.split(":");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return payload;
  }
}

/** Deterministic keyed digest used to index encrypted columns (blind index). */
export function blindIndex(value: string): string {
  return createHmac("sha256", encryptionKey())
    .update(value.trim().toLowerCase())
    .digest("hex");
}

/* ------------------------------------------------------------------ */
/* Field level integrity (HMAC) so the server can detect tampering      */
/* ------------------------------------------------------------------ */

export function signPayload(payload: unknown): string {
  return createHmac("sha256", encryptionKey())
    .update(JSON.stringify(payload))
    .digest("base64url");
}