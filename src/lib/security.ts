import { NextRequest } from "next/server";
import { db } from "@/db";
import { auditLog, sessionTokens, operators, clients } from "@/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { randomToken, verifyPassword, safeEqual } from "./crypto";

/* ------------------------------------------------------------------ */
/* Client IP / UA extraction (respects proxy headers)                   */
/* ------------------------------------------------------------------ */

export function clientIp(req: NextRequest | Request): string {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return (
    h.get("x-real-ip") ??
    h.get("cf-connecting-ip") ??
    h.get("true-client-ip") ??
    "127.0.0.1"
  );
}

export function userAgent(req: NextRequest | Request): string {
  return (req.headers.get("user-agent") ?? "unknown").slice(0, 400);
}

/* ------------------------------------------------------------------ */
/* Sliding-window rate limiter (in-memory, per instance)                */
/* ------------------------------------------------------------------ */

type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= limit) {
    const oldest = b.hits[0]!;
    buckets.set(key, b);
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }
  b.hits.push(now);
  buckets.set(key, b);
  return { ok: true, remaining: limit - b.hits.length, retryAfterSec: 0 };
}

// periodic cleanup
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets.entries()) {
      b.hits = b.hits.filter((t) => now - t < 3_600_000);
      if (b.hits.length === 0) buckets.delete(k);
    }
  }, 600_000);
  if (typeof timer.unref === "function") timer.unref();
}

/* ------------------------------------------------------------------ */
/* Audit trail                                                          */
/* ------------------------------------------------------------------ */

export async function audit(
  actor: string,
  actorKind: "OPERATOR" | "CLIENT" | "SYSTEM" | "ANON",
  action: string,
  target?: string,
  detail: Record<string, unknown> = {},
  ip?: string,
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actor,
      actorKind,
      action,
      target: target ?? null,
      detail,
      ip: ip ?? null,
    });
  } catch {
    /* never break the request because of logging */
  }
}

/* ------------------------------------------------------------------ */
/* Sessions                                                             */
/* ------------------------------------------------------------------ */

const OPERATOR_TTL_MIN = 120;
const CLIENT_TTL_MIN = 720;

export async function createSession(
  kind: "OPERATOR" | "CLIENT",
  subjectId: number,
  ip: string,
  ua: string,
): Promise<string> {
  const token = randomToken(32);
  const ttl = kind === "OPERATOR" ? OPERATOR_TTL_MIN : CLIENT_TTL_MIN;
  await db.insert(sessionTokens).values({
    token,
    kind,
    subjectId,
    ip,
    userAgent: ua,
    expiresAt: new Date(Date.now() + ttl * 60_000),
  });
  return token;
}

export async function readSession(token: string | undefined | null) {
  if (!token) return null;
  const rows = await db
    .select()
    .from(sessionTokens)
    .where(and(eq(sessionTokens.token, token), gt(sessionTokens.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await db.delete(sessionTokens).where(eq(sessionTokens.token, token));
}

/** Invalidate every session of a subject (used on password change). */
export async function destroySubjectSessions(kind: string, subjectId: number) {
  await db
    .delete(sessionTokens)
    .where(and(eq(sessionTokens.kind, kind), eq(sessionTokens.subjectId, subjectId)));
}

/* ------------------------------------------------------------------ */
/* Cookie helpers (httpOnly, secure, sameSite strict)                   */
/* ------------------------------------------------------------------ */

export const OPERATOR_COOKIE = "gcr_op";
export const CLIENT_COOKIE = "gcr_cl";

export function cookieOptions(maxAgeMin: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeMin * 60,
  };
}

/* ------------------------------------------------------------------ */
/* Guards                                                               */
/* ------------------------------------------------------------------ */

export type GuardResult =
  | { ok: true; operatorId: number; username: string }
  | { ok: false; reason: "NO_SESSION" | "EXPIRED" | "INACTIVE" };

export async function requireOperator(
  req: NextRequest,
): Promise<GuardResult> {
  const token = req.cookies.get(OPERATOR_COOKIE)?.value;
  const session = await readSession(token);
  if (!session || session.kind !== "OPERATOR") {
    return { ok: false, reason: "NO_SESSION" };
  }
  const row = await db
    .select()
    .from(operators)
    .where(eq(operators.id, session.subjectId ?? -1))
    .limit(1);
  const op = row[0];
  if (!op || !op.isActive) return { ok: false, reason: "INACTIVE" };
  return { ok: true, operatorId: op.id, username: op.username };
}

export type ClientGuard =
  | { ok: true; clientId: number; code: string }
  | { ok: false; reason: "NO_SESSION" | "EXPIRED" | "INACTIVE" };

export async function requireClient(req: NextRequest): Promise<ClientGuard> {
  const token = req.cookies.get(CLIENT_COOKIE)?.value;
  const session = await readSession(token);
  if (!session || session.kind !== "CLIENT") {
    return { ok: false, reason: "NO_SESSION" };
  }
  const row = await db
    .select()
    .from(clients)
    .where(eq(clients.id, session.subjectId ?? -1))
    .limit(1);
  const c = row[0];
  if (!c || !c.isActive) return { ok: false, reason: "INACTIVE" };
  return { ok: true, clientId: c.id, code: c.code };
}

/* ------------------------------------------------------------------ */
/* Operator authentication with lockout                                 */
/* ------------------------------------------------------------------ */

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function authenticateOperator(
  username: string,
  password: string,
  ip: string,
  ua: string,
): Promise<
  | { ok: true; token: string; operatorId: number }
  | { ok: false; error: "BAD_CREDENTIALS" | "LOCKED" | "DISABLED" }
> {
  const rows = await db
    .select()
    .from(operators)
    .where(sql`lower(${operators.username}) = lower(${username})`)
    .limit(1);
  const op = rows[0];

  // Constant-ish work even when the operator does not exist.
  if (!op) {
    await new Promise((r) => setTimeout(r, 350));
    return { ok: false, error: "BAD_CREDENTIALS" };
  }

  if (op.lockedUntil && op.lockedUntil.getTime() > Date.now()) {
    return { ok: false, error: "LOCKED" };
  }
  if (!op.isActive) return { ok: false, error: "DISABLED" };

  const valid = verifyPassword(password, op.salt, op.passwordHash);
  if (!valid) {
    const failed = op.failedLogins + 1;
    const lockUntil =
      failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
    await db
      .update(operators)
      .set({ failedLogins: failed, lockedUntil: lockUntil })
      .where(eq(operators.id, op.id));
    await audit(op.username, "OPERATOR", "LOGIN_FAILED", `operator:${op.id}`, {
      failed,
      locked: Boolean(lockUntil),
    }, ip);
    return { ok: false, error: failed >= MAX_FAILED ? "LOCKED" : "BAD_CREDENTIALS" };
  }

  await db
    .update(operators)
    .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(operators.id, op.id));

  const token = await createSession("OPERATOR", op.id, ip, ua);
  await audit(op.username, "OPERATOR", "LOGIN_OK", `operator:${op.id}`, {}, ip);
  return { ok: true, token, operatorId: op.id };
}

/* ------------------------------------------------------------------ */
/* CSRF double-submit check for operator mutations                      */
/* ------------------------------------------------------------------ */

export function checkOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetch may omit it
  try {
    const url = new URL(origin);
    const host = req.headers.get("host");
    return url.host === host;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Security headers                                                      */
/* ------------------------------------------------------------------ */

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), interest-cohort=()",
  "X-DNS-Prefetch-Control": "off",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export { safeEqual };