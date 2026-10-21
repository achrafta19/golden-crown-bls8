import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { operators } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  requireOperator,
  clientIp,
  audit,
  checkOrigin,
  destroySubjectSessions,
  OPERATOR_COOKIE,
  cookieOptions,
} from "@/lib/security";
import { hashPassword, makeSalt, verifyPassword } from "@/lib/crypto";
import { createSession } from "@/lib/security";

export const dynamic = "force-dynamic";

/** Operator changes their own password from inside the console. */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  if (!checkOrigin(req)) {
    return NextResponse.json({ ok: false, error: "BAD_ORIGIN" }, { status: 403 });
  }

  const guard = await requireOperator(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const current = body.currentPassword ?? "";
  const next = body.newPassword ?? "";

  if (next.length < 8) {
    return NextResponse.json(
      { ok: false, error: "PASSWORD_TOO_SHORT" },
      { status: 400 },
    );
  }
  if (!/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) {
    return NextResponse.json(
      { ok: false, error: "PASSWORD_TOO_WEAK" },
      { status: 400 },
    );
  }

  const rows = await db
    .select()
    .from(operators)
    .where(eq(operators.id, guard.operatorId))
    .limit(1);
  const op = rows[0];
  if (!op) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!verifyPassword(current, op.salt, op.passwordHash)) {
    await audit(op.username, "OPERATOR", "PASSWORD_CHANGE_FAILED", undefined, {}, ip);
    return NextResponse.json({ ok: false, error: "BAD_CREDENTIALS" }, { status: 401 });
  }

  const salt = makeSalt();
  await db
    .update(operators)
    .set({
      salt,
      passwordHash: hashPassword(next, salt),
      passwordChangedAt: new Date(),
      failedLogins: 0,
      lockedUntil: null,
    })
    .where(eq(operators.id, op.id));

  // Kill all other sessions, then issue a fresh one for this device
  await destroySubjectSessions("OPERATOR", op.id);
  const token = await createSession(
    "OPERATOR",
    op.id,
    ip,
    req.headers.get("user-agent") ?? "unknown",
  );

  await audit(op.username, "OPERATOR", "PASSWORD_CHANGED", `operator:${op.id}`, {}, ip);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(OPERATOR_COOKIE, token, cookieOptions(120));
  return res;
}