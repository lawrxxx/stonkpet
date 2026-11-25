import { txUrl } from "@/lib/chain";
import { tradingLive } from "@/lib/deployment";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { portfolio } from "@/lib/server/portfolio";

/** The signed-in user's real holdings (onchain × live prices) and recent activity with receipts. */
export async function GET() {
  const me = await requireUser();
  if (me instanceof Response) return me;
  const [pf, { data: activity }, { data: rules }] = await Promise.all([
    portfolio(me.address),
    db().from("activity").select("id, title, detail, amount_usd, tx_hash, chain_id, created_at").eq("user_id", me.userId).order("created_at", { ascending: false }).limit(40),
    db().from("rules").select("autopilot").eq("user_id", me.userId).maybeSingle(),
  ]);
  return Response.json(
    {
      tradingLive: tradingLive(),
      holdings: pf.holdings,
      stocksUsd: pf.stocksUsd,
      walletUsdc: pf.walletUsdc,
      market: pf.board.market,
      tradeAfterHours: !!rules?.autopilot?.afterHours,
      activity: (activity ?? []).map((a) => ({ ...a, explorer: a.tx_hash ? txUrl(a.tx_hash) : null })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
