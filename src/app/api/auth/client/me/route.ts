import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireClient } from "@/lib/security";
import { getQuotaState } from "@/lib/quota";

export const dynamic = "force-dynamic";

/** Current client session profile + quota. */
export async function GET(req: NextRequest) {
  const guard = await requireClient(req);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rows = await db.select().from(clients).where(eq(clients.id, guard.clientId)).limit(1);
  const client = rows[0];
  if (!client) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const quota = await getQuotaState(client.id);

  return NextResponse.json({
    ok: true,
    client: {
      id: client.id,
      code: client.code,
      fullName: client.fullName,
      phone: client.phone,
      email: client.email,
    },
    quota,
  });
}