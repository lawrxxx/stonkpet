import { listStocks } from "@/lib/server/stocksApi";

/**
 * Stocks on Base, live from the Tokenized Stocks API.
 * Default: only the ones stonkpet can trade (they have a Chainlink price feed).
 * ?all=1 includes every listed token.
 */
export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const list = await listStocks();
  const stocks = all ? list.stocks : list.stocks.filter((s) => s.navFeed);
  return Response.json(
    { source: list.source, fetchedAt: list.fetchedAt, listed: list.stocks.length, tradable: list.stocks.filter((s) => s.navFeed).length, stocks },
    { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
