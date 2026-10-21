import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { blsConnection } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireOperator, audit, clientIp, checkOrigin } from "@/lib/security";
import { ensureSlotWindows, pickUserAgent } from "@/lib/engine";

export const dynamic = "force-dynamic";

type Settings = typeof blsConnection.$inferSelect;

async function load(): Promise<Settings | null> {
  const rows = await db.select().from(blsConnection).limit(1);
  if (rows[0]) return rows[0];
  await ensureSlotWindows();
  const ins = await db.insert(blsConnection).values({}).returning();
  return ins[0] ?? null;
}

/** Public-safe view — never leaks secrets to the client side. */
function publicView(s: Settings | null) {
  if (!s) return null;
  return {
    baseUrl: s.baseUrl,
    appointmentPath: s.appointmentPath,
    bookingType: s.bookingType,
    centre: s.centre,
    category: s.category,
    proxyUrl: s.proxyUrl,
    proxySet: Boolean(s.proxyUrl),
    userAgentPoolSize: s.userAgentPoolSize,
    acceptLanguage: s.acceptLanguage,
    requestTimeoutMs: s.requestTimeoutMs,
    highVelocity: s.highVelocity,
    preWarmSeconds: s.preWarmSeconds,
    maxParallelRuns: s.maxParallelRuns,
    attemptBudget: s.attemptBudget,
    humanCaptcha: s.humanCaptcha,
    verificationCodeSet: Boolean(s.verificationCode),
    connected: s.connected,
    lastTestAt: s.lastTestAt,
    lastTestStatus: s.lastTestStatus,
    sampleUserAgents: Array.from({ length: Math.min(s.userAgentPoolSize, 5) }, (_, i) =>
      pickUserAgent(i),
    ),
  };
}

export async function GET(req: NextRequest) {
  const guard = await requireOperator(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  const s = await load();
  return NextResponse.json({ ok: true, settings: publicView(s) });
}

/** Save the BLS portal connection settings. */
export async function PUT(req: NextRequest) {
  const ip = clientIp(req);
  const guard = await requireOperator(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!checkOrigin(req)) {
    return NextResponse.json({ ok: false, error: "BAD_ORIGIN" }, { status: 403 });
  }

  const current = await load();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const str = (v: unknown, fb: string) => (typeof v === "string" ? v.trim() : fb);
  const num = (v: unknown, fb: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fb;
  };
  const bool = (v: unknown, fb: boolean) => (typeof v === "boolean" ? v : fb);

  const baseUrl = str(body.baseUrl, current?.baseUrl ?? "https://algeria.blsspainvisa.com");
  if (!/^https?:\/\/.+/i.test(baseUrl)) {
    return NextResponse.json({ ok: false, error: "INVALID_BASE_URL" }, { status: 400 });
  }

  const values = {
    baseUrl,
    appointmentPath: str(body.appointmentPath, current?.appointmentPath ?? "/appointment.php"),
    bookingType: str(body.bookingType, current?.bookingType ?? "Individual"),
    centre: str(body.centre, current?.centre ?? "ALGIERS"),
    category: str(body.category, current?.category ?? "ALG2"),
    proxyUrl:
      body.proxyUrl === null
        ? null
        : typeof body.proxyUrl === "string"
          ? body.proxyUrl.trim() || null
          : current?.proxyUrl ?? null,
    userAgentPoolSize: num(body.userAgentPoolSize, current?.userAgentPoolSize ?? 5, 1, 20),
    acceptLanguage: str(body.acceptLanguage, current?.acceptLanguage ?? "ar-DZ,ar;q=0.9"),
    requestTimeoutMs: num(body.requestTimeoutMs, current?.requestTimeoutMs ?? 15_000, 3_000, 60_000),
    highVelocity: bool(body.highVelocity, current?.highVelocity ?? true),
    preWarmSeconds: num(body.preWarmSeconds, current?.preWarmSeconds ?? 45, 5, 600),
    maxParallelRuns: num(body.maxParallelRuns, current?.maxParallelRuns ?? 12, 1, 64),
    attemptBudget: num(body.attemptBudget, current?.attemptBudget ?? 400, 10, 5_000),
    humanCaptcha: bool(body.humanCaptcha, current?.humanCaptcha ?? true),
    verificationCode:
      body.verificationCode === null
        ? null
        : typeof body.verificationCode === "string"
          ? body.verificationCode.trim() || null
          : current?.verificationCode ?? null,
    updatedAt: new Date(),
  };

  const saved = current
    ? await db.update(blsConnection).set(values).where(eq(blsConnection.id, current.id)).returning()
    : await db.insert(blsConnection).values(values).returning();

  await audit(guard.username, "OPERATOR", "BLS_SETTINGS_SAVED", "bls_connection", { baseUrl, centre: values.centre }, ip);

  return NextResponse.json({ ok: true, settings: publicView(saved[0] ?? null) });
}

/**
 * Connectivity test against the configured BLS portal.
 * Performs a lightweight reachability probe and records the result.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const guard = await requireOperator(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const s = await load();
  if (!s) {
    return NextResponse.json({ ok: false, error: "NO_SETTINGS" }, { status: 400 });
  }

  const target = `${s.baseUrl.replace(/\/+$/, "")}${s.appointmentPath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(s.requestTimeoutMs, 20_000));
  const started = Date.now();

  let reachable = false;
  let status: string | null = null;
  let errorMessage: string | null = null;

  try {
    // Probe the public portal entry point only — never submit a booking.
    const res = await fetch(s.baseUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": pickUserAgent(Date.now() % 1000),
        "Accept-Language": s.acceptLanguage,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    reachable = res.ok || res.status === 403 || res.status === 503;
    status = String(res.status);
  } catch (err) {
    errorMessage = (err as Error).message;
  } finally {
    clearTimeout(timer);
  }

  const latencyMs = Date.now() - started;
  const connected = reachable;

  await db
    .update(blsConnection)
    .set({
      connected,
      lastTestAt: new Date(),
      lastTestStatus: reachable
        ? `OK ${status} · ${latencyMs}ms`
        : `FAIL ${errorMessage ?? status ?? "unreachable"}`,
    })
    .where(eq(blsConnection.id, s.id));

  await audit(
    guard.username,
    "OPERATOR",
    connected ? "BLS_CONNECTED" : "BLS_TEST_FAILED",
    target,
    { latencyMs, status },
    ip,
  );

  const fresh = await load();

  return NextResponse.json({
    ok: true,
    connected,
    status,
    latencyMs,
    error: errorMessage,
    target,
    settings: publicView(fresh),
  });
}