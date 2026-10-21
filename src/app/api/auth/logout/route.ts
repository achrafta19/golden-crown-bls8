import { NextRequest, NextResponse } from "next/server";
import { destroySession, OPERATOR_COOKIE, CLIENT_COOKIE } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await destroySession(req.cookies.get(OPERATOR_COOKIE)?.value);
  await destroySession(req.cookies.get(CLIENT_COOKIE)?.value);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(OPERATOR_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(CLIENT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}