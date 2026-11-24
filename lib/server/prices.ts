import { createPublicClient, http, parseAbi } from "viem";
import { base } from "viem/chains";
import { feedStatus, lastSessionOpen, marketState, type FeedStatus, type MarketState } from "@/lib/market";
import { dexTradable } from "./dexPrices";
import { listStocks } from "./stocksApi";

/**
 * Real prices for the tokenized stocks, read from their Chainlink NAV feeds on
 * Base mainnet (the feeds only exist there). Works the same whether the app
 * trades on Sepolia (mock tokens) or mainnet.
 *
 * Feed values are total-return (underlying price × multiplier), so a holding's
 * USD value is simply token balance × price. Never multiply by the multiplier again.
 */
const mainnet = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org"),
  batch: { multicall: true },
});

const abi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function getRoundData(uint80 roundId) view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
]);

export type Price = {
  ticker: string;
  name: string;
  address: `0x${string}`;
  /** Chainlink feed address; null for DEX-priced stocks. */
  feed: `0x${string}` | null;
  /** "chainlink" = official NAV feed. "dex" = unofficial price from Base DEX pools (see lib/server/dexPrices). */
  source: "chainlink" | "dex";
  /** DEX pool depth and activity, for dex-priced stocks. */
  liquidityUsd?: number;
  volume24hUsd?: number;
  multiplier: number;
  price: number | null;
  updatedAt: string | null;
  status: FeedStatus;
  /** Change vs the last price published before the current/last session opened. null if unknown. */
  dayChangePct: number | null;
};
export type PriceBoard = { market: MarketState; source: "live" | "snapshot"; asOf: string; prices: Price[] };

const ONE = BigInt(1);
const AGG_MASK = (ONE << BigInt(64)) - ONE;

/**
 * Answer of the last round published before `before` (unix s), searching back
 * within the current Chainlink phase: exponential steps, then binary search.
 * About 2·log2(rounds today) reads. null if not found.
 */
async function roundBefore(feed: `0x${string}`, latestId: bigint, before: number): Promise<bigint | null> {
  const phase = latestId >> BigInt(64);
  const agg = latestId & AGG_MASK;
  const read = async (a: bigint) => {
    if (a < ONE) return null;
    try {
      const r = await mainnet.readContract({ address: feed, abi, functionName: "getRoundData", args: [(phase << BigInt(64)) | a] });
      return r[3] > BigInt(0) ? { t: Number(r[3]), v: r[1] } : null;
    } catch { return null; }
  };
  // Find some round older than `before`: step back 1, 2, 4, 8 … rounds.
  let hi = agg; // known: published at/after `before`
  let lo: bigint | null = null;
  let loV: bigint | null = null;
  for (let step = ONE; step <= BigInt(4096); step *= BigInt(2)) {
    const a = agg - step;
    const r = await read(a);
    if (!r) return null;
    if (r.t < before) { lo = a; loV = r.v; break; }
    hi = a;
  }
  if (lo === null) return null;
  // Binary search for the newest round still older than `before`.
  let low: bigint = lo;
  while (hi - low > ONE) {
    const mid: bigint = (low + hi) / BigInt(2);
    const r = await read(mid);
    if (!r) return null;
    if (r.t < before) { low = mid; loV = r.v; } else hi = mid;
  }
  return loV;
}

export async function priceBoard(now = new Date()): Promise<PriceBoard> {
  const market = marketState(now);
  const list = await listStocks();
  const tradable = list.stocks.filter((s) => s.navFeed);
  const sessionOpen = Math.floor(lastSessionOpen(now).getTime() / 1000);

  const latest = await Promise.all(
    tradable.map(async (s) => {
      try {
        const [r, dec] = await Promise.all([
          mainnet.readContract({ address: s.navFeed!, abi, functionName: "latestRoundData" }),
          mainnet.readContract({ address: s.navFeed!, abi, functionName: "decimals" }),
        ]);
        return { r, dec };
      } catch { return null; }
    }),
  );

  const prices = await Promise.all(
    tradable.map(async (s, i): Promise<Price> => {
      const l = latest[i];
      const paused = s.pausedFeatures.length > 0;
      if (!l || l.r[1] <= BigInt(0)) {
        // Onchain read failed: fall back to the API's published NAV, still with staleness rules.
        const upd = s.navUpdatedAt ? Math.floor(Date.parse(s.navUpdatedAt) / 1000) : null;
        return { ticker: s.ticker, name: s.name, address: s.address, feed: s.navFeed!, source: "chainlink", multiplier: s.multiplier,
          price: s.navPrice, updatedAt: s.navUpdatedAt, status: feedStatus(s.navPrice === null ? null : upd, now, market, paused), dayChangePct: null };
      }
      const scale = 10 ** l.dec;
      const price = Number(l.r[1]) / scale;
      const updatedAt = Number(l.r[3]);
      let dayChangePct: number | null = null;
      try {
        if (updatedAt < sessionOpen) dayChangePct = 0; // nothing published since the open
        else {
          const prev = await roundBefore(s.navFeed!, l.r[0], sessionOpen);
          if (prev !== null) { const p0 = Number(prev) / scale; dayChangePct = ((price - p0) / p0) * 100; }
        }
      } catch { dayChangePct = null; }
      return { ticker: s.ticker, name: s.name, address: s.address, feed: s.navFeed!, source: "chainlink", multiplier: s.multiplier,
        price, updatedAt: new Date(updatedAt * 1000).toISOString(), status: feedStatus(updatedAt, now, market, paused), dayChangePct };
    }),
  );

  // Unofficial tier: deep, active DEX pools for stocks without a feed. Pools trade 24/7, but we
  // follow US market hours for them too, so the same "closed" rule applies.
  const dex = await dexTradable(list.stocks);
  for (const s of dex)
    prices.push({
      ticker: s.ticker, name: s.name, address: s.address, feed: null, source: "dex", multiplier: s.multiplier,
      price: s.dex.price, updatedAt: now.toISOString(), status: market.open ? "live" : "closed", dayChangePct: null,
      liquidityUsd: s.dex.liquidityUsd, volume24hUsd: s.dex.volume24hUsd,
    });

  return { market, source: list.source, asOf: now.toISOString(), prices };
}
