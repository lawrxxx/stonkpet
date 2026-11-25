import { createPublicClient, http, isHex } from "viem";
import { parseSiweMessage, verifySiweMessage } from "viem/siwe";
import { CHAIN, RPC_URL } from "@/lib/chain";
import { consumeNonce, dbConfigured, upsertUser } from "@/lib/server/db";
import { setSession, takeNonce } from "@/lib/server/session";

const client = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });

/**
 * Verify a Sign-In with Ethereum message from the passkey wallet and start a session.
 * verifySiweMessage handles smart-wallet signatures (ERC-1271 / ERC-6492), so it works
 * for Base Account even before the wallet is deployed onchain.
 */
export async function POST(req: Request) {
  let message: string, signature: string;
  try { ({ message, signature } = await req.json()); } catch { return Response.json({ error: "bad_request" }, { status: 400 }); }
  if (typeof message !== "string" || !isHex(signature)) return Response.json({ error: "bad_request" }, { status: 400 });

  const nonce = await takeNonce();
  if (!nonce) return Response.json({ error: "expired", message: "Sign-in took too long. Try again?" }, { status: 401 });

  const parsed = parseSiweMessage(message);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  if (!parsed.address || parsed.chainId !== CHAIN.id)
    return Response.json({ error: "wrong_chain", message: `Sign in on ${CHAIN.name}.` }, { status: 401 });

  const ok = await verifySiweMessage(client, { message, signature, nonce, domain: host }).catch(() => false);
  if (!ok) return Response.json({ error: "invalid", message: "That signature didn't check out." }, { status: 401 });
  try {
    if (!(await consumeNonce(nonce))) return Response.json({ error: "replayed", message: "That sign-in was already used. Try again?" }, { status: 401 });
    const address = parsed.address.toLowerCase() as `0x${string}`;
    if (dbConfigured()) await upsertUser(address);
    await setSession(address);
    return Response.json({ address });
  } catch (e) {
    // Surface the database error code/message (never secrets) so sign-in failures are diagnosable.
    const err = e as { code?: string; message?: string };
    console.error("sign-in failed", e);
    return Response.json({ error: "server_error", code: err.code ?? null, detail: err.message ?? String(e), message: "Sign-in hit a server problem." }, { status: 500 });
  }
}
