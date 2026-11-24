import { clearSession, getSession } from "@/lib/server/session";

/** Who's signed in (from the session cookie). */
export async function GET() {
  const s = await getSession();
  return Response.json({ address: s?.address ?? null }, { headers: { "cache-control": "no-store" } });
}

/** Sign out. */
export async function DELETE() {
  await clearSession();
  return Response.json({ ok: true });
}
