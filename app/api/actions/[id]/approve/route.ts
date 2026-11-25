import { IS_TESTNET } from "@/lib/chain";
import { check } from "@/lib/rules";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { portfolio } from "@/lib/server/portfolio";
import { feedCalls, feedLegs, loadUser, pushPrices, snapshotFor } from "@/lib/server/trade";

export const maxDuration = 60;

/**
 * The user tapped yes. Re-run the rules on fresh onchain data (balances and prices
 * may have changed since the proposal), copy live prices to the testnet exchange, and
 * return the exact calls for the wallet to sign. The wallet sends them gas-free with
 * the Builder Code; /confirm records the result after checking it onchain.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  if (me instanceof Response) return me;
  const { id } = await ctx.params;
  const d = db();

  const { data: a } = await d.from("actions").select("*").eq("id", id).eq("user_id", me.userId).maybeSingle();
  if (!a) return Response.json({ error: "not_found" }, { status: 404 });
  if (a.status !== "pending") return Response.json({ error: "not_pending", message: `This one's already ${a.status}.` }, { status: 409 });

  const u = await loadUser(me.userId);
  if (!u.plan) return Response.json({ error: "no_plan", message: "Make a plan first." }, { status: 409 });
  const pf = await portfolio(me.address);
  const v = check(a.params, snapshotFor(pf, u));
  if (!v.ok) {
    await d.from("actions").update({ status: "rejected", reason: v.reason, decided_at: new Date().toISOString() }).eq("id", id);
    return Response.json({ ok: false, code: v.code, reason: v.reason });
  }
  if (v.queueUntilOpen) {
    await d.from("actions").update({ status: "queued", decided_at: new Date().toISOString() }).eq("id", id);
    return Response.json({ ok: true, queued: true, notes: v.notes });
  }

  const legs = feedLegs(u.plan.weights, u.plan.lead, a.params.amountUsd, pf.board, v.afterHours);
  const priceTx = IS_TESTNET ? await pushPrices(legs) : null;
  const calls = feedCalls(legs);
  await d.from("actions").update({
    status: "approved", decided_at: new Date().toISOString(),
    params: { ...a.params, afterHours: v.afterHours, legs: legs.map((l) => ({ ticker: l.ticker, usdc: l.usdc.toString(), price: Number(l.priceE8) / 1e8 })), priceTx },
  }).eq("id", id);

  return Response.json({ ok: true, calls, legs: legs.map((l) => ({ ticker: l.ticker, usd: Number(l.usdc) / 1e6, price: Number(l.priceE8) / 1e8 })) });
}
