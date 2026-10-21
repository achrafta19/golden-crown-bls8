import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { captchaChallenges } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireOperator, audit, clientIp, rateLimit } from "@/lib/security";
import { resumeAfterCaptcha, releaseExpiredChallenges } from "@/lib/engine";

export const dynamic = "force-dynamic";

/** List pending CAPTCHA challenges awaiting a human. */
export async function GET(req: NextRequest) {
  const guard = await requireOperator(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  await releaseExpiredChallenges();

  const rows = await db
    .select()
    .from(captchaChallenges)
    .where(eq(captchaChallenges.status, "PENDING"))
    .orderBy(desc(captchaChallenges.createdAt))
    .limit(20);

  return NextResponse.json({ ok: true, captchas: rows });
}

/** Operator submits the CAPTCHA solution; the run resumes immediately. */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const guard = await requireOperator(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const limited = rateLimit(`captcha:${guard.operatorId}`, 120, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "TOO_MANY_ATTEMPTS" }, { status: 429 });
  }

  let body: { id?: number; solution?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const id = Number(body.id);
  const solution = (body.solution ?? "").trim();
  if (!id || !solution) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const result = await resumeAfterCaptcha(id, solution, guard.username);
  await audit(guard.username, "OPERATOR", "CAPTCHA_SOLVED", `captcha:${id}`, {}, ip);

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

