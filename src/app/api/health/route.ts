import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { bootstrap } from "@/lib/bootstrap";
import { fmtAlgiers } from "@/lib/time";
import { runtimeInfo, deploymentWarnings, missingRequiredEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const missing = missingRequiredEnv();

  let dbOk = false;
  let dbLatencyMs: number | null = null;
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
    dbLatencyMs = Date.now() - started;
  } catch {
    dbOk = false;
  }

  // Health reflects database reachability only. Configuration gaps are
  // reported as warnings so a half-configured host still serves traffic.
  if (dbOk) await bootstrap();

  const info = runtimeInfo();

  const warnings = [
    ...missing.map(
      (m) =>
        `Missing environment variable: ${m} — operator recovery details fall back to built-in defaults.`,
    ),
    ...(dbOk ? deploymentWarnings() : []),
  ];

  return NextResponse.json(
    {
      ok: dbOk,
      service: "golden-crown-bls",
      database: dbOk ? "up" : "down",
      databaseLatencyMs: dbLatencyMs,
      algeriaTime: fmtAlgiers(new Date()),
      timestamp: new Date().toISOString(),
      runtime: {
        environment: info.nodeEnv,
        smtpConfigured: info.smtpConfigured,
        dedicatedEncryptionKey: !info.usingDerivedEncryptionKey,
        missingEnv: missing,
      },
      warnings,
    },
    { status: dbOk ? 200 : 503 },
  );
}