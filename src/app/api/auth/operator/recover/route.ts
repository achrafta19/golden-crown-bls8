import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { operators, recoveryRequests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit, clientIp, audit } from "@/lib/security";
import { hashPassword, makeSalt, randomToken, safeEqual } from "@/lib/crypto";
import { sendRecoveryEmail } from "@/lib/mailer";
import { bootstrap } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

/** Normalise Algerian phone numbers to +213XXXXXXXXX for comparison. */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+213")) return `+213${digits.slice(4)}`;
  if (digits.startsWith("00213")) return `+213${digits.slice(5)}`;
  if (digits.startsWith("213")) return `+213${digits.slice(3)}`;
  if (digits.startsWith("0")) return `+213${digits.slice(1)}`;
  return `+213${digits}`;
}

function normaliseUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Password recovery — requires BOTH the registered email and the registered
 * Algerian phone number to match, so knowledge of only one factor is useless.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  await bootstrap();

  const limited = rateLimit(`recover:${ip}`, 5, 900_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "TOO_MANY_ATTEMPTS", retryAfter: limited.retryAfterSec },
      { status: 429 },
    );
  }

  let body: { username?: string; email?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const username = normaliseUsername(body.username ?? "");
  const email = normaliseEmail(body.email ?? "");
  const phone = normalisePhone(body.phone ?? "");

  if (!username || !email || !phone) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  const rows = await db.select().from(operators).where(eq(operators.username, username)).limit(1);
  const op = rows[0];

  // Uniform failure response — never reveal which factor was wrong.
  const genericFail = () =>
    NextResponse.json(
      { ok: false, error: "RECOVERY_FAILED" },
      { status: 401 },
    );

  if (!op) {
    await new Promise((r) => setTimeout(r, 600));
    return genericFail();
  }

  const emailOk = safeEqual(normaliseEmail(op.email ?? ""), email);
  const phoneOk = safeEqual(normalisePhone(op.phone ?? ""), phone);

  if (!emailOk || !phoneOk) {
    await audit(username, "ANON", "RECOVERY_FAILED", `operator:${op.id}`, { ip }, ip);
    await new Promise((r) => setTimeout(r, 600));
    return genericFail();
  }

  // Generate and store the new credential
  const newPassword = `Gc@${randomToken(9)}`;
  const salt = makeSalt();

  await db
    .update(operators)
    .set({
      salt,
      passwordHash: hashPassword(newPassword, salt),
      passwordChangedAt: new Date(),
      failedLogins: 0,
      lockedUntil: null,
    })
    .where(eq(operators.id, op.id));

  // Invalidate every active session of this operator
  await db.delete(recoveryRequests).where(eq(recoveryRequests.username, username));
  await db
    .insert(recoveryRequests)
    .values({
      username,
      email: op.email ?? email,
      phone: op.phone ?? phone,
      newPasswordHash: hashPassword(newPassword, salt),
      newPasswordSalt: salt,
      status: "CONSUMED",
      consumedAt: new Date(),
    });

  const delivery = await sendRecoveryEmail(op.email ?? email, username, newPassword);
  await audit(username, "OPERATOR", "RECOVERY_OK", `operator:${op.id}`, { ip }, ip);

  return NextResponse.json({
    ok: true,
    delivered: delivery.delivered,
    // Surfaced so the operator console can display it when SMTP is unconfigured.
    newPassword: delivery.delivered ? undefined : newPassword,
    message: "RECOVERY_OK",
  });
}