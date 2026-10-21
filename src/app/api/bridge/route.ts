import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bridgeChannels, bridgeTasks, bookingRuns, captchaChallenges } from "@/db/schema";
import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";
import { requireOperator, requireClient, audit, clientIp } from "@/lib/security";
import { rateLimit } from "@/lib/security";
import { ensureBridgeChannel, listChannels, enqueueTask } from "@/lib/bridge";
import { fmtAlgiers } from "@/lib/time";

export const dynamic = "force-dynamic";

/* ================================================================== */
/* Website side                                                        */
/* ================================================================== */

/** Current subject's bridge channel (creates one on first call). */
export async function GET(req: NextRequest) {
  const asOperator = req.nextUrl.searchParams.get("as") === "operator";

  if (asOperator) {
    const guard = await requireOperator(req);
    if (!guard.ok) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    const ch = await ensureBridgeChannel("OPERATOR", guard.operatorId);
    const all = await listChannels();
    return NextResponse.json({
      ok: true,
      pairCode: ch.pairCode,
      channels: all.map((c) => ({
        pairCode: c.pairCode,
        browserLabel: c.browserLabel,
        sessionReady: c.blsSessionReady,
        lastSeenAt: c.lastSeenAt,
        bookingUrl: c.blsBookingUrl,
        kind: c.operatorId ? "OPERATOR" : "CLIENT",
      })),
      algeriaTime: fmtAlgiers(new Date()),
    });
  }

  const guard = await requireClient(req);
  if (!guard.ok) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const ch = await ensureBridgeChannel("CLIENT", guard.clientId);
  return NextResponse.json({ ok: true, pairCode: ch.pairCode });
}

/** Create a channel, or manually inject a task (operator only). */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const asOperator = req.nextUrl.searchParams.get("as") === "operator";

  if (asOperator) {
    const guard = await requireOperator(req);
    if (!guard.ok) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    // Manual task injection
    let body: { pairCode?: string; kind?: string; payload?: Record<string, unknown>; runId?: number };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
    }

    if (body.pairCode) {
      const pairCode = body.pairCode.trim().toUpperCase();
      const rows = await db
        .select()
        .from(bridgeChannels)
        .where(eq(bridgeChannels.pairCode, pairCode))
        .limit(1);
      if (!rows[0]) {
        return NextResponse.json({ ok: false, error: "UNKNOWN_CHANNEL" }, { status: 404 });
      }
      const kind = (body.kind ?? "PING") as "PING" | "REFRESH_SLOTS" | "OPEN_BOOKING";
      const id = await enqueueTask(rows[0].id, kind, body.payload ?? {}, body.runId);
      await audit(guard.username, "OPERATOR", "BRIDGE_TASK_SENT", `${kind}#${id}`, {}, ip);
      return NextResponse.json({ ok: true, taskId: id });
    }

    const ch = await ensureBridgeChannel("OPERATOR", guard.operatorId);
    await audit(guard.username, "OPERATOR", "BRIDGE_CHANNEL_CREATED", ch.pairCode, {}, ip);
    return NextResponse.json({ ok: true, pairCode: ch.pairCode });
  }

  const guard = await requireClient(req);
  if (!guard.ok) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const ch = await ensureBridgeChannel("CLIENT", guard.clientId);
  return NextResponse.json({ ok: true, pairCode: ch.pairCode });
}

/* ================================================================== */
/* Extension side — authenticated by the pairing code alone            */
/* ================================================================== */

/** Long-poll for queued tasks. The extension calls this on a tight loop. */
export async function PUT(req: NextRequest) {
  const ip = clientIp(req);
  const limited = rateLimit(`bridge-poll:${ip}`, 240, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMIT" }, { status: 429 });
  }

  let body: {
    pairCode?: string;
    extensionId?: string;
    browserLabel?: string;
    sessionReady?: boolean;
    bookingUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const pairCode = (body.pairCode ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(pairCode)) {
    return NextResponse.json({ ok: false, error: "BAD_PAIR_CODE" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(bridgeChannels)
    .where(eq(bridgeChannels.pairCode, pairCode))
    .limit(1);
  const channel = rows[0];
  if (!channel || channel.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, error: "UNKNOWN_CHANNEL" }, { status: 401 });
  }

  // heartbeat + capability update
  await db
    .update(bridgeChannels)
    .set({
      lastSeenAt: new Date(),
      extensionId: body.extensionId ?? channel.extensionId,
      browserLabel: body.browserLabel ?? channel.browserLabel,
      blsSessionReady:
        typeof body.sessionReady === "boolean" ? body.sessionReady : channel.blsSessionReady,
      blsBookingUrl: body.bookingUrl ?? channel.blsBookingUrl,
    })
    .where(eq(bridgeChannels.id, channel.id));

  // claim pending tasks
  const pending = await db
    .select()
    .from(bridgeTasks)
    .where(and(eq(bridgeTasks.channelId, channel.id), eq(bridgeTasks.status, "PENDING")))
    .orderBy(asc(bridgeTasks.id))
    .limit(12);

  if (pending.length === 0) {
    return NextResponse.json({
      ok: true,
      tasks: [],
      serverTime: fmtAlgiers(new Date()),
      channelsActive: true,
    });
  }

  await db
    .update(bridgeTasks)
    .set({ status: "DISPATCHED", attempts: sql`${bridgeTasks.attempts} + 1` })
    .where(
      inArray(
        bridgeTasks.id,
        pending.map((t) => t.id),
      ),
    );

  return NextResponse.json({
    ok: true,
    tasks: pending.map((t) => ({
      id: t.id,
      kind: t.kind,
      runId: t.runId,
      payload: t.payload,
    })),
    serverTime: fmtAlgiers(new Date()),
  });
}

/** Report a task result back to the server. */
export async function PATCH(req: NextRequest) {
  const ip = clientIp(req);

  let body: {
    pairCode?: string;
    taskId?: number;
    ok?: boolean;
    result?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const pairCode = (body.pairCode ?? "").trim().toUpperCase();
  const taskId = Number(body.taskId);
  if (!/^[A-Z0-9]{6}$/.test(pairCode) || !taskId) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const chRows = await db
    .select()
    .from(bridgeChannels)
    .where(eq(bridgeChannels.pairCode, pairCode))
    .limit(1);
  if (!chRows[0]) {
    return NextResponse.json({ ok: false, error: "UNKNOWN_CHANNEL" }, { status: 401 });
  }

  const taskRows = await db
    .select()
    .from(bridgeTasks)
    .where(eq(bridgeTasks.id, taskId))
    .limit(1);
  const task = taskRows[0];
  if (!task || task.channelId !== chRows[0].id) {
    return NextResponse.json({ ok: false, error: "UNKNOWN_TASK" }, { status: 404 });
  }

  await db
    .update(bridgeTasks)
    .set({
      status: body.ok ? "DONE" : "FAILED",
      result: body.result ?? {},
      executedAt: new Date(),
    })
    .where(eq(bridgeTasks.id, taskId));

  // ---- react to the outcome ----
  const runId = task.runId;

  if (task.kind === "READ_CAPTCHA") {
    const img = typeof body.result?.imageDataUrl === "string" ? body.result.imageDataUrl : null;
    if (runId && img) {
      await db
        .insert(captchaChallenges)
        .values({
          runId,
          imageUrl: img,
          status: "PENDING",
          sessionToken: `bridge:${taskId}`,
          expiresAt: new Date(Date.now() + 5 * 60_000),
        });
      if (runId) {
        await db
          .update(bookingRuns)
          .set({ status: "WAITING_CAPTCHA", error: null })
          .where(eq(bookingRuns.id, runId));
      }
      await audit("EXTENSION", "SYSTEM", "CAPTCHA_CAPTURED", `run:${runId}`, { taskId }, ip);
    }
  }

  if (task.kind === "SUBMIT") {
    const okFlag = body.ok !== false;
    const confirmation =
      typeof body.result?.confirmation === "string" ? body.result.confirmation : null;
    const date = typeof body.result?.appointmentDate === "string" ? body.result.appointmentDate : null;
    const time = typeof body.result?.appointmentTime === "string" ? body.result.appointmentTime : null;

    if (okFlag && confirmation && runId) {
      const { confirmBooking } = await import("@/lib/engine");
      await confirmBooking(runId, {
        appointmentDate: date ?? "",
        appointmentTime: time ?? "",
        confirmationNumber: confirmation,
      });
      await audit("EXTENSION", "SYSTEM", "BOOKING_CONFIRMED", `run:${runId}`, { confirmation }, ip);
    } else if (runId) {
      await db
        .update(bookingRuns)
        .set({ error: String(body.result?.error ?? "submitted without confirmation") })
        .where(eq(bookingRuns.id, runId));
      await audit("EXTENSION", "SYSTEM", "SUBMIT_UNCONFIRMED", `run:${runId}`, {}, ip);
    }
  }

  if (task.kind === "OPEN_BOOKING" && body.ok) {
    await db
      .update(bridgeChannels)
      .set({ blsSessionReady: true, lastSeenAt: new Date() })
      .where(eq(bridgeChannels.id, chRows[0].id));
  }

  return NextResponse.json({ ok: true });
}
