import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookingRuns, slotWindows } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireOperator, audit, clientIp } from "@/lib/security";
import {
  performAttempt,
  confirmBooking,
  failRun,
  pushEvent,
  activateDueRuns,
  computeScheduledFor,
} from "@/lib/engine";
import { SLOT_KINDS, type SlotKind } from "@/lib/time";
import { engineSettings } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

/** Manual control over booking runs and release windows. */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const guard = await requireOperator(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: {
    action?: string;
    runId?: number;
    slotKind?: SlotKind;
    enabled?: boolean;
    date?: string;
    time?: string;
    confirmation?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const action = body.action ?? "";

  switch (action) {
    case "attempt": {
      const result = await performAttempt(Number(body.runId));
      return NextResponse.json({ ok: true, result });
    }

    case "activate": {
      const n = await activateDueRuns();
      return NextResponse.json({ ok: true, activated: n });
    }

    case "confirm": {
      const result = await confirmBooking(Number(body.runId), {
        appointmentDate: body.date ?? "",
        appointmentTime: body.time ?? "",
        confirmationNumber: body.confirmation ?? "",
      });
      await audit(guard.username, "OPERATOR", "RUN_CONFIRMED", `run:${body.runId}`, body as Record<string, unknown>, ip);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    case "fail": {
      await failRun(Number(body.runId), "Cancelled by operator");
      await audit(guard.username, "OPERATOR", "RUN_FAILED", `run:${body.runId}`, {}, ip);
      return NextResponse.json({ ok: true });
    }

    case "boost": {
      // Re-arm a run for the very next release with maximum priority
      const runId = Number(body.runId);
      const kind = (body.slotKind ?? "FRIDAY_1600") as SlotKind;
      if (!SLOT_KINDS.includes(kind)) {
        return NextResponse.json({ ok: false, error: "INVALID_SLOT" }, { status: 400 });
      }
      const settings = await engineSettings();
      const preWarmMs = Number(settings.preWarmSeconds ?? 45) * 1000;
      await db
        .update(bookingRuns)
        .set({
          status: "QUEUED",
          slotKind: kind,
          priority: 1,
          scheduledFor: computeScheduledFor(kind, preWarmMs),
          error: null,
        })
        .where(eq(bookingRuns.id, runId));
      await pushEvent(runId, "BOOST", `Re-armed for next ${kind} release at max priority`);
      await audit(guard.username, "OPERATOR", "RUN_BOOSTED", `run:${runId}`, { kind }, ip);
      return NextResponse.json({ ok: true });
    }

    case "toggle_window": {
      const kind = body.slotKind;
      if (!kind || !SLOT_KINDS.includes(kind as SlotKind)) {
        return NextResponse.json({ ok: false, error: "INVALID_SLOT" }, { status: 400 });
      }
      await db
        .update(slotWindows)
        .set({ enabled: Boolean(body.enabled) })
        .where(eq(slotWindows.slotKind, kind));
      await audit(guard.username, "OPERATOR", "WINDOW_TOGGLED", kind, { enabled: body.enabled }, ip);
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ ok: false, error: "UNKNOWN_ACTION" }, { status: 400 });
  }
}

