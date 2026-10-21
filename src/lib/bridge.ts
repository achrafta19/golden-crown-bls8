import { db } from "@/db";
import { bridgeChannels, bridgeTasks, applicants, blsConnection } from "@/db/schema";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
import { decryptField } from "./crypto";
import { randomToken } from "./crypto";
import { audit } from "./security";
import { SLOT_DEFS, type SlotKind } from "./time";

/**
 * Website <-> Browser Extension bridge.
 *
 * The server never talks to BLS directly. Instead it queues *intent* —
 * "open this URL", "fill these fields", "submit", "read this captcha" —
 * and the extension (running inside a real, logged-in Chrome) executes it with
 * genuine cookies and a genuine fingerprint.
 */

/* ------------------------------------------------------------------ */
/* Channel management                                                   */
/* ------------------------------------------------------------------ */

export async function ensureBridgeChannel(
  kind: "OPERATOR" | "CLIENT",
  subjectId: number,
): Promise<{ id: number; pairCode: string }> {
  const col = kind === "OPERATOR" ? bridgeChannels.operatorId : bridgeChannels.clientId;
  const rows = await db
    .select()
    .from(bridgeChannels)
    .where(and(eq(col, subjectId), eq(bridgeChannels.status, "ACTIVE")))
    .limit(1);

  if (rows[0]) return { id: rows[0].id, pairCode: rows[0].pairCode };

  // 6-char human-friendly pairing code (no ambiguous chars)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pairCode = "";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    pairCode = Array.from(
      { length: 6 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("");
    const clash = await db
      .select({ id: bridgeChannels.id })
      .from(bridgeChannels)
      .where(eq(bridgeChannels.pairCode, pairCode))
      .limit(1);
    if (!clash.length) break;
  }

  const ins = await db
    .insert(bridgeChannels)
    .values(
      kind === "OPERATOR"
        ? { pairCode, operatorId: subjectId }
        : { pairCode, clientId: subjectId },
    )
    .returning();

  return { id: ins[0]!.id, pairCode: ins[0]!.pairCode };
}

export async function getChannelsForClient(clientId: number) {
  return db
    .select()
    .from(bridgeChannels)
    .where(eq(bridgeChannels.clientId, clientId))
    .orderBy(desc(bridgeChannels.createdAt));
}

/** All active channels with their latest heartbeat. */
export async function listChannels() {
  return db.select().from(bridgeChannels).orderBy(desc(bridgeChannels.lastSeenAt));
}

/* ------------------------------------------------------------------ */
/* Task queue                                                           */
/* ------------------------------------------------------------------ */

export type TaskKind =
  | "PING"
  | "OPEN_BOOKING"
  | "FILL_FORM"
  | "PICK_SLOT"
  | "FILL_CAPTCHA"
  | "SUBMIT"
  | "READ_CAPTCHA"
  | "REFRESH_SLOTS";

export async function enqueueTask(
  channelId: number,
  kind: TaskKind,
  payload: Record<string, unknown> = {},
  runId?: number,
): Promise<number> {
  const ins = await db
    .insert(bridgeTasks)
    .values({ channelId, kind, payload, runId: runId ?? null, status: "PENDING" })
    .returning();
  return ins[0]!.id;
}

/** Cancel every pending task for a run (e.g. once it is booked). */
export async function cancelTasksForRun(runId: number): Promise<void> {
  await db
    .update(bridgeTasks)
    .set({ status: "CANCELLED" })
    .where(and(eq(bridgeTasks.runId, runId), eq(bridgeTasks.status, "PENDING")));
}

/* ------------------------------------------------------------------ */
/* Applicant -> fillable form map                                       */
/* ------------------------------------------------------------------ */

const YES = new Set(["نعم", "Yes", "Oui", "true", "1"]);

/**
 * Decrypt the stored applicant record and project it into the exact field
 * names the extension injects into the BLS DOM.
 */
export async function buildFillPayload(applicantId: number) {
  const rows = await db.select().from(applicants).where(eq(applicants.id, applicantId)).limit(1);
  const a = rows[0];
  if (!a) return null;

  const cfgRows = await db.select().from(blsConnection).limit(1);
  const cfg = cfgRows[0];

  const fields: Record<string, string> = {
    // identity
    applicant_last_name: a.surname,
    applicant_first_name: a.givenNames,
    applicant_father_name: a.fatherName ?? "",
    applicant_mother_name: a.motherName ?? "",
    applicant_gender: a.gender,
    applicant_dob: a.birthDate,
    applicant_birth_place: a.birthPlace,
    applicant_nationality: a.nationality ?? "Algerian",
    applicant_previous_nationality: a.previousNationality ?? "N.A.",
    applicant_country_of_birth: a.countryOfBirth ?? "Algeria",
    applicant_residence: a.countryOfResidence ?? "Algeria",
    applicant_marital_status: a.maritalStatus ?? "",
    applicant_national_id: a.nationalId ? safeDecrypt(a.nationalId) : "",
    applicant_biometric_id: a.idCardNumber ? safeDecrypt(a.idCardNumber) : "",
    // passport
    passport_number: safeDecrypt(a.passportNumber),
    passport_type: a.passportType ?? "Ordinary",
    passport_issue_date: a.passportIssueDate ?? "",
    passport_expiry_date: a.passportExpiryDate ?? "",
    passport_authority: a.passportAuthority ?? "",
    passport_issue_place: a.passportIssuePlace ?? "",
    previous_passport: a.previousPassport ? "Yes" : "No",
    previous_passport_no: a.previousPassportNumber ?? "",
    other_passport_used: a.otherPassportUsed ? "Yes" : "No",
    // address & contact
    applicant_address: a.address,
    applicant_city: a.city,
    applicant_wilaya: a.wilaya,
    applicant_postal_code: a.postalCode ?? "",
    applicant_email: a.email,
    applicant_phone: safeDecrypt(a.phone),
    applicant_mobile: a.mobile ? safeDecrypt(a.mobile) : "",
    // social
    applicant_occupation: a.occupation ?? "",
    applicant_employer: a.employer ?? "",
    // visa
    visa_type: a.visaType ?? "",
    centre_id: a.centre,
    appointment_category: a.category,
    travel_purpose: a.purposeOfTravel,
    travel_purpose_details: a.purposeDetails ?? "",
    stay_duration: a.durationOfStay ?? "",
    arrival_date: a.arrivalDate ?? "",
    arrival_city: a.arrivalCity ?? "Madrid",
    departure_date: a.departureDate ?? "",
    intended_stay_days: a.intendedStayDays ?? "",
    no_of_appointment: String(a.numberOfAppointments ?? 1),
    terms_conditions: a.termsAccepted ? "Yes" : "No",
    // stay
    accommodation_type: a.accommodationType ?? "",
    accommodation_name: a.accommodationName ?? "",
    accommodation_address: a.accommodationAddress ?? "",
    accommodation_phone: a.accommodationPhone ?? "",
    host_name: a.hostName ?? "",
    host_phone: a.hostPhone ?? "",
    host_address: a.hostAddress ?? "",
    // insurance
    insurance_company: a.insuranceCompany ?? "",
    insurance_policy: a.insurancePolicyNumber ?? "",
    insurance_expiry: a.insuranceValidUntil ?? "",
    // history
    prev_schengen_visa: a.previousSchengenVisa ? "Yes" : "No",
    last_spain_visa_no: a.lastSpainVisaNumber ?? "",
    last_spain_visa_issue: a.lastSpainVisaIssueDate ?? "",
    last_spain_visa_expiry: a.lastSpainVisaExpiry ?? "",
    last_schengen_issuer: a.lastSpainVisaCountry ?? "",
    relatives_spain: a.relativesInSpain ? "Yes" : "No",
    relative_details: a.relativeDetails ?? "",
    biometrics_previous: a.fingerprintGivenBefore ? "Yes" : "No",
    biometric_receipt: a.biometricReceipt ?? "",
    criminal_record: a.criminalRecord ? "Yes" : "No",
    remarks: a.remarks ?? "",
  };

  // BLS sends a verification code to the registered email; it must be typed
  // into the booking form. It is stored server-side and only ever handed to
  // the paired browser over the authenticated bridge channel.
  const verificationCode = cfg?.verificationCode ?? "";

  return {
    applicantId: a.id,
    reference: null as string | null,
    centre: a.centre,
    category: a.category,
    bookingType: cfg?.bookingType ?? "Individual",
    baseUrl: cfg?.baseUrl ?? "https://algeria.blsspainvisa.com",
    appointmentPath: cfg?.appointmentPath ?? "/appointment.php",
    verificationCode,
    fields: {
      ...fields,
      registered_email_id: a.email,
      verification_code: verificationCode,
    },
  };
}

function safeDecrypt(v: string): string {
  try {
    return decryptField(v);
  } catch {
    return v;
  }
}

/* ------------------------------------------------------------------ */
/* Hot-window orchestration                                              */
/* ------------------------------------------------------------------ */

/**
 * Push the full booking sequence to every ready channel.
 * Called by the engine right before / during the release window.
 */
export async function dispatchBookingSequence(
  runId: number,
  applicantId: number,
  slotKind: SlotKind,
): Promise<{ channels: number; tasks: number }> {
  const cfgRows = await db.select().from(blsConnection).limit(1);
  const cfg = cfgRows[0];
  if (!cfg?.humanCaptcha && cfg?.humanCaptcha === false) {
    // human captcha disabled -> still dispatch, extension just won't wait
  }

  const channels = await db
    .select()
    .from(bridgeChannels)
    .where(and(eq(bridgeChannels.status, "ACTIVE"), eq(bridgeChannels.blsSessionReady, true)));

  if (channels.length === 0) return { channels: 0, tasks: 0 };

  const payload = await buildFillPayload(applicantId);
  if (!payload) return { channels: 0, tasks: 0 };

  const def = SLOT_DEFS[slotKind];
  const bookingUrl = `${cfg?.baseUrl?.replace(/\/+$/, "") ?? "https://algeria.blsspainvisa.com"}${
    cfg?.appointmentPath ?? "/appointment.php"
  }`;

  let tasks = 0;
  // Minutes past midnight in Algeria time; slots before this are already gone.
  const [hh, mm] = def.time.split(":").map((n) => Number.parseInt(n, 10));
  const cutoffMinutes = hh * 60 + mm;

  for (const ch of channels) {
    // 1. open the booking page
    await enqueueTask(
      ch.id,
      "OPEN_BOOKING",
      {
        url: bookingUrl,
        centre: payload.centre,
        category: payload.category,
        bookingType: payload.bookingType,
        slotKind,
        slotLabel: def.label,
      },
      runId,
    );
    // 2. fill every field
    await enqueueTask(ch.id, "FILL_FORM", { fields: payload.fields, runId }, runId);
    // 3. pick the earliest bookable date + time on the calendar
    await enqueueTask(
      ch.id,
      "PICK_SLOT",
      { cutoffMinutes, runId },
      runId,
    );
    // 4. read the captcha BLS raises before the final submit
    await enqueueTask(ch.id, "READ_CAPTCHA", { runId }, runId);
    // 5. submit
    await enqueueTask(ch.id, "SUBMIT", { runId }, runId);
    tasks += 5;
  }

  await audit(
    "SYSTEM",
    "SYSTEM",
    "BRIDGE_DISPATCH",
    `run:${runId}`,
    { channels: channels.length, tasks, slotKind },
  );

  return { channels: channels.length, tasks };
}

/** Warm the session shortly before the release instant. */
export async function warmSessions(slotKind: SlotKind): Promise<number> {
  const cfgRows = await db.select().from(blsConnection).limit(1);
  const cfg = cfgRows[0];
  const channels = await db
    .select()
    .from(bridgeChannels)
    .where(and(eq(bridgeChannels.status, "ACTIVE"), eq(bridgeChannels.blsSessionReady, true)));

  const bookingUrl = `${cfg?.baseUrl?.replace(/\/+$/, "") ?? "https://algeria.blsspainvisa.com"}${
    cfg?.appointmentPath ?? "/appointment.php"
  }`;

  for (const ch of channels) {
    await enqueueTask(ch.id, "PING", { slotKind, warm: true, url: bookingUrl });
  }
  return channels.length;
}

export { randomToken, sql, inArray };