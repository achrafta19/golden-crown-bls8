import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { applicants, clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireOperator, audit, clientIp, rateLimit, checkOrigin } from "@/lib/security";
import { getQuotaState, refreshClientQuota } from "@/lib/quota";
import { enqueueRun, ensureSlotWindows } from "@/lib/engine";
import { validateApplicant } from "@/lib/bls-form";
import { SLOT_KINDS, type SlotKind } from "@/lib/time";
import { encryptField } from "@/lib/crypto";
import { bootstrap } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

/**
 * Operator-side booking: create an applicant + armed run on behalf of a client.
 * Uses the same validation, quota and cooldown rules as the client portal.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  await bootstrap();
  await ensureSlotWindows();

  if (!checkOrigin(req)) {
    return NextResponse.json({ ok: false, error: "BAD_ORIGIN" }, { status: 403 });
  }

  const guard = await requireOperator(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const limited = rateLimit(`admin-book:${guard.operatorId}`, 20, 600_000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "TOO_MANY_ATTEMPTS" }, { status: 429 });
  }

  let body: { clientId?: number; slotKind?: string; form?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const clientId = Number(body.clientId);
  const slotKind = String(body.slotKind ?? "") as SlotKind;

  if (!clientId) {
    return NextResponse.json({ ok: false, error: "CLIENT_REQUIRED" }, { status: 400 });
  }
  if (!SLOT_KINDS.includes(slotKind)) {
    return NextResponse.json({ ok: false, error: "INVALID_SLOT" }, { status: 400 });
  }

  const check = validateApplicant(body.form ?? {});
  if (!check.ok) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_FAILED", fields: check.errors },
      { status: 400 },
    );
  }
  const form = check.data;

  const clientRows = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const client = clientRows[0];
  if (!client) {
    return NextResponse.json({ ok: false, error: "CLIENT_NOT_FOUND" }, { status: 404 });
  }

  const quota = await getQuotaState(clientId);
  if (quota.blocked || quota.remaining <= 0) {
    return NextResponse.json(
      { ok: false, error: quota.blocked ? "COOLDOWN_ACTIVE" : "QUOTA_EXHAUSTED", blockedUntil: quota.blockedUntil },
      { status: 429 },
    );
  }

  const yes = (v?: string) => v === "نعم" || v === "Yes" || v === "Oui";

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
      previousSchengenVisa: yes(form.previousSchengenVisa),
      lastSpainVisaNumber: form.lastSpainVisaNumber ?? null,
      lastSpainVisaIssueDate: form.lastSpainVisaIssueDate ?? null,
      lastSpainVisaExpiry: form.lastSpainVisaExpiry ?? null,
      lastSpainVisaCountry: form.lastSpainVisaCountry ?? null,
      relativesInSpain: yes(form.relativesInSpain),
      relativeDetails: form.relativeDetails ?? null,
      criminalRecord: yes(form.criminalRecord),
      fingerprintGivenBefore: yes(form.fingerprintGivenBefore),
      biometricReceipt: form.biometricReceipt ?? null,
      remarks: form.remarks ?? null,
    })
    .returning();

  const applicant = inserted[0]!;

  const run = await enqueueRun({
    slotKind,
    applicantId: applicant.id,
    preWarmMs: 45_000,
    maxAttempts: 400,
    priority: quota.remaining === 1 ? 50 : 100,
  });

  await audit(
    guard.username,
    "OPERATOR",
    "ADMIN_BOOKING_CREATED",
    `run:${run.id}`,
    { client: client.code, slotKind },
    ip,
  );

  // Recompute so the operator sees the slot that was just reserved.
  const updatedQuota = await getQuotaState(clientId);
  await refreshClientQuota(clientId);

  return NextResponse.json({
    ok: true,
    runId: run.id,
    reference: run.reference,
    scheduledFor: run.scheduledFor,
    quota: updatedQuota,
  });
}