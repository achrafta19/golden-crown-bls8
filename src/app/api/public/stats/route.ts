import { NextResponse } from "next/server";
import { allNextReleases } from "@/lib/engine";
import { bootstrap } from "@/lib/bootstrap";
import { fmtAlgiers } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * Public landing data.
 *
 * Only the official release countdowns are exposed — no counters, so client
 * and booking totals can never be scraped from this endpoint.
 */
export async function GET() {
  try {
    await bootstrap();
    return NextResponse.json({
      ok: true,
      releases: allNextReleases(),
      algeriaTime: fmtAlgiers(new Date()),
    });
  } catch {
    return NextResponse.json({ ok: false, releases: [] }, { status: 200 });
  }
}