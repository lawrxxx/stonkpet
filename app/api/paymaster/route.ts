import { BUILDER_CODE } from "@/lib/builderCode";
import { CHAIN } from "@/lib/chain";

/**
 * ERC-7677 paymaster proxy. The browser wallet calls this instead of the CDP
 * endpoint, so the CDP key never reaches the client. Only the two paymaster
 * methods are forwarded, and only for our chain. Which contracts get sponsored
 * is enforced by the allowlist in the CDP Paymaster config.
 */
const ALLOWED = new Set(["pm_getPaymasterStubData", "pm_getPaymasterData"]);
const rpcError = (id: unknown, code: number, message: string, status = 400) =>
  Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });

/** Health check for /check: says whether things are configured, never the values. */
export async function GET() {
  return Response.json({
    chainId: CHAIN.id,
    paymasterConfigured: !!process.env.CDP_PAYMASTER_URL,
    builderCode: BUILDER_CODE || null,
  });
}

export async function POST(req: Request) {
  const upstream = process.env.CDP_PAYMASTER_URL;
  let body: { id?: unknown; method?: string; params?: unknown[] };
  try { body = await req.json(); } catch { return rpcError(null, -32700, "Parse error"); }
  if (!body.method || !ALLOWED.has(body.method)) return rpcError(body.id, -32601, "Method not allowed", 403);
  const chainId = Array.isArray(body.params) ? body.params[2] : undefined;
  if (typeof chainId !== "string" || parseInt(chainId, 16) !== CHAIN.id) return rpcError(body.id, -32602, "Wrong chain", 400);
  if (!upstream) return rpcError(body.id, -32000, "Paymaster not configured", 503);

  const r = await fetch(upstream, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  return new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
}
