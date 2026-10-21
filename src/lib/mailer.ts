import nodemailer from "nodemailer";

type MailResult = { delivered: boolean; reason?: string };

function transport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

/**
 * Sends the recovered operator password to the registered email.
 * If SMTP is not configured the credential is still surfaced through the
 * in-console delivery inbox so the operator is never locked out.
 */
export async function sendRecoveryEmail(
  to: string,
  username: string,
  password: string,
): Promise<MailResult> {
  const t = transport();
  const subject = `${BRAND} — Operator password recovery`;
  const text = [
    `Hello ${username},`,
    ``,
    `A password recovery was requested for your operator console.`,
    ``,
    `  New password : ${password}`,
    `  Username     : ${username}`,
    ``,
    `Please sign in and change it immediately.`,
    `This message is confidential and intended only for you.`,
  ].join("\n");

  if (!t) {
    console.log(`[recovery-email:no-transport] to=${to} subject=${subject}`);
    return { delivered: false, reason: "SMTP not configured" };
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM ?? `"${BRAND}" <no-reply@blsvisa.local>`,
      to,
      subject,
      text,
    });
    return { delivered: true };
  } catch (err) {
    console.error("[recovery-email] send failed:", (err as Error).message);
    return { delivered: false, reason: (err as Error).message };
  }
}

const BRAND = "Golden Crown BLS";

export async function sendBookingNotification(
  to: string,
  data: {
    reference: string;
    name: string;
    date: string;
    time: string;
    confirmation: string;
  },
): Promise<MailResult> {
  const t = transport();
  const subject = `${BRAND} — Appointment confirmed ${data.reference}`;
  const text = [
    `Dear ${data.name},`,
    ``,
    `Your Spain visa appointment has been booked successfully.`,
    ``,
    `  Reference       : ${data.reference}`,
    `  Confirmation    : ${data.confirmation}`,
    `  Appointment     : ${data.date} at ${data.time}`,
    ``,
    `Please bring your passport and all required original documents.`,
  ].join("\n");

  if (!t) {
    console.log(`[booking-notification:no-transport] to=${to} ref=${data.reference}`);
    return { delivered: false, reason: "SMTP not configured" };
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM ?? `"${BRAND}" <no-reply@blsvisa.local>`,
      to,
      subject,
      text,
    });
    return { delivered: true };
  } catch (err) {
    console.error("[booking-notification] send failed:", (err as Error).message);
    return { delivered: false, reason: (err as Error).message };
  }
}