import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createSession,
  clientIp,
  userAgent,
  rateLimit,
  audit,
  CLIENT_COOKIE,
  cookieOptions,
} from "@/lib/security";
import { getQuotaState } from "@/lib/quota";
import { bootstrap } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

/** Client signs in with the 5-digit access code issued by the operator. */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const ua = userAgent(req);
  await bootstrap();

  const limited = rateLimit(`client-login:${ip}`, 12, 300_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "TOO_MANY_ATTEMPTS", retryAfter: limited.retryAfterSec },
      { status: 429 },
    );
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const code = (body.code ?? "").trim();
  if (!/^\d{5}$/.test(code)) {
    // burn a little time so brute force is not measurable
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ ok: false, error: "INVALID_CODE" }, { status: 401 });
  }

  const rows = await db.select().from(clients).where(eq(clients.code, code)).limit(1);
  const client = rows[0];

  if (!client || !client.isActive) {
    await new Promise((r) => setTimeout(r, 400));
    await audit(code, "CLIENT", "LOGIN_FAILED", undefined, {}, ip);
    return NextResponse.json({ ok: false, error: "INVALID_CODE" }, { status: 401 });
  }

  const token = await createSession("CLIENT", client.id, ip, ua);
  await audit(client.code, "CLIENT", "LOGIN_OK", `client:${client.id}`, {}, ip);

  const quota = await getQuotaState(client.id);

  const res = NextResponse.json({
    ok: true,
    client: {
      id: client.id,
      code: client.code,
      fullName: client.fullName,
      phone: client.phone,
      email: client.email,
    },
    quota,
  });
  res.cookies.set(CLIENT_COOKIE, token, cookieOptions(720));
  return res;
}