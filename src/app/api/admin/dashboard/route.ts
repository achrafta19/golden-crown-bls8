import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  bookingRuns,
  applicants,
  clients,
  captchaChallenges,
  slotWindows,
  auditLog,
} from "@/db/schema";
import { desc, eq, count } from "drizzle-orm";
import { requireOperator } from "@/lib/security";
import { allNextReleases, schedulerTick, getSlotWindows } from "@/lib/engine";
import { publicStats } from "@/lib/quota";
import { bootstrap } from "@/lib/bootstrap";
import { fmtAlgiers } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Full operator dashboard payload. */
export async function GET(req: NextRequest) {
  const guard = await requireOperator(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  await bootstrap();

  const [
    stats,
    runs,
    pendingCaptchas,
    windowRows,
    recentAudit,
    clientRows,
    statusCounts,
  ] = await Promise.all([
    publicStats(),
    db
      .select({
        run: bookingRuns,
        surname: applicants.surname,
        givenNames: applicants.givenNames,
        centre: applicants.centre,
        category: applicants.category,
      })
      .from(bookingRuns)
      .innerJoin(applicants, eq(bookingRuns.applicantId, applicants.id))
      .orderBy(desc(bookingRuns.createdAt))
      .limit(100),
    db
      .select()
      .from(captchaChallenges)
      .where(eq(captchaChallenges.status, "PENDING"))
      .orderBy(desc(captchaChallenges.createdAt))
      .limit(20),
    getSlotWindows(),
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(40),
    db.select().from(clients).orderBy(desc(clients.createdAt)).limit(200),
    db
      .select({ status: bookingRuns.status, n: count() })
      .from(bookingRuns)
      .groupBy(bookingRuns.status),
  ]);

  const counts: Record<string, number> = {};
  for (const row of statusCounts) counts[row.status] = row.n;

  return NextResponse.json({
    ok: true,
    operator: "operator",
    algeriaTime: fmtAlgiers(new Date()),
    releases: allNextReleases(),
    stats: { ...stats, statusCounts: counts },
    windows: windowRows,
    captchas: pendingCaptchas,
    audit: recentAudit,
    clients: clientRows.map((c) => ({
      id: c.id,
      code: c.code,
      fullName: c.fullName,
      phone: c.phone,
      email: c.email,
      quota: c.quota,
      isActive: c.isActive,
      createdAt: c.createdAt,
    })),
    runs: runs.map((r) => ({
      runId: r.run.id,
      applicantId: r.run.applicantId,
      reference: r.run.reference,
      status: r.run.status,
      slotKind: r.run.slotKind,
      attempts: r.run.attempts,
      maxAttempts: r.run.maxAttempts,
      priority: r.run.priority,
      scheduledFor: r.run.scheduledFor,
      appointmentDate: r.run.appointmentDate,
      appointmentTime: r.run.appointmentTime,
      confirmationNumber: r.run.confirmationNumber,
      error: r.run.error,
      timeline: r.run.timeline,
      name: `${r.surname} ${r.givenNames}`,
      centre: r.centre,
      category: r.category,
    })),
  });
}

/** Manually pump the scheduler. */
export async function POST(req: NextRequest) {
  const guard = await requireOperator(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const result = await schedulerTick();
  return NextResponse.json({ ok: true, action: body.action ?? "tick", result });
}

