import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireOperator, audit, clientIp, rateLimit } from "@/lib/security";
import { randomFiveDigitCode } from "@/lib/crypto";
import { getQuotaState } from "@/lib/quota";

export const dynamic = "force-dynamic";

/** List all client access codes. */
export async function GET(req: NextRequest) {
  const guard = await requireOperator(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rows = await db.select().from(clients).orderBy(sql`${clients.createdAt} desc`);
  const withQuota = await Promise.all(
    rows.map(async (c) => ({ ...c, quotaState: await getQuotaState(c.id) })),
  );

  return NextResponse.json({ ok: true, clients: withQuota });
}

/** Create one or more 5-digit access codes. */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const guard = await requireOperator(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const limited = rateLimit(`gencode:${guard.operatorId}`, 20, 600_000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "TOO_MANY_ATTEMPTS" }, { status: 429 });
  }

  let body: { count?: number; fullName?: string; phone?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const count = Math.min(Math.max(Number(body.count ?? 1) || 1, 1), 50);
  const fullName = (body.fullName ?? "").trim() || `Client ${new Date().getTime() % 100000}`;
  const phone = (body.phone ?? "").trim();

  const existing = await db.select({ code: clients.code }).from(clients);
  const taken = new Set(existing.map((r) => r.code));

  const created: Array<{ code: string; id: number }> = [];
  let guardCounter = 0;
  while (created.length < count && guardCounter < count * 40) {
    guardCounter += 1;
    const code = randomFiveDigitCode();
    if (taken.has(code)) continue;
    taken.add(code);
    const ins = await db
      .insert(clients)
      .values({ code, fullName, phone: phone || "+213000000000", email: body.email ?? null })
      .onConflictDoNothing()
      .returning({ id: clients.id, code: clients.code });
    if (ins[0]) created.push(ins[0]);
  }

  await audit(guard.username, "OPERATOR", "CODES_GENERATED", undefined, { count: created.length }, ip);

  return NextResponse.json({ ok: true, created });
}

/** Toggle activation or reset the quota of a client. */
export async function PATCH(req: NextRequest) {
  const ip = clientIp(req);
  const guard = await requireOperator(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { id?: number; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const id = Number(body.id);
  const action = body.action ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  if (action === "toggle") {
    const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (!rows[0]) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    await db
      .update(clients)
      .set({ isActive: !rows[0].isActive })
      .where(eq(clients.id, id));
  } else if (action === "reset_quota") {
    const { quotaClaims } = await import("@/db/schema");
    await db.delete(quotaClaims).where(eq(quotaClaims.clientId, id));
    await db.update(clients).set({ quota: 2 }).where(eq(clients.id, id));
  } else if (action === "delete") {
    await db.delete(clients).where(eq(clients.id, id));
  } else {
    return NextResponse.json({ ok: false, error: "UNKNOWN_ACTION" }, { status: 400 });
  }

  await audit(guard.username, "OPERATOR", `CLIENT_${action.toUpperCase()}`, `client:${id}`, {}, ip);
  return NextResponse.json({ ok: true });
}

