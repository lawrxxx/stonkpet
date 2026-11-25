import { createWalletClient, decodeEventLog, encodeFunctionData, erc20Abi, http, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN, RPC_URL } from "@/lib/chain";
import { DEPLOYMENT, exchangeAbi } from "@/lib/deployment";
import type { Weights } from "@/lib/plan";
import type { Rules, Snapshot } from "@/lib/rules";
import { nameOf } from "@/lib/stocks";
import { db } from "./db";
import { chainClient, type Portfolio } from "./portfolio";
import type { PriceBoard } from "./prices";

/** Slippage allowed between the quote we push and settlement (the price can't move on testnet, so this is a guard). */
const SLIPPAGE_BPS = BigInt(100);
const BPS = BigInt(10_000);

export type UserState = { userId: string; rules: Rules; plan: { id: string; weights: Weights; lead: string; priceSource: Record<string, "chainlink" | "dex"> } | null };

/** The user's saved rules and approved plan. */
export async function loadUser(userId: string): Promise<UserState> {
  const [{ data: r }, { data: p }] = await Promise.all([
    db().from("rules").select("*").eq("user_id", userId).maybeSingle(),
    db().from("plans").select("id, weights, lead, price_source").eq("user_id", userId).eq("status", "approved").maybeSingle(),
  ]);
  return {
    userId,
    rules: {
      maxPct: r?.max_pct ?? 30,
      askAboveUsd: Number(r?.ask_above_usd ?? 25),
      excluded: r?.excluded ?? [],
      paused: r?.paused ?? false,
    },
    plan: p ? { id: p.id, weights: p.weights, lead: p.lead, priceSource: p.price_source ?? {} } : null,
  };
}

/** Everything the rules engine needs, from onchain balances and live prices. */
export function snapshotFor(pf: Portfolio, u: UserState): Snapshot {
  const b = pf.board;
  const holdings: Record<string, number> = {};
  for (const h of pf.holdings) if (h.valueUsd !== null) holdings[h.ticker] = h.valueUsd;
  const tradable = new Set(b.prices.filter((p) => p.price !== null && DEPLOYMENT.tokens[p.ticker]).map((p) => p.ticker));
  return {
    rules: u.rules,
    holdings,
    planCashUsd: 0,
    weights: u.plan?.weights ?? {},
    walletUsdc: pf.walletUsdc,
    feeds: Object.fromEntries(b.prices.map((p) => [p.ticker, p.status])),
    listed: new Set([...Object.keys(DEPLOYMENT.tokens), ...b.prices.map((p) => p.ticker)]),
    tradable,
    names: Object.fromEntries(b.prices.map((p) => [p.ticker, nameOf(p.ticker)])),
    priceSource: Object.fromEntries(b.prices.map((p) => [p.ticker, p.source])),
    poolLiquidityUsd: Object.fromEntries(b.prices.filter((p) => p.liquidityUsd).map((p) => [p.ticker, p.liquidityUsd!])),
  };
}

export type Leg = { ticker: string; token: `0x${string}`; usdc: bigint; priceE8: bigint; minOut: bigint };

/** Split a USDC amount across plan weights (6dp, rounding remainder to the lead) and quote each leg. */
export function feedLegs(weights: Weights, lead: string, amountUsd: number, board: PriceBoard): Leg[] {
  const total = parseUnits(amountUsd.toFixed(6), 6);
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const tickers = Object.keys(weights).filter((t) => weights[t] > 0);
  const legs: Leg[] = [];
  let used = BigInt(0);
  for (const t of tickers) {
    const usdc = (total * BigInt(Math.round((weights[t] / sum) * 1e6))) / BigInt(1e6);
    used += usdc;
    legs.push(quoteLeg(t, usdc, board));
  }
  const rest = total - used;
  const li = legs.findIndex((l) => l.ticker === lead);
  if (rest > BigInt(0) && li >= 0) legs[li] = quoteLeg(lead, legs[li].usdc + rest, board);
  return legs.filter((l) => l.usdc > BigInt(0));
}

function quoteLeg(ticker: string, usdc: bigint, board: PriceBoard): Leg {
  const token = DEPLOYMENT.tokens[ticker];
  const price = board.prices.find((p) => p.ticker === ticker)?.price;
  if (!token || !price) throw new Error(`No token or price for ${ticker}`);
  const priceE8 = BigInt(Math.round(price * 1e8));
  const out = (usdc * BigInt(1e10)) / priceE8;
  return { ticker, token, usdc, priceE8, minOut: (out * (BPS - SLIPPAGE_BPS)) / BPS };
}

/** The user's batch: approve exactly the total, then buy every leg in one call. */
export function feedCalls(legs: Leg[]): { to: `0x${string}`; data: Hex }[] {
  const exchange = DEPLOYMENT.exchange!;
  const total = legs.reduce((a, l) => a + l.usdc, BigInt(0));
  return [
    { to: DEPLOYMENT.usdc, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [exchange, total] }) },
    { to: exchange, data: encodeFunctionData({ abi: exchangeAbi, functionName: "buyMany", args: [legs.map((l) => l.token), legs.map((l) => l.usdc), legs.map((l) => l.minOut)] }) },
  ];
}

/**
 * Testnet only: copy the live mainnet prices for these legs into the mock exchange right
 * before the user signs, so the trade settles at the real price. Callers must have run the
 * rules engine first, which refuses closed or frozen prices.
 */
export async function pushPrices(legs: Leg[]): Promise<Hex> {
  const key = process.env.PRICE_UPDATER_KEY as Hex | undefined;
  if (!key) throw new Error("PRICE_UPDATER_KEY is not set");
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ chain: CHAIN, transport: http(RPC_URL), account });
  const hash = await wallet.writeContract({
    address: DEPLOYMENT.exchange!, abi: exchangeAbi, functionName: "setPrices",
    args: [legs.map((l) => l.token), legs.map((l) => l.priceE8)], chain: CHAIN,
  });
  const r = await chainClient.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error("Price update failed");
  return hash;
}

/** Confirm a feed onchain: the tx succeeded and the exchange emitted Bought events for this user. */
export async function verifyFeed(txHash: Hex, buyer: `0x${string}`) {
  const r = await chainClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
  if (r.status !== "success") return { ok: false as const, reason: "The transaction reverted." };
  const bought: { token: string; usdcIn: bigint; tokensOut: bigint }[] = [];
  for (const log of r.logs) {
    if (log.address.toLowerCase() !== DEPLOYMENT.exchange!.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: exchangeAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "Bought" && ev.args.buyer.toLowerCase() === buyer.toLowerCase()) bought.push(ev.args);
    } catch { /* other events */ }
  }
  if (!bought.length) return { ok: false as const, reason: "No purchase from this wallet in that transaction." };
  return { ok: true as const, bought, blockNumber: r.blockNumber };
}
