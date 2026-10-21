import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { applicants, clients, bookingRuns } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireClient, clientIp, audit, rateLimit, checkOrigin } from "@/lib/security";
import { getQuotaState, refreshClientQuota } from "@/lib/quota";
import { enqueueRun, ensureSlotWindows } from "@/lib/engine";
import { validateApplicant } from "@/lib/bls-form";
import { SLOT_KINDS, type SlotKind } from "@/lib/time";
import { encryptField } from "@/lib/crypto";
import { bootstrap } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

/**
 * Client submits the full BLS application form.
 * Creates the applicant record and arms the high-velocity booking run for the
 * chosen official release slot.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  await bootstrap();
  await ensureSlotWindows();

  if (!checkOrigin(req)) {
    return NextResponse.json({ ok: false, error: "BAD_ORIGIN" }, { status: 403 });
  }

  const guard = await requireClient(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const limited = rateLimit(`submit:${guard.clientId}`, 6, 600_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "TOO_MANY_ATTEMPTS", retryAfter: limited.retryAfterSec },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const slotKind = String(body.slotKind ?? "") as SlotKind;
  if (!SLOT_KINDS.includes(slotKind)) {
    return NextResponse.json({ ok: false, error: "INVALID_SLOT" }, { status: 400 });
  }

  const payload = (body.form ?? {}) as Record<string, unknown>;
  const check = validateApplicant(payload);
  if (!check.ok) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_FAILED", fields: check.errors },
      { status: 400 },
    );
  }
  const form = check.data;

  // Enforce: max 2 appointments per account, then a 1-month cooldown
  const quota = await getQuotaState(guard.clientId);
  if (quota.blocked) {
    return NextResponse.json(
      {
        ok: false,
        error: "COOLDOWN_ACTIVE",
        blockedUntil: quota.blockedUntil,
      },
      { status: 429 },
    );
  }
  if (quota.remaining <= 0) {
    return NextResponse.json({ ok: false, error: "QUOTA_EXHAUSTED" }, { status: 429 });
  }

  const clientRows = await db
    .select()
    .from(clients)
    .where(eq(clients.id, guard.clientId))
    .limit(1);
  const client = clientRows[0];
  if (!client) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Store PII encrypted at rest (passport no, national id, contact details)
  const inserted = await db
    .insert(applicants)
    .values({
      clientId: client.id,
      surname: form.surname!,
      givenNames: form.givenNames!,
      firstName: form.givenNames!.split(" ")[0] ?? form.givenNames!,
      fatherName: form.fatherName ?? null,
      motherName: form.motherName ?? null,
      gender: form.gender!,
      birthDate: form.birthDate!,
      birthPlace: form.birthPlace!,
      countryOfBirth: form.countryOfBirth ?? "Algeria",
      nationality: form.nationality ?? "Algerian",
      previousNationality: form.previousNationality ?? null,
      countryOfResidence: form.countryOfResidence ?? "Algeria",
      passportNumber: encryptField(form.passportNumber!),
      passportType: form.passportType ?? null,
      passportIssueDate: form.passportIssueDate ?? null,
      passportExpiryDate: form.passportExpiryDate ?? null,
      passportAuthority: form.passportAuthority ?? null,
      passportIssuePlace: form.passportIssuePlace ?? null,
      previousPassport: form.previousPassport === "نعم" || form.previousPassport === "Yes" || form.previousPassport === "Oui",
      previousPassportNumber: form.previousPassportNumber ?? null,
      otherPassportUsed: form.otherPassportUsed === "نعم" || form.otherPassportUsed === "Yes" || form.otherPassportUsed === "Oui",
      nationalId: form.nationalId ? encryptField(form.nationalId) : null,
      idCardNumber: form.idCardNumber ? encryptField(form.idCardNumber) : null,
      address: form.address!,
      city: form.city!,
      wilaya: form.wilaya!,
      postalCode: form.postalCode ?? null,
      email: form.email!,
      phone: encryptField(form.phone!),
      mobile: form.mobile ? encryptField(form.mobile) : null,
      occupation: form.occupation ?? null,
      employer: form.employer ?? null,
      maritalStatus: form.maritalStatus ?? null,
      visaType: form.visaType ?? null,
      centre: form.centre ?? "ALGIERS",
      category: form.category!,
      purposeOfTravel: form.purposeOfTravel!,
      purposeDetails: form.purposeDetails ?? null,
      durationOfStay: form.durationOfStay ?? null,
      arrivalDate: form.arrivalDate ?? null,
      arrivalCity: form.arrivalCity ?? "Madrid",
      departureDate: form.departureDate ?? null,
      intendedStayDays: form.intendedStayDays ?? null,
      numberOfAppointments: Number(form.numberOfAppointments ?? 1) || 1,
      termsAccepted: form.termsAccepted === "نعم" || form.termsAccepted === "Yes" || form.termsAccepted === "Oui",
      accommodationType: form.accommodationType ?? null,
      accommodationName: form.accommodationName ?? null,
      accommodationAddress: form.accommodationAddress ?? null,
      accommodationPhone: form.accommodationPhone ?? null,
      hostName: form.hostName ?? null,
      hostPhone: form.hostPhone ?? null,
      hostAddress: form.hostAddress ?? null,
      insuranceCompany: form.insuranceCompany ?? null,
      insurancePolicyNumber: form.insurancePolicyNumber ?? null,
      insuranceValidUntil: form.insuranceValidUntil ?? null,
      previousSchengenVisa: form.previousSchengenVisa === "نعم" || form.previousSchengenVisa === "Yes" || form.previousSchengenVisa === "Oui",
      lastSpainVisaNumber: form.lastSpainVisaNumber ?? null,
      lastSpainVisaIssueDate: form.lastSpainVisaIssueDate ?? null,
      lastSpainVisaExpiry: form.lastSpainVisaExpiry ?? null,
      lastSpainVisaCountry: form.lastSpainVisaCountry ?? null,
      relativesInSpain: form.relativesInSpain === "نعم" || form.relativesInSpain === "Yes" || form.relativesInSpain === "Oui",
      relativeDetails: form.relativeDetails ?? null,
      criminalRecord: form.criminalRecord === "نعم" || form.criminalRecord === "Yes" || form.criminalRecord === "Oui",
      fingerprintGivenBefore: form.fingerprintGivenBefore === "نعم" || form.fingerprintGivenBefore === "Yes" || form.fingerprintGivenBefore === "Oui",
      biometricReceipt: form.biometricReceipt ?? null,
      remarks: form.remarks ?? null,
    })
    .returning();

  const applicant = inserted[0]!;

  // Arm the run — pre-warm 45s before the release instant
  const run = await enqueueRun({
    slotKind,
    applicantId: applicant.id,
    preWarmMs: 45_000,
    maxAttempts: 400,
    priority: quota.remaining === 1 ? 50 : 100,
  });

  await audit(
    guard.code,
    "CLIENT",
    "REQUEST_SUBMITTED",
    `run:${run.id}`,
    { slotKind, centre: form.centre, category: form.category },
    ip,
  );

  // Recompute so the client immediately sees the slot it just reserved.
  const updatedQuota = await getQuotaState(guard.clientId);
  await refreshClientQuota(guard.clientId);

  return NextResponse.json({
    ok: true,
    runId: run.id,
    reference: run.reference,
    scheduledFor: run.scheduledFor,
    quota: updatedQuota,
  });
}

/** Client fetches their own requests. */
export async function GET(req: NextRequest) {
  const guard = await requireClient(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const runs = await db
    .select({
      run: bookingRuns,
      surname: applicants.surname,
      givenNames: applicants.givenNames,
      centre: applicants.centre,
      category: applicants.category,
      visaType: applicants.visaType,
    })
    .from(bookingRuns)
    .innerJoin(applicants, eq(bookingRuns.applicantId, applicants.id))
    .where(eq(applicants.clientId, guard.clientId))
    .orderBy(desc(bookingRuns.createdAt))
    .limit(50);

  const quota = await getQuotaState(guard.clientId);

  return NextResponse.json({
    ok: true,
    quota,
    requests: runs.map((r) => ({
      runId: r.run.id,
      reference: r.run.reference,
      status: r.run.status,
      slotKind: r.run.slotKind,
      attempts: r.run.attempts,
      maxAttempts: r.run.maxAttempts,
      scheduledFor: r.run.scheduledFor,
      appointmentDate: r.run.appointmentDate,
      appointmentTime: r.run.appointmentTime,
      confirmationNumber: r.run.confirmationNumber,
      error: r.run.error,
      name: `${r.surname} ${r.givenNames}`,
      centre: r.centre,
      category: r.category,
      visaType: r.visaType,
    })),
  });
}

