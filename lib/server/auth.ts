import { dbConfigured, upsertUser } from "./db";
import { getSession } from "./session";

export type Me = { address: `0x${string}`; userId: string };

/** The signed-in user, or a ready-made 401/503 Response. */
export async function requireUser(): Promise<Me | Response> {
  if (!dbConfigured()) return Response.json({ error: "not_configured", message: "Saving isn't set up on this server yet." }, { status: 503 });
  const s = await getSession();
  if (!s) return Response.json({ error: "signed_out", message: "Sign in with your passkey first." }, { status: 401 });
  return { address: s.address, userId: await upsertUser(s.address) };
}
