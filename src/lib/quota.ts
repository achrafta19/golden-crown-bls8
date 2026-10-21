import { db } from "@/db";
import { quotaClaims, clients, applicants, bookingRuns } from "@/db/schema";
import { eq, and, gte, sql, desc, inArray } from "drizzle-orm";
import { addMonths } from "./time";

export const MAX_APPOINTMENTS = 2;

/**
 * Booking rule:
 *  - a client may hold at most 2 appointments at a time
 *  - a slot is reserved the moment a request is armed, so the client cannot
 *    flood the queue with unlimited requests
 *  - the reservation is released automatically if the run ends without a
 *    confirmed booking (failed / cancelled)
 *  - once 2 appointments are actually BOOKED, the account is locked for one
 *    calendar month counted from the second confirmation
 */
export type QuotaState = {
  used: number;
  remaining: number;
  blocked: boolean;
  blockedUntil: Date | null;
  nextAvailableAt: Date | null;
};

/** Runs that still hold a reserved slot (armed and working). */
const ACTIVE_RUN_STATUSES = ["QUEUED", "ARMED", "PROCESSING", "WAITING_CAPTCHA"];

export async function getQuotaState(clientId: number): Promise<QuotaState> {
  // Confirmed bookings permanently consume the quota.
  const claims = await db
    .select({
      id: quotaClaims.id,
      bookedAt: quotaClaims.bookedAt,
      applicantId: quotaClaims.applicantId,
    })
    .from(quotaClaims)
    .where(
      and(eq(quotaClaims.clientId, clientId), eq(quotaClaims.status, "ACTIVE")),
    )
    .orderBy(desc(quotaClaims.bookedAt));

  const bookedCount = claims.length;

  // In-flight requests reserve a slot without counting as a final booking.
  const reservedRows = await db
    .select({ id: bookingRuns.id })
    .from(bookingRuns)
    .innerJoin(applicants, eq(bookingRuns.applicantId, applicants.id))
    .where(
      and(
        eq(applicants.clientId, clientId),
        inArray(bookingRuns.status, ACTIVE_RUN_STATUSES),
      ),
    );

  const reserved = reservedRows.length;
  const used = claims.length + reserved;

  if (used < MAX_APPOINTMENTS) {
    return {
      used,
      remaining: MAX_APPOINTMENTS - used,
      blocked: false,
      blockedUntil: null,
      nextAvailableAt: null,
    };
  }

  // Quota exhausted. Once real bookings exist the lock is anchored to the
  // last confirmation; if both slots are merely in-flight, retry sooner.
  if (bookedCount >= MAX_APPOINTMENTS) {
    const last = claims[claims.length - 1]!;
    const until = addMonths(new Date(last.bookedAt.getTime()), 1);
    return {
      used,
      remaining: 0,
      blocked: new Date() < until,
      blockedUntil: until,
      nextAvailableAt: until,
    };
  }

  return {
    used,
    remaining: 0,
    blocked: true,
    blockedUntil: null,
    nextAvailableAt: null,
  };
}


export async function consumeQuota(
  clientId: number,
  applicantId: number,
): Promise<boolean> {
  const state = await getQuotaState(clientId);
  if (state.blocked || state.remaining <= 0) return false;
  await db.insert(quotaClaims).values({
    clientId,
    applicantId,
    status: "ACTIVE",
    bookedAt: new Date(),
  });
  return true;
}

export async function releaseQuota(applicantId: number): Promise<void> {
  await db
    .update(quotaClaims)
    .set({ status: "RELEASED" })
    .where(eq(quotaClaims.applicantId, applicantId));
}

/** Blocker for re-booking: an account with an unexpired cooldown. */
export async function findCooldown(clientId: number): Promise<Date | null> {
  const state = await getQuotaState(clientId);
  return state.blocked ? state.blockedUntil : null;
}

/** Has this account already booked within the cooldown window? */
export async function hasRecentBooking(clientId: number): Promise<boolean> {
  const since = addMonths(new Date(), -1);
  const rows = await db
    .select({ id: quotaClaims.id })
    .from(quotaClaims)
    .where(
      and(
        eq(quotaClaims.clientId, clientId),
        eq(quotaClaims.status, "ACTIVE"),
        gte(quotaClaims.bookedAt, since),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Enforce the one-booking-per-month cooldown for a *given account*.
 * Returns null when allowed, otherwise the Date the account unlocks.
 */
export async function cooldownBlock(clientId: number): Promise<Date | null> {
  const state = await getQuotaState(clientId);
  if (!state.blocked) return null;
  return state.blockedUntil;
}

/** Public stats for the landing page. */
export async function publicStats() {
  const [clientsRow, bookedRow, attemptsRow] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(clients).where(eq(clients.isActive, true)),
    db.select({ n: sql<number>`count(*)::int` }).from(bookingRuns).where(eq(bookingRuns.status, "BOOKED")),
    db.select({ n: sql<number>`count(*)::int` }).from(bookingRuns),
  ]);

  const totalClients = clientsRow[0]?.n ?? 0;
  const booked = bookedRow[0]?.n ?? 0;
  const total = attemptsRow[0]?.n ?? 0;
  const success = total > 0 ? Math.round((booked / total) * 100) : 100;

  return { clients: totalClients, booked, total, success };
}

export async function applicantOwnsBooking(applicantId: number, clientId: number) {
  const rows = await db
    .select({ id: applicants.id })
    .from(applicants)
    .where(and(eq(applicants.id, applicantId), eq(applicants.clientId, clientId)))
    .limit(1);
  return rows.length > 0;
}

export async function refreshClientQuota(clientId: number): Promise<void> {
  const state = await getQuotaState(clientId);
  const clientRows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!clientRows[0]) return;
  await db
    .update(clients)
    .set({ quota: state.remaining })
    .where(eq(clients.id, clientId));
}