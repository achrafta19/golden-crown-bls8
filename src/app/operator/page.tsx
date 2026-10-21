import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { readSession } from "@/lib/security";
import OperatorLogin from "@/components/OperatorLogin";

export const dynamic = "force-dynamic";

/**
 * /operator — login gate.
 * Already-authenticated operators are forwarded straight to the console.
 */
export default async function Page() {
  const store = await cookies();
  const token = store.get("gcr_op")?.value;
  const session = await readSession(token);
  if (session && session.kind === "OPERATOR") {
    redirect("/operator/console");
  }
  return <OperatorLogin />;
}