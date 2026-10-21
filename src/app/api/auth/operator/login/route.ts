import { NextRequest, NextResponse } from "next/server";
import {
  authenticateOperator,
  clientIp,
  userAgent,
  rateLimit,
  OPERATOR_COOKIE,
  cookieOptions,
} from "@/lib/security";
import { audit } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const ua = userAgent(req);

  const limited = rateLimit(`op-login:${ip}`, 8, 300_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "TOO_MANY_ATTEMPTS", retryAfter: limited.retryAfterSec },
      { status: 429 },
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "BAD_CREDENTIALS" }, { status: 401 });
  }

  const result = await authenticateOperator(username, password, ip, ua);

  if (!result.ok) {
    const status = result.error === "LOCKED" ? 423 : 401;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(OPERATOR_COOKIE, result.token, cookieOptions(120));
  return res;
}