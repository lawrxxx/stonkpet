import { isHex } from "viem";
import { CHAIN } from "@/lib/chain";
import { nameOf } from "@/lib/stocks";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { verifyFeed } from "@/lib/server/trade";

export const maxDuration = 60;

/**
 * Record a sent transaction, but only after checking it onchain: it must have
 * succeeded and the exchange must have emitted purchases for this user's wallet.
 * The app never says "done" before this passes.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  if (me instanceof Response) return me;
  const { id } = await ctx.params;
  let txHash: string;
  try { ({ txHash } = await req.json()); } catch { return Response.json({ error: "bad_request" }, { status: 400 }); }
  if (!isHex(txHash) || txHash.length !== 66) return Response.json({ error: "bad_request" }, { status: 400 });

  const d = db();
  const { data: a } = await d.from("actions").select("*").eq("id", id).eq("user_id", me.userId).maybeSingle();
  if (!a) return Response.json({ error: "not_found" }, { status: 404 });
  if (a.status === "executed") return Response.json({ ok: true, txHash: a.tx_hash });
  if (a.status !== "approved") return Response.json({ error: "not_approved" }, { status: 409 });

  const r = await verifyFeed(txHash, me.address);
  const now = new Date().toISOString();
  if (!r.ok) {
    await d.from("actions").update({ status: "failed", reason: r.reason, tx_hash: txHash, chain_id: CHAIN.id }).eq("id", id);
    return Response.json({ ok: false, reason: r.reason });
  }

  const usd = r.bought.reduce((s, b) => s + Number(b.usdcIn) / 1e6, 0);
  const tickers = (a.params.legs ?? []).map((l: { ticker: string }) => l.ticker);
  await d.from("actions").update({ status: "executed", tx_hash: txHash, chain_id: CHAIN.id, executed_at: now }).eq("id", id);
  await d.from("activity").insert({
    user_id: me.userId, action_id: id, amount_usd: usd, tx_hash: txHash, chain_id: CHAIN.id,
    title: `Bought ${r.bought.length} stock${r.bought.length === 1 ? "" : "s"}`,
    detail: `You fed $${usd.toFixed(2)} of USDC, split the way we planned: ${tickers.map(nameOf).join(", ")}.`,
  });
  return Response.json({ ok: true, txHash, usd, bought: r.bought.length });
}
