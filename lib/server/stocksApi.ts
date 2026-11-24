import snapshot from "@/data/base-stocks.snapshot.json";
import type { ListedStock } from "@/lib/stocks";

/**
 * Live read of the public Base Tokenized Stocks API (no key). Cached by Next's
 * fetch cache for 5 minutes; falls back to the committed snapshot if the API
 * is down, and says so (`source`).
 */
const API = "https://api.coinbase.com/v1/tokenized-stocks";
const REVALIDATE_S = 300;

export type LiveStock = ListedStock & {
  navPrice: number | null; // API's last published Chainlink NAV (not an execution price)
  navUpdatedAt: string | null;
  pausedFeatures: string[];
};
export type StockList = { source: "live" | "snapshot"; fetchedAt: string; stocks: LiveStock[] };

type ApiToken = {
  contract_address: string; symbol: string; name: string; decimals: number; multiplier?: number;
  total_supply?: number; nav_price?: number; nav_price_updated_at?: string; paused_features?: string[];
};

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url, { next: { revalidate: REVALIDATE_S } });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json() as Promise<T>;
}

export async function listStocks(): Promise<StockList> {
  try {
    const tokens: ApiToken[] = [];
    let page: string | undefined;
    for (let i = 0; i < 10; i++) {
      const u = new URL(API);
      u.searchParams.set("page_size", "500");
      if (page) u.searchParams.set("page_token", page);
      const j = await get<{ tokens?: ApiToken[]; next_page_token?: string }>(u.toString());
      tokens.push(...(j.tokens ?? []));
      page = j.next_page_token;
      if (!page) break;
    }
    const feeds = (await get<{ nav_feeds?: { contract_address: string; nav_feed_address: string }[] }>(`${API}/nav-feeds`)).nav_feeds ?? [];
    const feedBy = new Map(feeds.map((f) => [f.contract_address.toLowerCase(), f.nav_feed_address as `0x${string}`]));
    return {
      source: "live",
      fetchedAt: new Date().toISOString(),
      stocks: tokens.map((t) => ({
        ticker: t.symbol.replace(/c$/, ""),
        symbol: t.symbol,
        name: t.name,
        address: t.contract_address as `0x${string}`,
        decimals: t.decimals,
        multiplier: t.multiplier ?? 1,
        totalSupply: t.total_supply ?? 0,
        navFeed: feedBy.get(t.contract_address.toLowerCase()) ?? null,
        navPrice: t.nav_price ?? null,
        navUpdatedAt: t.nav_price_updated_at ?? null,
        pausedFeatures: t.paused_features ?? [],
      })),
    };
  } catch {
    return {
      source: "snapshot",
      fetchedAt: snapshot.fetchedAt,
      stocks: (snapshot.stocks as ListedStock[]).map((s) => ({ ...s, navPrice: null, navUpdatedAt: null, pausedFeatures: [] })),
    };
  }
}
