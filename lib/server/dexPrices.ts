import type { LiveStock } from "./stocksApi";

/**
 * Unofficial prices for tokenized stocks that have no Chainlink feed, from their
 * DEX pools on Base via GeckoTerminal (public, no key). The Base docs list
 * market-data aggregators as an offchain price source; we treat them as a weaker
 * tier than Chainlink:
 *
 * - only pools deep and active enough to price honestly qualify (DEX_RULES)
 * - every trade in these stocks needs the user's explicit yes
 * - a single trade can be at most 1% of the pool, to keep slippage small
 * - market-hours rules still apply
 */
export const DEX_RULES = {
  minLiquidityUsd: 50_000,
  minVolume24hUsd: 10_000,
  maxTradeShareOfPool: 0.01,
} as const;

export type DexQuote = { price: number; liquidityUsd: number; volume24hUsd: number };

const GT = "https://api.geckoterminal.com/api/v2/simple/networks/base/token_price/";
const CHUNK = 30; // GeckoTerminal's limit per request

type GtResponse = { data?: { attributes?: { token_prices?: Record<string, string | null>; h24_volume_usd?: Record<string, string | null>; total_reserve_in_usd?: Record<string, string | null> } } };

/** Quotes keyed by lowercased token address. Missing = no pool or the lookup failed. */
export async function dexQuotes(addresses: string[]): Promise<Map<string, DexQuote>> {
  const out = new Map<string, DexQuote>();
  for (let i = 0; i < addresses.length; i += CHUNK) {
    const chunk = addresses.slice(i, i + CHUNK);
    try {
      const url = `${GT}${chunk.join(",")}?include_24hr_vol=true&include_total_reserve_in_usd=true`;
      let r = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate: 300 } });
      // The free API allows ~30 calls a minute; back off and retry on 429 rather than dropping stocks.
      for (let attempt = 1; r.status === 429 && attempt <= 3; attempt++) {
        await new Promise((res) => setTimeout(res, attempt * 2000));
        r = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate: 300 } });
      }
      if (!r.ok) continue; // still failing: those stocks simply have no DEX price this time
      const a = ((await r.json()) as GtResponse).data?.attributes;
      for (const addr of chunk) {
        const k = addr.toLowerCase();
        const price = Number(a?.token_prices?.[k]);
        if (!(price > 0)) continue;
        out.set(k, { price, liquidityUsd: Number(a?.total_reserve_in_usd?.[k]) || 0, volume24hUsd: Number(a?.h24_volume_usd?.[k]) || 0 });
      }
    } catch { /* treat as no data */ }
  }
  return out;
}

export const dexEligible = (q: DexQuote | undefined): q is DexQuote =>
  !!q && q.liquidityUsd >= DEX_RULES.minLiquidityUsd && q.volume24hUsd >= DEX_RULES.minVolume24hUsd;

export type DexStock = LiveStock & { dex: DexQuote };

/** Minted stocks without a Chainlink feed whose DEX pool is deep and active enough to price. */
export async function dexTradable(stocks: LiveStock[]): Promise<DexStock[]> {
  const candidates = stocks.filter((s) => !s.navFeed && s.totalSupply > 0);
  const quotes = await dexQuotes(candidates.map((s) => s.address));
  return candidates
    .map((s) => ({ ...s, dex: quotes.get(s.address.toLowerCase()) }))
    .filter((s): s is DexStock => dexEligible(s.dex))
    .sort((a, b) => b.dex.liquidityUsd - a.dex.liquidityUsd);
}
