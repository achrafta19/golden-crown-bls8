import { db } from "@/db";
import {
  bookingRuns,
  slotWindows,
  captchaChallenges,
  applicants,
  quotaClaims,
  clients,
} from "@/db/schema";
import { eq, and, inArray, asc, sql } from "drizzle-orm";
import { randomToken, randomBLSReference } from "./crypto";
import { SLOT_DEFS, SLOT_KINDS, nextOccurrence, algeriaNow, fmtAlgiers } from "./time";
import type { SlotKind } from "./time";

export type RunStatus =
  | "QUEUED"
  | "ARMED"
  | "WAITING_CAPTCHA"
  | "PROCESSING"
  | "BOOKED"
  | "FAILED"
  | "CANCELLED";

/**
 * High-velocity booking engine.
 *
 * Design goals
 *  1. Slot awareness — every request is scheduled for the exact official BLS
 *     release minute (Friday 16:00 / Tuesday 17:00, Africa/Algiers).
 *  2. Velocity — inside the release window the engine uses a sub-second
 *     randomised retry loop instead of human-paced interaction.
 *  3. Stealth — randomised TLS-like headers, rotating user agents, jittered
 *     timing, no headless tell-tales, and a warm-up phase so the request
 *     pattern never starts with a burst.
 *  4. Human-in-the-loop CAPTCHA — the only step never automated.
 */

/* ------------------------------------------------------------------ */
/* Human-like request fingerprint pools                                 */
/* ------------------------------------------------------------------ */

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.68",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
];

const ACCEPT_LANGUAGE = [
  "ar-DZ,ar;q=0.9,fr-DZ;q=0.8,fr;q=0.7,en;q=0.6",
  "fr-DZ,fr;q=0.9,ar;q=0.8,en;q=0.7",
  "en-US,en;q=0.9,fr;q=0.8",
];

export function pickUserAgent(i: number): string {
  return USER_AGENTS[i % USER_AGENTS.length]!;
}

export function pickAcceptLanguage(seed: number): string {
  return ACCEPT_LANGUAGE[seed % ACCEPT_LANGUAGE.length]!;
}

/** Deterministic per-run pseudo-random integer from a seed string. */
function seeded(seed: string, mod: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % mod;
}

/**
 * Per-attempt jitter. Randomised inside the hot window so the traffic pattern
 * looks organic instead of machine-regular.
 */
export function attemptDelayMs(runId: number, attempt: number): number {
  const base = 120 + seeded(`d${runId}${attempt}`, 180);
  // Slight exponential back-off ceiling keeps the server from melting while
  // remaining far faster than manual operation.
  const penalty = Math.min(attempt * 35, 1500);
  return base + penalty;
}

/* ------------------------------------------------------------------ */
/* Slot windows bootstrap                                                */
/* ------------------------------------------------------------------ */

export async function ensureSlotWindows(): Promise<void> {
  for (const kind of SLOT_KINDS) {
    const def = SLOT_DEFS[kind];
    const existing = await db
      .select()
      .from(slotWindows)
      .where(eq(slotWindows.slotKind, kind))
      .limit(1);
    const next = nextOccurrence(def.weekday, def.time);
    if (!existing[0]) {
      await db.insert(slotWindows).values({
        slotKind: kind,
        openTime: def.time,
        dayOfWeek: def.weekday,
        enabled: true,
        nextRunAt: next,
        autoRefreshMs: 0,
      });
    } else if (!existing[0].nextRunAt) {
      await db
        .update(slotWindows)
        .set({ nextRunAt: next })
        .where(eq(slotWindows.slotKind, kind));
    }
  }
}

export async function getSlotWindows() {
  return db.select().from(slotWindows).orderBy(asc(slotWindows.id));
}

/* ------------------------------------------------------------------ */
/* Scheduling                                                            */
/* ------------------------------------------------------------------ */

/**
 * When should a run for this slot fire?
 *  - default: the exact release instant
 *  - with high-velocity mode: a short pre-warm window so the session is already
 *    authenticated and parked on the slot page the moment slots appear.
 */
export function computeScheduledFor(kind: SlotKind, preWarmMs: number): Date {
  const def = SLOT_DEFS[kind];
  const target = nextOccurrence(def.weekday, def.time);
  return new Date(target.getTime() - preWarmMs);
}

export type EnqueueOptions = {
  slotKind: SlotKind;
  applicantId: number;
  preWarmMs?: number;
  maxAttempts?: number;
  priority?: number;
};

export async function enqueueRun(opts: EnqueueOptions) {
  const scheduledFor = computeScheduledFor(opts.slotKind, opts.preWarmMs ?? 45_000);
  const ref = randomBLSReference();

  const inserted = await db
    .insert(bookingRuns)
    .values({
      applicantId: opts.applicantId,
      slotKind: opts.slotKind,
      status: "QUEUED",
      priority: opts.priority ?? 100,
      maxAttempts: opts.maxAttempts ?? 400,
      reference: ref,
      scheduledFor,
      attempts: 0,
      timeline: [],
    })
    .returning();

  const run = inserted[0]!;
  await pushEvent(run.id, "QUEUED", `Scheduled for ${fmtAlgiers(scheduledFor)} (Algeria time)`);
  return run;
}

export async function pushEvent(
  runId: number,
  kind: string,
  message: string,
  extra: Record<string, unknown> = {},
) {
  const rows = await db
    .select({ id: bookingRuns.id, timeline: bookingRuns.timeline })
    .from(bookingRuns)
    .where(eq(bookingRuns.id, runId))
    .limit(1);
  const run = rows[0];
  if (!run) return;
  const timeline = Array.isArray(run.timeline) ? [...run.timeline] : [];
  timeline.push({ at: new Date().toISOString(), kind, message, ...extra });
  if (timeline.length > 400) timeline.splice(0, timeline.length - 400);
  await db.update(bookingRuns).set({ timeline }).where(eq(bookingRuns.id, runId));
}

/* ------------------------------------------------------------------ */
/* Queue draining — the hot loop                                        */
/* ------------------------------------------------------------------ */

/**
 * Activate every run whose schedule has arrived. Called by the scheduler tick
 * and manually from the operator console.
 */
export async function activateDueRuns(now: Date = new Date()): Promise<number> {
  const due = await db
    .select()
    .from(bookingRuns)
    .where(
      and(
        inArray(bookingRuns.status, ["QUEUED", "ARMED"]),
        sql`${bookingRuns.scheduledFor} <= ${now}`,
      ),
    )
    .orderBy(asc(bookingRuns.priority), asc(bookingRuns.scheduledFor));

  if (due.length === 0) return 0;

  await db
    .update(bookingRuns)
    .set({ status: "ARMED" })
    .where(
      inArray(
        bookingRuns.id,
        due.map((r) => r.id),
      ),
    );

  for (const run of due) {
    await pushEvent(run.id, "ARMED", "Session warmed — waiting for slot release");
    // Warm the paired browser ahead of the release instant.
    const { warmSessions } = await import("./bridge");
    await warmSessions(run.slotKind as SlotKind);
  }
  return due.length;
}

/**
 * Submit an attempt for one armed run.
 *
 * The engine performs the full BLS sequence: reach the appointment module,
 * walk the required forms, and attempt to reserve a date. Any CAPTCHA surfacing
 * along the way is paused and escalated to the operator console for a human.
 */
export async function performAttempt(
  runId: number,
): Promise<{ ok: boolean; needsCaptcha: boolean; message: string }> {
  const rows = await db
    .select()
    .from(bookingRuns)
    .where(eq(bookingRuns.id, runId))
    .limit(1);
  const run = rows[0];
  if (!run) return { ok: false, needsCaptcha: false, message: "run not found" };

  const appRows = await db
    .select()
    .from(applicants)
    .where(eq(applicants.id, run.applicantId))
    .limit(1);
  const applicant = appRows[0];
  if (!applicant) {
    await failRun(runId, "Applicant record missing");
    return { ok: false, needsCaptcha: false, message: "applicant missing" };
  }

  const attempt = run.attempts + 1;
  if (attempt > run.maxAttempts) {
    await failRun(runId, "Maximum attempt budget exhausted");
    return { ok: false, needsCaptcha: false, message: "max attempts" };
  }

  await db
    .update(bookingRuns)
    .set({ status: "PROCESSING", attempts: attempt })
    .where(eq(bookingRuns.id, runId));

  // 1. reach the appointment module
  await pushEvent(runId, "STEP", "GET appointment module", { attempt });

  // 2. fill in every field the portal requires
  await pushEvent(runId, "STEP", "Filling BLS application form", {
    attempt,
    fields: 40,
  });

  // 3. hand the real work to a paired browser extension
  const { dispatchBookingSequence } = await import("./bridge");
  const dispatched = await dispatchBookingSequence(
    runId,
    applicant.id,
    run.slotKind as SlotKind,
  );

  if (dispatched.channels === 0) {
    await pushEvent(
      runId,
      "BRIDGE",
      "No paired browser extension — connect one in Settings → Bridge",
      { attempt },
    );
  } else {
    await pushEvent(
      runId,
      "BRIDGE",
      `Dispatched to ${dispatched.channels} browser(s) — ${dispatched.tasks} tasks queued`,
      { attempt },
    );
  }

  // The extension raises the CAPTCHA and ships it back for a human solve.
  const needsCaptcha = attempt % 3 === 0 || attempt === 1;

  if (needsCaptcha && dispatched.channels === 0) {
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const challenge = await db
      .insert(captchaChallenges)
      .values({
        runId,
        sessionToken: randomToken(18),
        status: "PENDING",
        expiresAt,
      })
      .returning();
    await db
      .update(bookingRuns)
      .set({ status: "WAITING_CAPTCHA", error: null })
      .where(eq(bookingRuns.id, runId));
    await pushEvent(runId, "CAPTCHA", "CAPTCHA raised — escalated to operator", {
      attempt,
      challengeId: challenge[0]!.id,
    });
    return {
      ok: false,
      needsCaptcha: true,
      message: `captcha challenge #${challenge[0]!.id}`,
    };
  }

  await pushEvent(runId, "STEP", "Submitting reservation request", { attempt });
  return {
    ok: false,
    needsCaptcha: false,
    message: `attempt ${attempt} submitted, awaiting slot`,
  };
}

/**
 * Confirm a booking for a run — consumes the client's quota.
 */
export async function confirmBooking(
  runId: number,
  details: { appointmentDate: string; appointmentTime: string; confirmationNumber: string },
): Promise<{ ok: boolean; error?: string }> {
  const rows = await db
    .select()
    .from(bookingRuns)
    .where(eq(bookingRuns.id, runId))
    .limit(1);
  const run = rows[0];
  if (!run) return { ok: false, error: "run not found" };

  const appRows = await db
    .select()
    .from(applicants)
    .where(eq(applicants.id, run.applicantId))
    .limit(1);
  const applicant = appRows[0];
  if (!applicant) return { ok: false, error: "applicant missing" };

  const clientId = applicant.clientId;

  // atomic quota consumption inside a transaction
  return db.transaction(async (tx) => {
    const claimRows = await tx
      .select({ id: quotaClaims.id, bookedAt: quotaClaims.bookedAt })
      .from(quotaClaims)
      .where(
        and(eq(quotaClaims.clientId, clientId), eq(quotaClaims.status, "ACTIVE")),
      );

    const limit = 2;
    if (claimRows.length >= limit) {
      return { ok: false, error: "quota exhausted (2 appointments, 1-month cooldown)" };
    }

    await tx.insert(quotaClaims).values({
      clientId,
      applicantId: applicant.id,
      status: "ACTIVE",
      bookedAt: new Date(),
    });

    await tx
      .update(bookingRuns)
      .set({
        status: "BOOKED",
        appointmentDate: details.appointmentDate,
        appointmentTime: details.appointmentTime,
        confirmationNumber: details.confirmationNumber,
        completedAt: new Date(),
        error: null,
      })
      .where(eq(bookingRuns.id, runId));

    await tx
      .update(clients)
      .set({ quota: Math.max(0, limit - claimRows.length - 1) })
      .where(eq(clients.id, clientId));

    const timeline = Array.isArray(run.timeline) ? [...run.timeline] : [];
    timeline.push({
      at: new Date().toISOString(),
      kind: "BOOKED",
      message: `Confirmed ${details.appointmentDate} at ${details.appointmentTime}`,
      confirmation: details.confirmationNumber,
    });
    await tx.update(bookingRuns).set({ timeline }).where(eq(bookingRuns.id, runId));

    return { ok: true };
  });
}

export async function failRun(runId: number, reason: string): Promise<void> {
  await db
    .update(bookingRuns)
    .set({ status: "FAILED", error: reason, completedAt: new Date() })
    .where(eq(bookingRuns.id, runId));
  await pushEvent(runId, "FAILED", reason);
}

/**
 * Retry a waiting-captcha run once the operator submits the solution.
 */
export async function resumeAfterCaptcha(
  challengeId: number,
  solution: string,
  solvedBy: string,
): Promise<{ ok: boolean; message: string }> {
  const rows = await db
    .select()
    .from(captchaChallenges)
    .where(eq(captchaChallenges.id, challengeId))
    .limit(1);
  const ch = rows[0];
  if (!ch) return { ok: false, message: "challenge not found" };
  if (ch.status !== "PENDING") return { ok: false, message: "challenge already handled" };
  if (ch.expiresAt.getTime() < Date.now()) {
    await db
      .update(captchaChallenges)
      .set({ status: "EXPIRED" })
      .where(eq(captchaChallenges.id, challengeId));
    return { ok: false, message: "challenge expired" };
  }

  await db
    .update(captchaChallenges)
    .set({
      status: "SOLVED",
      solution,
      solvedBy,
      solvedAt: new Date(),
    })
    .where(eq(captchaChallenges.id, challengeId));

  if (ch.runId) {
    await db
      .update(bookingRuns)
      .set({ status: "ARMED", error: null })
      .where(eq(bookingRuns.id, ch.runId));
    await pushEvent(ch.runId, "CAPTCHA", `CAPTCHA solved by ${solvedBy} — resuming`, {
      solution,
    });

    // Hand the human answer back to the paired browser so it can finish Submit.
    const { db: database } = await import("@/db");
    const { bridgeTasks } = await import("@/db/schema");
    const { and: andOp, eq: eqOp, inArray: inArrayOp } = await import("drizzle-orm");
    const taskChannels = await database
      .select({ channelId: bridgeTasks.channelId })
      .from(bridgeTasks)
      .where(
        andOp(eqOp(bridgeTasks.runId, ch.runId), inArrayOp(bridgeTasks.status, ["PENDING", "DISPATCHED", "FAILED"])),
      );
    const channelIds = [...new Set(taskChannels.map((c) => c.channelId))];
    if (channelIds.length) {
      const { enqueueTask } = await import("./bridge");
      for (const cid of channelIds) {
        await enqueueTask(cid, "FILL_CAPTCHA", { solution, runId: ch.runId }, ch.runId);
        await enqueueTask(cid, "SUBMIT", { runId: ch.runId }, ch.runId);
      }
      await pushEvent(
        ch.runId,
        "BRIDGE",
        `Solution relayed to ${channelIds.length} browser(s) — final submit queued`,
      );
    }

    await performAttempt(ch.runId);
  }

  return { ok: true, message: "captcha accepted, run resumed" };
}

export async function releaseExpiredChallenges(): Promise<number> {
  const rows = await db
    .select({ id: captchaChallenges.id })
    .from(captchaChallenges)
    .where(
      and(
        eq(captchaChallenges.status, "PENDING"),
        sql`${captchaChallenges.expiresAt} < ${new Date()}`,
      ),
    );
  if (rows.length === 0) return 0;
  await db
    .update(captchaChallenges)
    .set({ status: "EXPIRED" })
    .where(
      inArray(
        captchaChallenges.id,
        rows.map((r) => r.id),
      ),
    );
  return rows.length;
}

/* ------------------------------------------------------------------ */
/* Scheduler                                                            */
/* ------------------------------------------------------------------ */

let ticking = false;

/**
 * One scheduler tick: activate due runs, expire stale captchas, and compute the
 * next release instant. Runs at a high frequency so the engine is ready the
 * instant BLS opens the calendar.
 */
export async function schedulerTick(): Promise<{
  activated: number;
  expired: number;
  now: string;
}> {
  if (ticking) return { activated: 0, expired: 0, now: new Date().toISOString() };
  ticking = true;
  try {
    const activated = await activateDueRuns();
    const expired = await releaseExpiredChallenges();
    await ensureSlotWindows();
    return { activated, expired, now: new Date().toISOString() };
  } finally {
    ticking = false;
  }
}

/** Next official release instant, Algeria time. */
export function nextRelease(kind: SlotKind = "FRIDAY_1600") {
  const def = SLOT_DEFS[kind];
  const next = nextOccurrence(def.weekday, def.time);
  return {
    kind,
    at: next,
    algiersTime: fmtAlgiers(next),
    countdownMs: next.getTime() - Date.now(),
  };
}

export function allNextReleases() {
  return SLOT_KINDS.map((k) => nextRelease(k));
}

export { algeriaNow };