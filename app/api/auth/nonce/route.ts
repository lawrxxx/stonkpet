import { generateSiweNonce } from "viem/siwe";
import { sessionConfigured, setNonce } from "@/lib/server/session";

/** A fresh Sign-In with Ethereum nonce, also kept in a short-lived signed cookie. */
export async function GET() {
  // Without a session secret (Supabase not set up yet) the wallet still works; there's just no server session.
  if (!sessionConfigured()) return Response.json({ nonce: null }, { headers: { "cache-control": "no-store" } });
  const nonce = generateSiweNonce();
  await setNonce(nonce);
  return Response.json({ nonce }, { headers: { "cache-control": "no-store" } });
}
